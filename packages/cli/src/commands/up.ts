import { composeUp, waitForHealth } from "../docker.js";
import { buildWidgetSnippet } from "../generate.js";
import { readEnv, readState } from "../state.js";
import { bold, cyan, dim, green } from "../ui.js";
import { runIngestRequest } from "./ingest.js";

export async function up(dir: string): Promise<void> {
  const env = readEnv(dir);
  const port = env.PORT ?? "3000";
  const serverUrl = `http://localhost:${port}`;

  console.log(dim("\nStarting Docsera (docker compose up -d)…\n"));
  await composeUp(dir);

  // El primer arranque incluye pull de la imagen y migraciones: margen amplio.
  const version = await waitForHealth(`${serverUrl}/health`, 120_000);
  console.log(`\n${green("✓")} Docsera v${version} is running at ${cyan(serverUrl)}`);

  // La primera ingesta se hace sola con lo que se contestó en el wizard; las
  // siguientes van con `docsera ingest` para no re-indexar en cada arranque.
  const state = readState(dir);
  if (state.source && state.ingestedAt === undefined) {
    await runIngestRequest(dir, state.source);
  }

  console.log(`
${bold("Add the chat to your site with one line:")}

  ${cyan(buildWidgetSnippet(serverUrl))}

  ${dim(`In production, replace ${serverUrl} with this server's public URL and`)}
  ${dim(`add your site's origin to ALLOWED_ORIGINS in .env (folder: ${dir}).`)}

${bold("Dashboard:")} ${cyan(`${serverUrl}/dashboard`)} ${dim("(log in with the ADMIN_TOKEN from .env)")}

${bold("Useful commands:")}
  npx docsera ingest ${dim("[url | sitemap.xml | owner/repo]")}   re-index or add docs
  npx docsera up                                    start again (e.g. after a reboot)
  npx docsera down                                  stop everything ${dim("(your data stays in pgdata/)")}
`);
}
