import { Hono } from "hono";
import { z } from "zod";
import { runIngest } from "../ingest/index.js";
import { isValidUrl, parseGithubSource } from "../ingest/fetchSource.js";
import { requireAdminToken } from "../lib/adminAuth.js";

const ingestSchema = z.object({
  type: z.enum(["markdown", "url", "sitemap", "github"]),
  source: z.string().min(1),
  url: z.string().min(1).optional(),
  title: z.string().optional(),
  branch: z.string().min(1).max(200).optional(),
  path: z.string().max(500).optional(),
});

export const ingestRoute = new Hono();

ingestRoute.post("/ingest", requireAdminToken, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = ingestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Body inválido", details: parsed.error.flatten() }, 400);
  }

  const { type, source, url } = parsed.data;

  if ((type === "url" || type === "sitemap") && !isValidUrl(source)) {
    return c.json({ error: "source debe ser una URL válida para type url/sitemap" }, 400);
  }

  if (type === "github" && !parseGithubSource(source)) {
    return c.json(
      { error: 'source debe ser "owner/repo" o una URL de github.com para type github' },
      400,
    );
  }

  if (url !== undefined && !isValidUrl(url)) {
    return c.json({ error: "url debe ser una URL válida" }, 400);
  }

  try {
    const result = await runIngest(parsed.data);
    return c.json(result);
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Error desconocido durante la ingesta" },
      500,
    );
  }
});
