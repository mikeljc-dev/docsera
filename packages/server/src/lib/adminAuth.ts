import { createHash, timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";

// Comparación en tiempo constante: hashear ambos lados iguala longitudes y
// evita filtrar por timing cuántos caracteres del token coinciden.
function safeEqual(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

export const requireAdminToken: MiddlewareHandler = async (c, next) => {
  const token = process.env.ADMIN_TOKEN;
  if (!token) {
    return c.json({ error: "ADMIN_TOKEN no configurado en el servidor" }, 500);
  }

  const header = c.req.header("Authorization") ?? "";
  if (!safeEqual(header, `Bearer ${token}`)) {
    return c.json({ error: "No autorizado" }, 401);
  }

  await next();
};
