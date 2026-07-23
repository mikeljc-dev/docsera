import { Hono } from "hono";
import { z } from "zod";
import { loadVisibleHistory } from "../chat/publicHistory.js";
import { chatRateLimit } from "../lib/chatRateLimit.js";
import { getPool } from "../lib/db.js";

const querySchema = z.object({
  sessionId: z.uuid(),
});

export const chatHistoryRoute = new Hono();

// Deja que el widget recupere su propia conversación (últimos turnos dentro
// de la misma ventana que usa el LLM para recordar, ver chat/history.ts) al
// recargar la página o navegar a otra dentro del mismo sitio. El sessionId
// es un UUID aleatorio que solo conoce el navegador que lo generó: no hay
// forma de listar sesiones ajenas, solo de pedir la propia si se tiene el id.
chatHistoryRoute.get("/chat/history", chatRateLimit, async (c) => {
  const parsed = querySchema.safeParse({ sessionId: c.req.query("sessionId") });

  if (!parsed.success) {
    return c.json({ error: "sessionId inválido" }, 400);
  }

  try {
    const turns = await loadVisibleHistory(getPool(), parsed.data.sessionId);
    return c.json({ turns });
  } catch (error) {
    console.error("Error en /chat/history:", error);
    return c.json({ error: "Something went wrong. Please try again in a moment." }, 500);
  }
});
