import { Hono } from "hono";
import { z } from "zod";
import { listConversations } from "../admin/conversations.js";
import { getPool } from "../lib/db.js";
import { requireAdminToken } from "../lib/adminAuth.js";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

const querySchema = z.object({
  answered: z.enum(["true", "false"]).optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

export const adminRoute = new Hono();

adminRoute.get("/admin/conversations", requireAdminToken, async (c) => {
  const parsed = querySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "Parámetros inválidos", details: parsed.error.flatten() }, 400);
  }

  const limit = Math.min(Math.max(Number(parsed.data.limit ?? DEFAULT_LIMIT), 1), MAX_LIMIT);
  const offset = Math.max(Number(parsed.data.offset ?? 0), 0);
  const answered = parsed.data.answered === undefined ? undefined : parsed.data.answered === "true";

  const result = await listConversations(getPool(), { answered, limit, offset });
  return c.json(result);
});
