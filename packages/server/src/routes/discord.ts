import { Hono } from "hono";
import { z } from "zod";
import { runChat } from "../chat/index.js";
import { buildAnswerMessage } from "../discord/message.js";
import { verifyDiscordSignature } from "../discord/verify.js";
import { allowChatRequest } from "../lib/chatRateLimit.js";

const DISCORD_API = "https://discord.com/api/v10";

// Tipos del protocolo de interacciones que usamos: PING(1) y slash
// command(2) de entrada; PONG(1), mensaje(4) y "pensando…"(5) de salida.
const InteractionType = { PING: 1, APPLICATION_COMMAND: 2 } as const;
const ResponseType = { PONG: 1, MESSAGE: 4, DEFERRED_MESSAGE: 5 } as const;
const EPHEMERAL = 64;

const interactionSchema = z.object({
  type: z.number(),
  application_id: z.string().optional(),
  token: z.string().optional(),
  data: z
    .object({
      name: z.string(),
      options: z.array(z.object({ name: z.string(), value: z.unknown() })).optional(),
    })
    .optional(),
  // En un servidor el usuario llega en member.user; en DMs, en user.
  member: z.object({ user: z.object({ id: z.string() }).optional() }).optional(),
  user: z.object({ id: z.string() }).optional(),
});

const questionSchema = z.string().min(1).max(2000);

// La respuesta se genera después de contestar el defer (Discord exige
// responder en 3 s y el RAG tarda más): el resultado se entrega editando el
// mensaje original vía el webhook de la interacción, que no necesita el bot
// token. Cada /ask es una sesión nueva: no hay multi-turno que pagar.
async function deliverAskAnswer(
  question: string,
  applicationId: string,
  interactionToken: string,
): Promise<void> {
  let message;
  try {
    const result = await runChat({ question, sessionId: crypto.randomUUID() });
    message = buildAnswerMessage(result);
  } catch (error) {
    // El error crudo puede llevar detalles del proveedor de LLM: al canal de
    // Discord solo va un mensaje genérico.
    console.error("Error respondiendo /ask de Discord:", error);
    message = { content: "Something went wrong answering your question — please try again." };
  }

  try {
    const res = await fetch(
      `${DISCORD_API}/webhooks/${applicationId}/${interactionToken}/messages/@original`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
      },
    );
    if (!res.ok) {
      console.error(`Discord rechazó la edición del mensaje de /ask (HTTP ${res.status})`);
    }
  } catch (error) {
    console.error("No se pudo entregar la respuesta de /ask a Discord:", error);
  }
}

export const discordRoute = new Hono();

discordRoute.post("/discord/interactions", async (c) => {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  // Sin configurar, el endpoint no existe: no se anuncia una superficie que
  // nadie puede firmar.
  if (!publicKey) return c.json({ error: "Not found" }, 404);

  const signature = c.req.header("x-signature-ed25519");
  const timestamp = c.req.header("x-signature-timestamp");
  const rawBody = await c.req.text();
  if (
    signature === undefined ||
    timestamp === undefined ||
    !verifyDiscordSignature(publicKey, timestamp, rawBody, signature)
  ) {
    return c.json({ error: "Invalid request signature" }, 401);
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    json = null;
  }
  const parsed = interactionSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Body inválido" }, 400);
  }
  const interaction = parsed.data;

  if (interaction.type === InteractionType.PING) {
    return c.json({ type: ResponseType.PONG });
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND && interaction.data?.name === "ask") {
    const rawQuestion = interaction.data.options?.find((o) => o.name === "question")?.value;
    const question = questionSchema.safeParse(rawQuestion);
    if (!question.success || !interaction.application_id || !interaction.token) {
      return c.json({ error: "Body inválido" }, 400);
    }

    // Todas las interacciones llegan desde IPs de Discord: la clave del rate
    // limit es el usuario de Discord, sobre los mismos cubos que /chat. La
    // denegación es efímera para no ensuciar el canal.
    const userId = interaction.member?.user?.id ?? interaction.user?.id ?? "unknown";
    const denial = allowChatRequest(`discord:${userId}`);
    if (denial !== null) {
      return c.json({
        type: ResponseType.MESSAGE,
        data: { content: denial, flags: EPHEMERAL },
      });
    }

    // Sin await: el defer tiene que salir ya; la respuesta llega editando el
    // mensaje cuando el RAG termine.
    void deliverAskAnswer(question.data, interaction.application_id, interaction.token);
    return c.json({ type: ResponseType.DEFERRED_MESSAGE });
  }

  return c.json({ error: "Unsupported interaction" }, 400);
});
