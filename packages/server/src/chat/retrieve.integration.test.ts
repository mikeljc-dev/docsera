import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import { retrieveRelevantChunks } from "./retrieve.js";
import { seedDocument, setupTestDb, testDatabaseUrl, truncateAll } from "../testing/db.js";

// Estos tests ejercen el SQL real (pgvector + full-text + RRF), que es
// justo lo que un pool falso no puede validar. Sin TEST_DATABASE_URL se
// saltan; CI la define siempre.
const skip = testDatabaseUrl() ? false : "requiere TEST_DATABASE_URL";

let pool: Pool;

before(async () => {
  if (skip) return;
  pool = await setupTestDb("test_retrieve");
});

after(async () => {
  if (skip) return;
  await pool.end();
});

beforeEach(async () => {
  if (skip) return;
  await truncateAll(pool);
  delete process.env.CHAT_MAX_DISTANCE;
});

test("la rama vectorial encuentra el chunk más cercano", { skip }, async () => {
  await seedDocument(pool, {
    url: "https://docs.example.com/a",
    title: "Doc A",
    chunks: [
      { content: "Contenido cercano", embedding: [1, 0, 0], anchor: "cerca" },
      { content: "Contenido lejano", embedding: [0, 1, 0], anchor: "lejos" },
    ],
  });

  const chunks = await retrieveRelevantChunks(pool, [1, 0, 0], "algo que el texto no contiene");

  assert.equal(chunks[0]?.anchor, "cerca");
  assert.equal(chunks[0]?.url, "https://docs.example.com/a");
});

test("la rama full-text caza un término exacto que el vector no acerca", { skip }, async () => {
  await seedDocument(pool, {
    url: "https://docs.example.com/config",
    title: "Config",
    chunks: [
      { content: "Ajusta CHAT_MAX_DISTANCE para el umbral.", embedding: [0, 0, 1], anchor: "vars" },
      { content: "Texto sin relación.", embedding: [1, 0, 0], anchor: "otro" },
    ],
  });

  // El embedding apunta al chunk equivocado: si aparece el correcto es
  // porque la rama de texto lo ha traído.
  const chunks = await retrieveRelevantChunks(pool, [1, 0, 0], "CHAT_MAX_DISTANCE");

  assert.ok(
    chunks.some((chunk) => chunk.anchor === "vars"),
    "el chunk con el nombre de variable debería estar entre los resultados",
  );
});

test("sin coincidencia en ninguna rama no devuelve nada (y no se llama al LLM)", { skip }, async () => {
  process.env.CHAT_MAX_DISTANCE = "0.1";
  await seedDocument(pool, {
    url: "https://docs.example.com/a",
    title: "Doc A",
    chunks: [{ content: "Algo completamente distinto", embedding: [0, 1, 0], anchor: "x" }],
  });

  const chunks = await retrieveRelevantChunks(pool, [1, 0, 0], "zzzz-inexistente");

  assert.deepEqual(chunks, []);
});

test("el umbral de distancia descarta lo lejano", { skip }, async () => {
  await seedDocument(pool, {
    url: "https://docs.example.com/a",
    title: "Doc A",
    chunks: [{ content: "Opuesto", embedding: [-1, 0, 0], anchor: "opuesto" }],
  });

  process.env.CHAT_MAX_DISTANCE = "0.5";
  assert.deepEqual(await retrieveRelevantChunks(pool, [1, 0, 0], "sin coincidencia lexica"), []);

  process.env.CHAT_MAX_DISTANCE = "2";
  const sinFiltro = await retrieveRelevantChunks(pool, [1, 0, 0], "sin coincidencia lexica");
  assert.equal(sinFiltro[0]?.anchor, "opuesto");
});

test("respeta el límite y no repite un chunk hallado por las dos ramas", { skip }, async () => {
  await seedDocument(pool, {
    url: "https://docs.example.com/a",
    title: "Doc A",
    chunks: [
      { content: "pgvector y embeddings", embedding: [1, 0, 0], anchor: "uno" },
      { content: "pgvector otra vez", embedding: [0.9, 0.1, 0], anchor: "dos" },
      { content: "pgvector una tercera", embedding: [0.8, 0.2, 0], anchor: "tres" },
    ],
  });

  const chunks = await retrieveRelevantChunks(pool, [1, 0, 0], "pgvector", 2);

  assert.equal(chunks.length, 2);
  assert.equal(new Set(chunks.map((c) => c.id)).size, 2, "no debería repetir chunks");
});

test("la columna tsv se genera sola al insertar", { skip }, async () => {
  await seedDocument(pool, {
    url: null,
    title: "Sin URL",
    chunks: [{ content: "supercalifragilistico", embedding: [0, 0, 1] }],
  });

  const { rows } = await pool.query<{ n: string }>(
    "SELECT count(*) AS n FROM chunks WHERE tsv @@ websearch_to_tsquery('simple', 'supercalifragilistico')",
  );

  assert.equal(rows[0]?.n, "1");
});
