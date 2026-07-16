import { Hono } from "hono";
import { z } from "zod";
import { runChat } from "../chat/index.js";
import { chatRateLimit } from "../lib/chatRateLimit.js";

const chatSchema = z.object({
  question: z.string().min(1).max(2000),
  sessionId: z.string().min(1).max(200).optional(),
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
    return c.json(
      { error: error instanceof Error ? error.message : "Error desconocido durante el chat" },
      500,
    );
  }
});
