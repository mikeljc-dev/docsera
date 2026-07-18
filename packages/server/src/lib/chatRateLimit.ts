import { getConnInfo } from "@hono/node-server/conninfo";
import type { MiddlewareHandler } from "hono";
import { createRateLimiter } from "./rateLimit.js";

const RATE_WINDOW_MS = 60_000;
const DAY_MS = 86_400_000;

// Perezoso: los módulos se evalúan antes de que index.ts llame a loadEnv(),
// así que leer process.env en el cuerpo del módulo ignoraría .env.
let allowMinute: ((key: string) => boolean) | undefined;
let allowDaily: ((key: string) => boolean) | undefined;
let allowGlobal: ((key: string) => boolean) | undefined;

function clientKey(c: Parameters<MiddlewareHandler>[0]): string {
  // x-forwarded-for lo puede poner cualquier cliente: solo es fiable cuando
  // un reverse proxy propio lo sobreescribe (TRUST_PROXY=true).
  if (process.env.TRUST_PROXY === "true") {
    const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;
  }
  return getConnInfo(c).remote.address ?? "unknown";
}

// Tres capas, de la más barata a la más amplia. Las diarias van después de
// la de minuto para que una ráfaga denegada no consuma el cupo del día.
// CHAT_DAILY_LIMIT y CHAT_GLOBAL_DAILY_LIMIT en 0 (default) = desactivadas;
// pensadas para demos públicas donde hay que acotar el gasto total de LLM.
export const chatRateLimit: MiddlewareHandler = async (c, next) => {
  const key = clientKey(c);

  allowMinute ??= createRateLimiter(Number(process.env.CHAT_RATE_LIMIT ?? 20), RATE_WINDOW_MS);
  if (!allowMinute(key)) {
    return c.json({ error: "Too many requests — please try again in a moment" }, 429);
  }

  const dailyLimit = Number(process.env.CHAT_DAILY_LIMIT ?? 0);
  if (dailyLimit > 0) {
    allowDaily ??= createRateLimiter(dailyLimit, DAY_MS);
    if (!allowDaily(key)) {
      return c.json({ error: "Daily question limit reached — please come back tomorrow" }, 429);
    }
  }

  const globalLimit = Number(process.env.CHAT_GLOBAL_DAILY_LIMIT ?? 0);
  if (globalLimit > 0) {
    allowGlobal ??= createRateLimiter(globalLimit, DAY_MS);
    if (!allowGlobal("global")) {
      return c.json({ error: "The demo has reached its daily budget — please come back tomorrow" }, 429);
    }
  }

  await next();
};
