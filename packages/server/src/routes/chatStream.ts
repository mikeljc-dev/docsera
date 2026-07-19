import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { finishChat, prepareChat } from "../chat/index.js";
import { noAnswerText } from "../chat/prompt.js";
import { streamAnswer } from "../chat/stream.js";
import { chatRateLimit } from "../lib/chatRateLimit.js";
import { getChatAdapter } from "../llm/index.js";
import type { ChatAdapter, ChatMessage } from "../llm/types.js";

// Un proveedor sin chatStream sigue funcionando: su respuesta completa se
// emite como un único fragmento, sin efecto de escritura pero sin romperse.
async function* singleDelta(adapter: ChatAdapter, messages: ChatMessage[]): AsyncGenerator<string> {
  yield await adapter.chat(messages);
}

const chatSchema = z.object({
  question: z.string().min(1).max(2000),
  // Mismo criterio que /chat: un sessionId con formato inválido se descarta
  // y se abre sesión nueva en vez de romper el INSERT al final del stream.
  sessionId: z.uuid().optional().catch(undefined),
});

export const chatStreamRoute = new Hono();

// Ruta aparte en vez de negociar por Accept en /chat: /chat sigue siendo la
// superficie estable que usan el MCP y cualquier integración propia, y su
// contrato JSON no se toca.
chatStreamRoute.post("/chat/stream", chatRateLimit, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = chatSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Body inválido", details: parsed.error.flatten() }, 400);
  }

  const question = parsed.data.question;
  const sessionId = parsed.data.sessionId ?? crypto.randomUUID();

  return streamSSE(c, async (stream) => {
    try {
      const { chunks, messages } = await prepareChat({ question, sessionId });

      let answer = "";
      if (chunks.length === 0) {
        answer = noAnswerText();
        await stream.writeSSE({ event: "delta", data: answer });
      } else {
        const adapter = getChatAdapter();
        const deltas = adapter.chatStream
          ? adapter.chatStream(messages)
          : singleDelta(adapter, messages);

        for await (const delta of streamAnswer(deltas)) {
          answer += delta;
          await stream.writeSSE({ event: "delta", data: delta });
        }
      }

      const result = await finishChat({ question, sessionId }, chunks, answer);
      await stream.writeSSE({
        event: "done",
        data: JSON.stringify({
          sources: result.sources,
          sessionId: result.sessionId,
          conversationId: result.conversationId,
          answered: result.answered,
        }),
      });
    } catch (error) {
      // Como en /chat: el detalle solo al log. Aquí la cabecera ya salió con
      // 200, así que el fallo viaja como evento del propio stream.
      console.error("Error en /chat/stream:", error);
      await stream.writeSSE({
        event: "error",
        data: "Something went wrong. Please try again in a moment.",
      });
    }
  });
});
