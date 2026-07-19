import { Hono } from "hono";
import { getPool } from "../lib/db.js";

export interface IndexedDocument {
  title: string | null;
  url: string | null;
}

const DEFAULT_TITLE = "Documentation";

// Convención llms.txt (llmstxt.org): un Markdown corto en la raíz que le dice
// a un agente qué hay y cómo consultarlo. Aquí no es un fichero estático sino
// el reflejo de lo que está indexado, así que no puede quedarse obsoleto
// respecto a la doc real.
export function buildLlmsTxt(
  origin: string,
  title: string,
  documents: IndexedDocument[],
): string {
  const lines = [
    `# ${title}`,
    "",
    "> Documentation indexed by Docsera. Ask it questions in natural language:",
    "> every answer cites the sections it came from, and says \"I don't know\"",
    "> rather than guessing.",
    "",
    "## Query this documentation",
    "",
    `- [MCP server](${origin}/mcp): Streamable HTTP. Tools: \`search_docs\` (retrieval only, no LLM call) and \`ask_docs\` (answer with citations).`,
    `- [HTTP API](${origin}/chat): \`POST\` \`{"question": "..."}\` → \`{answer, sources[]}\`. Streams at \`${origin}/chat/stream\`.`,
    "",
    "## Indexed pages",
    "",
  ];

  // Un documento sin URL viene de markdown suelto: no hay adónde enlazar,
  // pero omitirlo mentiría sobre lo que el asistente sabe.
  for (const doc of documents) {
    const name = doc.title?.trim() || doc.url || "Untitled";
    lines.push(doc.url ? `- [${name}](${doc.url})` : `- ${name}`);
  }

  return `${lines.join("\n")}\n`;
}

// Detrás de un proxy que termina TLS (Railway, Fly, cualquier ingress) la
// petición llega en claro y c.req.url dice "http://", así que los enlaces
// publicados saldrían con el esquema equivocado. A diferencia de
// x-forwarded-for —que sí va detrás de TRUST_PROXY porque falsearlo salta el
// rate limit— falsear esto solo estropea los enlaces que ve quien lo falsea.
export function publicOrigin(url: string, forwardedProto?: string): string {
  const origin = new URL(url);
  const proto = forwardedProto?.split(",")[0]?.trim();
  if (proto) origin.protocol = `${proto}:`;
  return origin.origin;
}

export const llmsRoute = new Hono();

llmsRoute.get("/llms.txt", async (c) => {
  const { rows } = await getPool().query<IndexedDocument>(
    "SELECT title, url FROM documents ORDER BY title NULLS LAST, url",
  );

  const title = process.env.LLMS_TXT_TITLE?.trim() || DEFAULT_TITLE;
  const origin = publicOrigin(c.req.url, c.req.header("x-forwarded-proto"));
  const body = buildLlmsTxt(origin, title, rows);

  return c.body(body, 200, { "Content-Type": "text/plain; charset=utf-8" });
});
