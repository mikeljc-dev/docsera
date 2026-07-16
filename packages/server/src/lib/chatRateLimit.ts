import { getConnInfo } from "@hono/node-server/conninfo";
import type { MiddlewareHandler } from "hono";
import { createRateLimiter } from "./rateLimit.js";

const RATE_WINDOW_MS = 60_000;

// Perezoso: los módulos se evalúan antes de que index.ts llame a loadEnv(),
// así que leer process.env en el cuerpo del módulo ignoraría .env.
let allow: ((key: string) => boolean) | undefined;

function clientKey(c: Parameters<MiddlewareHandler>[0]): string {
  // x-forwarded-for lo puede poner cualquier cliente: solo es fiable cuando
  // un reverse proxy propio lo sobreescribe (TRUST_PROXY=true).
  if (process.env.TRUST_PROXY === "true") {
    const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;
  }
  return getConnInfo(c).remote.address ?? "unknown";
}

export const chatRateLimit: MiddlewareHandler = async (c, next) => {
  allow ??= createRateLimiter(Number(process.env.CHAT_RATE_LIMIT ?? 20), RATE_WINDOW_MS);
  if (!allow(clientKey(c))) {
    return c.json({ error: "Demasiadas peticiones, inténtalo de nuevo en un momento" }, 429);
  }
  await next();
};
