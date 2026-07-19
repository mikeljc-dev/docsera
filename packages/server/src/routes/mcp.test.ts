import { test, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { serve } from "@hono/node-server";
import { mcpRoute } from "./mcp.js";
import { setPool } from "../lib/db.js";
import { setChatAdapter, setEmbeddingsAdapter } from "../llm/index.js";
import { fakeChatAdapter, fakeEmbeddingsAdapter, fakePool } from "../testing/doubles.js";

// A diferencia del resto de rutas, /mcp no se puede ejercer con route.fetch():
// el transporte del SDK escribe sobre el req/res crudos de Node y devuelve
// RESPONSE_ALREADY_SENT, así que necesita un servidor de verdad. Se levanta en
// un puerto libre para no chocar con nada.
let server: ReturnType<typeof serve>;
let baseUrl: string;

before(async () => {
  server = serve({ fetch: mcpRoute.fetch, port: 0 });
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

const CHUNK = {
  id: "11111111-1111-1111-1111-111111111111",
  content: "Docsera is AGPL-3.0.",
  anchor: "license",
  url: "https://docs.example.com/",
  title: "Docs",
};

function poolWith(rows = [CHUNK]) {
  return fakePool([
    { match: /FROM conversations/i, rows: [] },
    { match: /FROM chunks/i, rows },
    { match: /INSERT INTO conversations/i, rows: [{ id: "22222222-2222-2222-2222-222222222222" }] },
  ]);
}

async function rpc(method: string, params?: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return (await response.json()) as Record<string, unknown>;
}

beforeEach(() => {
  setEmbeddingsAdapter(fakeEmbeddingsAdapter());
});

afterEach(() => {
  setPool(undefined);
  setChatAdapter(undefined);
  setEmbeddingsAdapter(undefined);
});

test("anuncia las dos tools con sus esquemas", async () => {
  const body = await rpc("tools/list");
  const tools = (body["result"] as { tools: { name: string; inputSchema: unknown }[] }).tools;

  assert.deepEqual(tools.map((t) => t.name).sort(), ["ask_docs", "search_docs"]);
  for (const tool of tools) {
    assert.equal((tool.inputSchema as { type: string }).type, "object");
  }
});

test("search_docs recupera sin gastar una llamada al LLM", async () => {
  setPool(poolWith());
  setChatAdapter({
    chat: () => Promise.reject(new Error("search_docs no debe llamar al LLM")),
  });

  const body = await rpc("tools/call", { name: "search_docs", arguments: { query: "license" } });
  const text = (body["result"] as { content: { text: string }[] }).content[0]?.text ?? "";

  assert.match(text, /Docsera is AGPL-3\.0\./);
  assert.match(text, /https:\/\/docs\.example\.com\/#license/);
});

test("ask_docs responde con las fuentes al final", async () => {
  setPool(poolWith());
  setChatAdapter(fakeChatAdapter("Docsera uses the AGPL-3.0 license."));

  const body = await rpc("tools/call", { name: "ask_docs", arguments: { question: "license?" } });
  const text = (body["result"] as { content: { text: string }[] }).content[0]?.text ?? "";

  assert.match(text, /Docsera uses the AGPL-3\.0 license\./);
  assert.match(text, /Sources:/);
  assert.match(text, /https:\/\/docs\.example\.com\//);
});

test("search_docs sin coincidencias lo dice, no inventa", async () => {
  setPool(poolWith([]));

  const body = await rpc("tools/call", { name: "search_docs", arguments: { query: "nada" } });
  const text = (body["result"] as { content: { text: string }[] }).content[0]?.text ?? "";

  assert.match(text, /No matching sections/);
});

test("una tool desconocida se marca como error, no revienta", async () => {
  const body = await rpc("tools/call", { name: "no_existe", arguments: {} });
  const result = body["result"] as { isError: boolean; content: { text: string }[] };

  assert.equal(result.isError, true);
  assert.match(result.content[0]?.text ?? "", /Unknown tool/);
});

test("un fallo interno no filtra el detalle al cliente MCP", async () => {
  setPool(poolWith());
  setChatAdapter({ chat: () => Promise.reject(new Error("API key inválida: sk-secreto")) });

  const body = await rpc("tools/call", { name: "ask_docs", arguments: { question: "x" } });
  const result = body["result"] as { isError: boolean; content: { text: string }[] };

  assert.equal(result.isError, true);
  assert.doesNotMatch(result.content[0]?.text ?? "", /sk-secreto/);
});

test("GET y DELETE responden 405: el servidor es stateless", async () => {
  for (const method of ["GET", "DELETE"]) {
    const response = await fetch(`${baseUrl}/mcp`, { method });
    assert.equal(response.status, 405);
  }
});
