import { getConnInfo } from "@hono/node-server/conninfo";
import type { MiddlewareHandler } from "hono";
import { createRateLimiter } from "./rateLimit.js";

const RATE_LIMIT = Number(process.env.CHAT_RATE_LIMIT ?? 20);
const RATE_WINDOW_MS = 60_000;

const allow = createRateLimiter(RATE_LIMIT, RATE_WINDOW_MS);

function clientKey(c: Parameters<MiddlewareHandler>[0]): string {
  const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return getConnInfo(c).remote.address ?? "unknown";
}

export const chatRateLimit: MiddlewareHandler = async (c, next) => {
  if (!allow(clientKey(c))) {
    return c.json({ error: "Demasiadas peticiones, inténtalo de nuevo en un momento" }, 429);
  }
  await next();
};
