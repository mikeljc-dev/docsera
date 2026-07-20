import { Hono } from "hono";
import { runChat } from "../chat/index.js";
import { allowChatRequest } from "../lib/chatRateLimit.js";
import { buildAnswerMessage } from "../slack/message.js";
import { verifySlackSignature } from "../slack/verify.js";

const MAX_QUESTION_LENGTH = 2000;

// A diferencia de Discord, Slack no tiene una API para registrar comandos:
// quien crea la app de Slack le pone el nombre que quiera (/ask, /docs...)
// al configurar el Request URL, así que este endpoint no exige un nombre
// concreto — procesa cualquier slash command que Slack le mande.
async function deliverAskAnswer(question: string, responseUrl: string): Promise<void> {
  let message;
  try {
    const result = await runChat({ question, sessionId: crypto.randomUUID() });
    message = buildAnswerMessage(result);
  } catch (error) {
    // El error crudo puede llevar detalles del proveedor de LLM: al canal de
    // Slack solo va un mensaje genérico.
    console.error("Error respondiendo /ask de Slack:", error);
    message = {
      response_type: "ephemeral" as const,
      text: "Something went wrong answering your question — please try again.",
    };
  }

  try {
    // response_url es de un solo uso por invocación y no necesita ningún
    // token: es como Slack entrega la respuesta diferida (hasta 30 min).
    const res = await fetch(responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });
    if (!res.ok) {
      console.error(`Slack rechazó la entrega de /ask (HTTP ${res.status})`);
    }
  } catch (error) {
    console.error("No se pudo entregar la respuesta de /ask a Slack:", error);
  }
}

export const slackRoute = new Hono();

slackRoute.post("/slack/commands", async (c) => {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  // Sin configurar, el endpoint no existe: no se anuncia una superficie que
  // nadie puede firmar.
  if (!signingSecret) return c.json({ error: "Not found" }, 404);

  const signature = c.req.header("x-slack-signature");
  const timestamp = c.req.header("x-slack-request-timestamp");
  const rawBody = await c.req.text();
  if (
    signature === undefined ||
    timestamp === undefined ||
    !verifySlackSignature(signingSecret, timestamp, rawBody, signature)
  ) {
    return c.json({ error: "Invalid request signature" }, 401);
  }

  // Slash commands llegan como application/x-www-form-urlencoded, no JSON.
  const params = new URLSearchParams(rawBody);
  const text = params.get("text")?.trim() ?? "";
  const userId = params.get("user_id");
  const responseUrl = params.get("response_url");

  if (!userId || !responseUrl) {
    return c.json({ response_type: "ephemeral", text: "Malformed request." }, 400);
  }
  if (text === "") {
    return c.json({ response_type: "ephemeral", text: "Usage: `/ask <your question>`" });
  }
  if (text.length > MAX_QUESTION_LENGTH) {
    return c.json({
      response_type: "ephemeral",
      text: `Question is too long (max ${MAX_QUESTION_LENGTH} characters).`,
    });
  }

  // Todas las peticiones llegan desde IPs de Slack: la clave del rate limit
  // es el usuario de Slack, sobre los mismos cubos que /chat. La denegación
  // es efímera para no ensuciar el canal.
  const denial = allowChatRequest(`slack:${userId}`);
  if (denial !== null) {
    return c.json({ response_type: "ephemeral", text: denial });
  }

  // Slack exige responder en 3 s; el ack sale ya (efímero, solo lo ve quien
  // preguntó) y la respuesta real llega al response_url cuando el RAG
  // termine, visible para todo el canal.
  void deliverAskAnswer(text, responseUrl);
  return c.json({ response_type: "ephemeral", text: "🤔 Thinking…" });
});
