import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { loadEnv } from "./env.js";
import { adminRoute } from "./routes/admin.js";
import { chatRoute } from "./routes/chat.js";
import { dashboardRoute } from "./routes/dashboard.js";
import { ingestRoute } from "./routes/ingest.js";
import { widgetRoute } from "./routes/widget.js";

loadEnv();

const PORT = Number(process.env.PORT ?? 3000);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = new Hono();

app.use("*", cors({ origin: ALLOWED_ORIGINS }));

app.get("/health", (c) => c.json({ status: "ok", version: "0.0.1" }));

app.route("/", ingestRoute);
app.route("/", chatRoute);
app.route("/", widgetRoute);
app.route("/", adminRoute);
app.route("/", dashboardRoute);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`AskDocs server listening on http://localhost:${info.port}`);
});
