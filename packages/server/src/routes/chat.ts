import { Hono } from "hono";
import { z } from "zod";
import { runChat } from "../chat/index.js";
import { chatRateLimit } from "../lib/chatRateLimit.js";

const chatSchema = z.object({
  question: z.string().min(1).max(2000),
  // La columna conversations.session_id es UUID: un sessionId con otro
  // formato (ej: localStorage manipulado) rompería el INSERT después de
  // haber pagado la llamada al LLM. Se descarta y se abre sesión nueva.
  sessionId: z.uuid().optional().catch(undefined),
});

export const chatRoute = new Hono();

chatRoute.post("/chat", chatRateLimit, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = chatSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Body inválido", details: parsed.error.flatten() }, 400);
  }

  const sessionId = parsed.data.sessionId ?? crypto.randomUUID();

  try {
    const result = await runChat({ question: parsed.data.question, sessionId });
    return c.json(result);
  } catch (error) {
    // Endpoint público: el detalle (que puede incluir errores crudos del
    // proveedor de LLM) va solo al log del servidor, nunca al cliente.
    console.error("Error en /chat:", error);
    return c.json({ error: "Something went wrong. Please try again in a moment." }, 500);
  }
});
