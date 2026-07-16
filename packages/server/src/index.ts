import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config } from "dotenv";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });

const PORT = Number(process.env.PORT ?? 3000);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = new Hono();

app.use("*", cors({ origin: ALLOWED_ORIGINS }));

app.get("/health", (c) => c.json({ status: "ok", version: "0.0.1" }));

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`AskDocs server listening on http://localhost:${info.port}`);
});
