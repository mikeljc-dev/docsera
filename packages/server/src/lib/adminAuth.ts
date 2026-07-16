import type { MiddlewareHandler } from "hono";

export const requireAdminToken: MiddlewareHandler = async (c, next) => {
  const token = process.env.ADMIN_TOKEN;
  if (!token) {
    return c.json({ error: "ADMIN_TOKEN no configurado en el servidor" }, 500);
  }

  const header = c.req.header("Authorization");
  if (header !== `Bearer ${token}`) {
    return c.json({ error: "No autorizado" }, 401);
  }

  await next();
};
