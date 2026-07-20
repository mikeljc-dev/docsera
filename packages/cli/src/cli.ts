#!/usr/bin/env node
import { composeDown } from "./docker.js";
import { resolveProjectDir } from "./state.js";
import { bold, dim, red } from "./ui.js";
import { ingest } from "./commands/ingest.js";
import { setup } from "./commands/setup.js";
import { up } from "./commands/up.js";
import { VERSION } from "./version.js";

const HELP = `${bold("docsera")} — self-hosted AI chat for your docs ${dim(`(v${VERSION})`)}

Usage:
  npx docsera                     set everything up and launch it (wizard on first run)
  npx docsera up                  start the stack
  npx docsera ingest [source] [--redact-secrets]
                                   (re-)index docs: URL, sitemap.xml, PDF or GitHub owner/repo.
                                   --redact-secrets masks known API keys/tokens/cards before
                                   indexing — use it for content you don't fully trust (an
                                   internal wiki), not for docs that need a real example (a
                                   payments tutorial with a known test card).
  npx docsera down                stop the stack (your data is kept)
  npx docsera --help | --version

Docs: https://docs.docsera.dev
`;

function requireProjectDir(): string {
  const dir = resolveProjectDir(process.cwd());
  if (dir === null) {
    throw new Error("No Docsera setup found here. Run `npx docsera` first to create one.");
  }
  return dir;
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  switch (command) {
    case undefined:
      await setup();
      return;
    case "up":
      await up(requireProjectDir());
      return;
    case "ingest": {
      const redactSecrets = rest.includes("--redact-secrets");
      const sourceArg = rest.find((a) => !a.startsWith("--"));
      await ingest(requireProjectDir(), sourceArg, redactSecrets);
      return;
    }
    case "down":
      await composeDown(requireProjectDir());
      console.log("Docsera stopped. Your data is kept in pgdata/ — `npx docsera up` brings it back.");
      return;
    case "--version":
    case "-v":
      console.log(VERSION);
      return;
    case "--help":
    case "-h":
    case "help":
      console.log(HELP);
      return;
    default:
      console.log(HELP);
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch((error: unknown) => {
  console.error(`\n${red("✗")} ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
