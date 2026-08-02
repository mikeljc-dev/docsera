import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import { chatRoute } from "./chat.js";
import { setPool } from "../lib/db.js";
import { setChatAdapter, setEmbeddingsAdapter } from "../llm/index.js";
import type { EmbeddingsAdapter } from "../llm/types.js";
import { fakeChatAdapter, fakeConnEnv } from "../testing/doubles.js";
import { seedDocument, setupTestDb, testDatabaseUrl, truncateAll } from "../testing/db.js";

// Ejercen /chat contra Postgres real: recuperación (pgvector + full-text +
// RRF) e INSERT de la conversación y sus fuentes, que el pool falso no valida.
const skip = testDatabaseUrl() ? false : "requiere TEST_DATABASE_URL";

let pool: Pool;

// Embeddings deterministas de 3 dims: la pregunta apunta al vector que le
// digamos, para controlar qué chunk gana en la rama vectorial.
function fixedEmbeddings(vector: number[]): EmbeddingsAdapter {
  return { embed: (texts: string[]) => Promise.resolve(texts.map(() => vector)) };
}

before(async () => {
  if (skip) return;
  pool = await setupTestDb("test_chat_route");
});

after(async () => {
  if (skip) return;
  await pool.end();
  setPool(undefined);
  setChatAdapter(undefined);
  setEmbeddingsAdapter(undefined);
});

beforeEach(async () => {
  if (skip) return;
  await truncateAll(pool);
  setPool(pool);
  delete process.env.CHAT_NO_ANSWER_TEXT;
});

async function post(body: unknown): Promise<Response> {
  return chatRoute.fetch(
    new Request("http://localhost/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    fakeConnEnv(`10.9.0.${Math.floor(Math.random() * 250) + 1}`),
  );
}

test("responde con fuentes y persiste la conversación con sus fuentes", { skip }, async () => {
  await seedDocument(pool, {
    url: "https://docs.example.com/license",
    title: "License",
    chunks: [
      { content: "Docsera is licensed under AGPL-3.0.", embedding: [1, 0, 0], anchor: "license" },
      { content: "Unrelated text about something else.", embedding: [0, 1, 0], anchor: "other" },
    ],
  });
  setEmbeddingsAdapter(fixedEmbeddings([1, 0, 0]));
  setChatAdapter(fakeChatAdapter("Docsera uses the AGPL-3.0 license."));

  const res = await post({ question: "What license?" });
  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    answered: boolean;
    sources: { anchor: string }[];
    conversationId: string;
  };
  assert.equal(body.answered, true);
  assert.equal(body.sources[0]?.anchor, "license");

  // El INSERT real ocurrió: la conversación existe con answered=true y sus
  // fuentes quedaron enlazadas en conversation_sources.
  const convo = await pool.query<{ answered: boolean }>(
    "SELECT answered FROM conversations WHERE id = $1",
    [body.conversationId],
  );
  assert.equal(convo.rowCount, 1);
  assert.equal(convo.rows[0]?.answered, true);
  const linked = await pool.query("SELECT chunk_id FROM conversation_sources WHERE conversation_id = $1", [
    body.conversationId,
  ]);
  assert.ok((linked.rowCount ?? 0) > 0);
});

test("sin cobertura persiste la no-respuesta sin fuentes ni llamada al LLM", { skip }, async () => {
  // Sin chunks sembrados la recuperación vuelve vacía: no se debe llamar al LLM.
  setEmbeddingsAdapter(fixedEmbeddings([1, 0, 0]));
  setChatAdapter({ chat: () => Promise.reject(new Error("el LLM no debería llamarse")) });

  const res = await post({ question: "Algo que no está documentado" });
  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    answered: boolean;
    sources: unknown[];
    conversationId: string;
  };
  assert.equal(body.answered, false);
  assert.deepEqual(body.sources, []);
  const linked = await pool.query("SELECT chunk_id FROM conversation_sources WHERE conversation_id = $1", [
    body.conversationId,
  ]);
  assert.equal(linked.rowCount, 0);
});
