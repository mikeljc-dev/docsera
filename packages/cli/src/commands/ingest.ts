import { detectSource } from "../detect.js";
import { readEnv, readState, writeState } from "../state.js";
import { bold, dim, green, red, yellow } from "../ui.js";
import type { IngestSource } from "../detect.js";

interface IngestResponse {
  documents?: { url: string; title: string; status: string; chunks: number; error?: string }[];
  truncated?: boolean;
  error?: string;
}

// Lanza la ingesta contra el server local usando el ADMIN_TOKEN del .env que
// generó la propia CLI: el token nunca sale de la máquina del usuario.
export async function runIngestRequest(dir: string, source: IngestSource): Promise<void> {
  const env = readEnv(dir);
  const port = env.PORT ?? "3000";
  const adminToken = env.ADMIN_TOKEN;
  if (!adminToken) {
    throw new Error(`ADMIN_TOKEN missing from ${dir}/.env — cannot call /ingest.`);
  }

  console.log(`\nIndexing ${bold(source.source)} ${dim(`(${source.type})`)} — this can take a few minutes…`);

  const res = await fetch(`http://localhost:${port}/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ type: source.type, source: source.source }),
    // Sitemaps grandes tardan: el server responde cuando termina de embeber.
    signal: AbortSignal.timeout(30 * 60_000),
  });

  const body = (await res.json().catch(() => null)) as IngestResponse | null;
  if (!res.ok || body === null) {
    throw new Error(`Ingest failed (HTTP ${res.status}): ${body?.error ?? "unexpected response"}`);
  }

  const documents = body.documents ?? [];
  const failed = documents.filter((doc) => doc.status === "failed");
  const chunks = documents.reduce((total, doc) => total + doc.chunks, 0);
  const okCount = documents.length - failed.length;

  console.log(
    `${green("✓")} Indexed ${okCount}/${documents.length} document(s), ${chunks} chunk(s).` +
      (body.truncated ? yellow(" (sitemap truncated to the first 200 pages)") : ""),
  );
  for (const doc of failed.slice(0, 5)) {
    console.log(red(`  ✗ ${doc.url}: ${doc.error ?? "failed"}`));
  }
  if (failed.length > 5) {
    console.log(red(`  … and ${failed.length - 5} more failures`));
  }
  if (documents.length > 0 && okCount === 0) {
    throw new Error("Every document failed to ingest — see the errors above.");
  }

  const state = readState(dir);
  writeState(dir, { ...state, source, ingestedAt: new Date().toISOString() });
}

export async function ingest(dir: string, sourceArg?: string): Promise<void> {
  let source: IngestSource | null;
  if (sourceArg !== undefined) {
    source = detectSource(sourceArg);
    if (source === null) {
      throw new Error(`"${sourceArg}" is not an http(s) URL, a sitemap.xml or a GitHub owner/repo.`);
    }
  } else {
    source = readState(dir).source ?? null;
    if (source === null) {
      throw new Error("No docs source saved yet. Tell me what to index: `npx docsera ingest <url | sitemap.xml | owner/repo>`.");
    }
  }

  const env = readEnv(dir);
  const port = env.PORT ?? "3000";
  try {
    await fetch(`http://localhost:${port}/health`, { signal: AbortSignal.timeout(2000) });
  } catch {
    throw new Error("The server is not running. Start it first with `npx docsera up`.");
  }

  await runIngestRequest(dir, source);
}
