import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import { ingestRoute } from "./ingest.js";
import { setPool } from "../lib/db.js";
import { setEmbeddingsAdapter } from "../llm/index.js";
import { fakeEmbeddingsAdapter } from "../testing/doubles.js";
import { setupTestDb, TEST_DIMENSIONS, testDatabaseUrl, truncateAll } from "../testing/db.js";

// Ejercen /ingest contra Postgres real: el pool falso no valida el INSERT de
// documentos/chunks ni el dedup por hash. Sin TEST_DATABASE_URL se saltan.
const skip = testDatabaseUrl() ? false : "requiere TEST_DATABASE_URL";
const ADMIN = "test-admin-token";

let pool: Pool;

before(async () => {
  if (skip) return;
  pool = await setupTestDb("test_ingest_route");
});

after(async () => {
  if (skip) return;
  await pool.end();
  setPool(undefined);
  setEmbeddingsAdapter(undefined);
  delete process.env.ADMIN_TOKEN;
});

beforeEach(async () => {
  if (skip) return;
  await truncateAll(pool);
  setPool(pool);
  setEmbeddingsAdapter(fakeEmbeddingsAdapter(TEST_DIMENSIONS));
  process.env.ADMIN_TOKEN = ADMIN;
});

async function post(body: unknown, token = ADMIN): Promise<Response> {
  return ingestRoute.fetch(
    new Request("http://localhost/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }),
  );
}

const DOC = {
  type: "markdown",
  title: "Guide",
  source:
    "# Guide\n\nDocsera is licensed under AGPL-3.0.\n\n## Install\n\nRuns with Docker in under 10 minutes.",
};

test("ingiere markdown y persiste documento + chunks con embeddings", { skip }, async () => {
  const res = await post(DOC);
  assert.equal(res.status, 200);
  const body = (await res.json()) as { documents: { status: string; chunks: number }[] };
  assert.equal(body.documents[0]?.status, "created");
  assert.ok((body.documents[0]?.chunks ?? 0) > 0);

  // El SQL real dejó filas: un documento y sus chunks, todos con vector.
  const docs = await pool.query("SELECT id FROM documents");
  assert.equal(docs.rowCount, 1);
  const chunks = await pool.query<{ embedding: unknown }>("SELECT embedding FROM chunks");
  assert.ok((chunks.rowCount ?? 0) > 0);
  assert.ok(chunks.rows.every((row) => row.embedding !== null));
});

test("re-ingerir el mismo markdown no duplica: status unchanged", { skip }, async () => {
  await post(DOC);
  const res = await post(DOC);
  const body = (await res.json()) as { documents: { status: string }[] };
  assert.equal(body.documents[0]?.status, "unchanged");
  assert.equal((await pool.query("SELECT id FROM documents")).rowCount, 1);
});

test("un token inválido responde 401 y no escribe en la BD", { skip }, async () => {
  const res = await post(DOC, "token-equivocado");
  assert.equal(res.status, 401);
  assert.equal((await pool.query("SELECT id FROM documents")).rowCount, 0);
});
