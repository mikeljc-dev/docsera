import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dockerComposeAvailable, findFreePort } from "../docker.js";
import { buildComposeFile, buildEnvFile } from "../generate.js";
import { resolveProjectDir, writeState } from "../state.js";
import { bold, cyan, dim, green, yellow } from "../ui.js";
import { runWizard } from "../wizard.js";
import { up } from "./up.js";
import { VERSION } from "../version.js";

// `npx docsera` sin argumentos: si ya hay una instalación, solo arranca; si
// no, wizard + generar archivos + arrancar + primera ingesta. Un comando.
export async function setup(): Promise<void> {
  const existing = resolveProjectDir(process.cwd());
  if (existing !== null) {
    await up(existing);
    return;
  }

  console.log(bold(`\nDocsera v${VERSION} — AI chat for your docs, on your server.`));
  console.log(dim("Answer a few questions and everything else is generated for you.\n"));

  if (!(await dockerComposeAvailable())) {
    throw new Error(
      "Docker Compose is required (it runs the database and the server). " +
        "Install Docker Desktop or Docker Engine: https://docs.docker.com/get-docker/",
    );
  }

  // En un directorio vacío se instala ahí mismo (patrón `mkdir mi-docsera &&
  // cd`); si no, en ./docsera para no mezclar archivos con lo que ya hubiera.
  const cwd = process.cwd();
  const dir = readdirSync(cwd).length === 0 ? cwd : join(cwd, "docsera");
  if (dir !== cwd && existsSync(dir) && readdirSync(dir).length > 0) {
    throw new Error(
      `The folder ${dir} already exists and is not a Docsera setup — move or remove it first.`,
    );
  }

  const answers = await runWizard();

  const port = await findFreePort(3000);
  if (port !== 3000) {
    console.log(yellow(`\nPort 3000 is busy — using ${port} instead.`));
  }

  mkdirSync(dir, { recursive: true });
  const envFile = buildEnvFile({
    chatProvider: answers.chatProvider,
    embeddingProvider: answers.embeddingProvider,
    anthropicApiKey: answers.anthropicApiKey,
    openaiApiKey: answers.openaiApiKey,
    openaiBaseUrl: answers.openaiBaseUrl,
    chatModel: answers.chatModel,
    adminToken: randomBytes(32).toString("hex"),
    postgresPassword: randomBytes(16).toString("hex"),
    port,
    allowedOrigins: answers.origin !== null ? [answers.origin] : [],
  });
  // El .env lleva API keys y el ADMIN_TOKEN: solo legible por el usuario.
  writeFileSync(join(dir, ".env"), envFile, { mode: 0o600 });
  writeFileSync(join(dir, "docker-compose.yml"), buildComposeFile());
  writeState(dir, answers.source !== null ? { source: answers.source } : {});

  console.log(`\n${green("✓")} Configuration written to ${cyan(dir)}`);
  console.log(dim("  .env (your keys and secrets) · docker-compose.yml · docsera.json"));

  await up(dir);
}
