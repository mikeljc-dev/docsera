import { readFileSync } from "node:fs";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { loadEnv } from "./env.js";
import { adminRoute } from "./routes/admin.js";
import { chatRoute } from "./routes/chat.js";
import { chatStreamRoute } from "./routes/chatStream.js";
import { dashboardRoute } from "./routes/dashboard.js";
import { feedbackRoute } from "./routes/feedback.js";
import { ingestRoute } from "./routes/ingest.js";
import { llmsRoute } from "./routes/llms.js";
import { mcpRoute } from "./routes/mcp.js";
import { publicStatsRoute } from "./routes/publicStats.js";
import { widgetRoute } from "./routes/widget.js";

loadEnv();

const VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8")) as {
    version: string;
  }
).version;

const PORT = Number(process.env.PORT ?? 3000);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = new Hono();

app.use("*", cors({ origin: ALLOWED_ORIGINS }));

app.get("/health", (c) => c.json({ status: "ok", version: VERSION }));

app.route("/", ingestRoute);
app.route("/", chatRoute);
app.route("/", chatStreamRoute);
app.route("/", feedbackRoute);
app.route("/", publicStatsRoute);
app.route("/", mcpRoute);
app.route("/", llmsRoute);
app.route("/", widgetRoute);
app.route("/", adminRoute);
app.route("/", dashboardRoute);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Docsera server listening on http://localhost:${info.port}`);
});
