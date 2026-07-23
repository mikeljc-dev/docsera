import { Hono } from "hono";
import { z } from "zod";
import { deleteConversation, listConversations } from "../admin/conversations.js";
import { getStats } from "../admin/stats.js";
import { getPool } from "../lib/db.js";
import { requireAdminToken } from "../lib/adminAuth.js";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

const querySchema = z.object({
  answered: z.enum(["true", "false"]).optional(),
  search: z.string().max(200).optional(),
  sessionId: z.uuid().optional(),
  since: z.iso.datetime({ offset: true }).optional(),
  sortBy: z.enum(["date", "feedback", "sources"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

const idSchema = z.object({ id: z.uuid() });

// Rango en días para las analíticas; ausente = todo el histórico. Acotado a
// 365 para que la ventana de la gráfica no se dispare.
const statsQuerySchema = z.object({
  days: z.coerce.number().int().positive().max(365).optional(),
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

  const result = await listConversations(getPool(), {
    answered,
    search: parsed.data.search,
    sessionId: parsed.data.sessionId,
    since: parsed.data.since,
    sortBy: parsed.data.sortBy,
    sortDir: parsed.data.sortDir,
    limit,
    offset,
  });
  return c.json(result);
});

adminRoute.delete("/admin/conversations/:id", requireAdminToken, async (c) => {
  const parsed = idSchema.safeParse({ id: c.req.param("id") });
  if (!parsed.success) {
    return c.json({ error: "id inválido" }, 400);
  }

  const deleted = await deleteConversation(getPool(), parsed.data.id);
  if (!deleted) {
    return c.json({ error: "No encontrada" }, 404);
  }
  return c.json({ ok: true });
});

adminRoute.get("/admin/stats", requireAdminToken, async (c) => {
  const parsed = statsQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "Parámetros inválidos", details: parsed.error.flatten() }, 400);
  }

  const stats = await getStats(getPool(), parsed.data.days ?? null);
  return c.json(stats);
});
