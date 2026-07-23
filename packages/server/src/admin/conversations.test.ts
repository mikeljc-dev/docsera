import { test } from "node:test";
import assert from "node:assert/strict";
import { listConversations } from "./conversations.js";
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
