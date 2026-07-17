import { Hono } from "hono";
import { z } from "zod";
import { getPool } from "../lib/db.js";
import { createRateLimiter } from "../lib/rateLimit.js";
import type { MiddlewareHandler } from "hono";
import { getConnInfo } from "@hono/node-server/conninfo";

const feedbackSchema = z.object({
  conversationId: z.uuid(),
  rating: z.enum(["up", "down"]),
});

// Limiter propio (más generoso que el del chat) para que valorar
// respuestas no consuma el cupo de preguntas.
let allow: ((key: string) => boolean) | undefined;

const feedbackRateLimit: MiddlewareHandler = async (c, next) => {
  allow ??= createRateLimiter(30, 60_000);
  const forwarded =
    process.env.TRUST_PROXY === "true"
      ? c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
      : undefined;
  const key = forwarded ?? getConnInfo(c).remote.address ?? "unknown";
  if (!allow(key)) {
    return c.json({ error: "Too many requests" }, 429);
  }
  await next();
};

export const feedbackRoute = new Hono();

feedbackRoute.post("/feedback", feedbackRateLimit, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = feedbackSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.flatten() }, 400);
  }

  const value = parsed.data.rating === "up" ? 1 : -1;

  try {
    const result = await getPool().query(
      "UPDATE conversations SET feedback = $1 WHERE id = $2",
      [value, parsed.data.conversationId],
    );
    if (result.rowCount === 0) {
      return c.json({ error: "Conversation not found" }, 404);
    }
    return c.json({ ok: true });
  } catch (error) {
    console.error("Error en /feedback:", error);
    return c.json({ error: "Something went wrong" }, 500);
  }
});
