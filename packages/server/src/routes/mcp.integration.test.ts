import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { serve } from "@hono/node-server";
import type { Pool } from "pg";
import { mcpRoute } from "./mcp.js";
import { setPool } from "../lib/db.js";
import { setChatAdapter, setEmbeddingsAdapter } from "../llm/index.js";
import type { EmbeddingsAdapter } from "../llm/types.js";
import { fakeChatAdapter } from "../testing/doubles.js";
import { seedDocument, setupTestDb, testDatabaseUrl, truncateAll } from "../testing/db.js";

// Ejercen /mcp contra Postgres real: search_docs (retrieval puro) y ask_docs
// (RAG + INSERT de la conversación) pasando por el transporte del SDK, que
// necesita un servidor HTTP de verdad (escribe sobre el req/res crudo).
const skip = testDatabaseUrl() ? false : "requiere TEST_DATABASE_URL";

function fixedEmbeddings(vector: number[]): EmbeddingsAdapter {
  return { embed: (texts: string[]) => Promise.resolve(texts.map(() => vector)) };
}

let pool: Pool;
let server: ReturnType<typeof serve>;
let baseUrl: string;

before(async () => {
  if (skip) return;
  pool = await setupTestDb("test_mcp_route");
  server = serve({ fetch: mcpRoute.fetch, port: 0 });
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  if (skip) return;
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
  setPool(undefined);
  setChatAdapter(undefined);
  setEmbeddingsAdapter(undefined);
});

beforeEach(async () => {
  if (skip) return;
  await truncateAll(pool);
  setPool(pool);
  setEmbeddingsAdapter(fixedEmbeddings([1, 0, 0]));
  await seedDocument(pool, {
    url: "https://docs.example.com/license",
    title: "License",
    chunks: [
      { content: "Docsera is licensed under AGPL-3.0.", embedding: [1, 0, 0], anchor: "license" },
      { content: "Unrelated text about something else.", embedding: [0, 1, 0], anchor: "other" },
    ],
  });
});

async function callTool(name: string, args: unknown): Promise<string> {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  const body = (await response.json()) as { result: { content: { text: string }[] } };
  return body.result.content.map((part) => part.text).join("");
}

test("search_docs recupera el chunk relevante contra la BD real", { skip }, async () => {
  setChatAdapter({ chat: () => Promise.reject(new Error("search_docs no debe llamar al LLM")) });

  const text = await callTool("search_docs", { query: "license", limit: 3 });
  assert.match(text, /AGPL-3\.0/);
  assert.doesNotMatch(text, /Unrelated text/);
});

test("ask_docs responde con fuentes y persiste la conversación", { skip }, async () => {
  setChatAdapter(fakeChatAdapter("Docsera uses the AGPL-3.0 license."));

  const text = await callTool("ask_docs", { question: "What license?" });
  assert.match(text, /AGPL-3\.0 license/);
  assert.match(text, /Sources:/);

  // El RAG por MCP dejó la conversación en la BD (misma ruta que /chat).
  const convo = await pool.query<{ answered: boolean }>(
    "SELECT answered FROM conversations WHERE answered = true",
  );
  assert.ok((convo.rowCount ?? 0) >= 1);
});
