import { test } from "node:test";
import assert from "node:assert/strict";
import { loadVisibleHistory } from "./publicHistory.js";
import { fakePool } from "../testing/doubles.js";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";

test("reconstruye un turno respondido con sus fuentes deduplicadas", async () => {
  const pool = fakePool([
    {
      match: /FROM conversations/i,
      rows: [
        {
          id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          question: "What license?",
          answer: "AGPL-3.0.",
          answered: true,
          feedback: 1,
        },
      ],
    },
    {
      match: /FROM conversation_sources/i,
      rows: [
        {
          conversation_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          url: "https://docs.example.com/",
          title: "Docs",
          anchor: "license",
        },
        {
          conversation_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          url: "https://docs.example.com/",
          title: "Docs",
          anchor: "license",
        },
      ],
    },
  ]);

  const turns = await loadVisibleHistory(pool, SESSION_ID);

  assert.equal(turns.length, 1);
  assert.equal(turns[0]?.question, "What license?");
  assert.equal(turns[0]?.answer, "AGPL-3.0.");
  assert.equal(turns[0]?.answered, true);
  assert.equal(turns[0]?.feedback, "up");
  assert.deepEqual(turns[0]?.sources, [
    { url: "https://docs.example.com/", title: "Docs", anchor: "license" },
  ]);
});

test("un turno sin respuesta se conserva (el usuario lo vio en pantalla)", async () => {
  const pool = fakePool([
    {
      match: /FROM conversations/i,
      rows: [
        {
          id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          question: "Off topic",
          answer: "I don't know.",
          answered: false,
          feedback: null,
        },
      ],
    },
    { match: /FROM conversation_sources/i, rows: [] },
  ]);

  const turns = await loadVisibleHistory(pool, SESSION_ID);

  assert.equal(turns.length, 1);
  assert.equal(turns[0]?.answered, false);
  assert.equal(turns[0]?.feedback, null);
  assert.deepEqual(turns[0]?.sources, []);
});

test("sin conversaciones en la ventana, devuelve vacío", async () => {
  const pool = fakePool([{ match: /FROM conversations/i, rows: [] }]);

  const turns = await loadVisibleHistory(pool, SESSION_ID);

  assert.deepEqual(turns, []);
});

test("devuelve los turnos en orden cronológico, no el de llegada de la consulta", async () => {
  const pool = fakePool([
    {
      // La consulta pide DESC (más reciente primero); la función debe
      // devolverlos en orden de conversación (más antiguo primero).
      match: /FROM conversations/i,
      rows: [
        {
          id: "22222222-2222-2222-2222-222222222222",
          question: "Segunda pregunta",
          answer: "Segunda respuesta",
          answered: true,
          feedback: null,
        },
        {
          id: "11111111-1111-1111-1111-111111111112",
          question: "Primera pregunta",
          answer: "Primera respuesta",
          answered: true,
          feedback: null,
        },
      ],
    },
    { match: /FROM conversation_sources/i, rows: [] },
  ]);

  const turns = await loadVisibleHistory(pool, SESSION_ID);

  assert.deepEqual(
    turns.map((t) => t.question),
    ["Primera pregunta", "Segunda pregunta"],
  );
});
