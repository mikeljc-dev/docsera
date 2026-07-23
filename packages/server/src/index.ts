import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { loadEnv } from "./env.js";
import { adminRoute } from "./routes/admin.js";
import { chatRoute } from "./routes/chat.js";
import { chatHistoryRoute } from "./routes/chatHistory.js";
import { chatStreamRoute } from "./routes/chatStream.js";
import { dashboardRoute } from "./routes/dashboard.js";
import { discordRoute } from "./routes/discord.js";
import { registerDiscordCommands } from "./discord/register.js";
import { slackRoute } from "./routes/slack.js";
import { feedbackRoute } from "./routes/feedback.js";
import { ingestRoute } from "./routes/ingest.js";
import { llmsRoute } from "./routes/llms.js";
import { mcpRoute } from "./routes/mcp.js";
import { publicStatsRoute } from "./routes/publicStats.js";
import { widgetRoute } from "./routes/widget.js";
import { VERSION } from "./version.js";

loadEnv();

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
app.route("/", chatHistoryRoute);
app.route("/", chatStreamRoute);
app.route("/", feedbackRoute);
app.route("/", publicStatsRoute);
app.route("/", mcpRoute);
app.route("/", llmsRoute);
app.route("/", widgetRoute);
app.route("/", adminRoute);
app.route("/", dashboardRoute);
app.route("/", discordRoute);
app.route("/", slackRoute);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Docsera server listening on http://localhost:${info.port}`);
});

// Fire-and-forget: si Discord no está configurado no hace nada, y un fallo
// de red no debe impedir servir el resto (ya loguea él el error).
void registerDiscordCommands();
