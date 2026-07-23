import { test } from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import { deleteConversation, listConversations } from "./conversations.js";
import { fakePool } from "../testing/doubles.js";

function poolWith(rows: unknown[], total = rows.length) {
  return fakePool([
    { match: /SELECT c\.id/, rows: rows as never[] },
    { match: /SELECT count\(\*\)/, rows: [{ count: String(total) }] },
  ]);
}

test("devuelve las conversaciones con sus fuentes deduplicadas", async () => {
  const pool = poolWith([
    {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      session_id: "11111111-1111-4111-8111-111111111111",
      question: "What license?",
      answer: "AGPL-3.0.",
      answered: true,
      feedback: 1,
      created_at: "2026-07-23T00:00:00.000Z",
      sources: [
        { url: "https://docs.example.com/", title: "Docs", anchor: "license" },
        { url: "https://docs.example.com/", title: "Docs", anchor: "license" },
      ],
    },
  ]);

  const result = await listConversations(pool, { limit: 25, offset: 0 });

  assert.equal(result.total, 1);
  assert.equal(result.conversations.length, 1);
  assert.deepEqual(result.conversations[0]?.sources, [
    { url: "https://docs.example.com/", title: "Docs", anchor: "license" },
  ]);
});

test("un turno sin fuentes (json_agg vacío por el FILTER) da lista vacía, no [null]", async () => {
  const pool = poolWith([
    {
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      session_id: "11111111-1111-4111-8111-111111111111",
      question: "hola",
      answer: "I don't know.",
      answered: false,
      feedback: null,
      created_at: "2026-07-23T00:00:00.000Z",
      sources: [],
    },
  ]);

  const result = await listConversations(pool, { limit: 25, offset: 0 });

  assert.deepEqual(result.conversations[0]?.sources, []);
});

test("sin resultados, total es 0", async () => {
  const pool = poolWith([], 0);

  const result = await listConversations(pool, { limit: 25, offset: 0 });

  assert.deepEqual(result.conversations, []);
  assert.equal(result.total, 0);
});

// Whitelist de ORDER BY: nunca se compone con el parámetro tal cual (sería
// inyección SQL), así que lo que hay que probar es que cada combinación
// sortBy/sortDir mapea a la cláusula SQL correcta, no una encontrada al azar.
function capturingPool(): { pool: Pool; lastQuery: () => string } {
  // Promise.all() dispara las dos consultas en orden síncrono, pero cuál
  // resuelve/asigna última no está garantizado: se guarda la que de verdad
  // importa (la del listado, con el ORDER BY), no "la última llamada".
  let mainQuery = "";
  const pool = {
    query: (text: string) => {
      if (/SELECT c\.id/.test(text)) {
        mainQuery = text;
        return Promise.resolve({ rows: [], rowCount: 0 });
      }
      return Promise.resolve({ rows: [{ count: "0" }], rowCount: 1 });
    },
  } as unknown as Pool;
  return { pool, lastQuery: () => mainQuery };
}

test("sortBy/sortDir mapean a la cláusula ORDER BY esperada", async () => {
  const cases: [string, string, string][] = [
    ["date", "asc", "c.created_at ASC"],
    ["feedback", "desc", "c.feedback DESC NULLS LAST"],
    ["sources", "asc", "source_count ASC"],
  ];

  for (const [sortBy, sortDir, expected] of cases) {
    const { pool, lastQuery } = capturingPool();
    await listConversations(pool, {
      limit: 10,
      offset: 0,
      sortBy: sortBy as never,
      sortDir: sortDir as never,
    });
    assert.ok(lastQuery().includes(`ORDER BY ${expected}`), `esperaba ${expected}`);
  }
});

test("sin sortBy, ordena por fecha descendente", async () => {
  const { pool, lastQuery } = capturingPool();
  await listConversations(pool, { limit: 10, offset: 0 });
  assert.ok(lastQuery().includes("ORDER BY c.created_at DESC"));
});

test("filtra por sessionId y por fecha desde", async () => {
  const pool = poolWith([]);
  await listConversations(pool, {
    limit: 10,
    offset: 0,
    sessionId: "11111111-1111-4111-8111-111111111111",
    since: "2026-07-01T00:00:00.000Z",
  });
  // No revienta con los filtros puestos; el contrato SQL en sí se prueba a
  // mano contra Postgres real (ver docs/deuda-tecnica.md).
});

test("deleteConversation devuelve true si se borró algo, false si no", async () => {
  const found = { query: () => Promise.resolve({ rows: [], rowCount: 1 }) } as unknown as Pool;
  const notFound = { query: () => Promise.resolve({ rows: [], rowCount: 0 }) } as unknown as Pool;

  assert.equal(await deleteConversation(found, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"), true);
  assert.equal(await deleteConversation(notFound, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"), false);
});
