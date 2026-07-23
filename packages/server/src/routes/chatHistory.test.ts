import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { chatHistoryRoute } from "./chatHistory.js";
import { setPool } from "../lib/db.js";
import { fakeConnEnv, fakePool } from "../testing/doubles.js";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";

async function get(sessionId?: string): Promise<Response> {
  const url = sessionId
    ? `http://localhost/chat/history?sessionId=${sessionId}`
    : "http://localhost/chat/history";
  return chatHistoryRoute.fetch(
    new Request(url),
    fakeConnEnv(`10.2.0.${Math.floor(Math.random() * 250) + 1}`),
  );
}

afterEach(() => {
  setPool(undefined);
});

test("devuelve los turnos con sus fuentes", async () => {
  setPool(
    fakePool([
      {
        match: /FROM conversations/i,
        rows: [
          {
            id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            question: "What license?",
            answer: "AGPL-3.0.",
            answered: true,
            feedback: null,
          },
        ],
      },
      { match: /FROM conversation_sources/i, rows: [] },
    ]),
  );

  const response = await get(SESSION_ID);
  assert.equal(response.status, 200);

  const body = (await response.json()) as { turns: unknown[] };
  assert.equal(body.turns.length, 1);
});

test("un sessionId que no es UUID responde 400, sin tocar la base de datos", async () => {
  setPool({
    query: () => Promise.reject(new Error("no debería llegar aquí")),
  } as never);

  const response = await get("no-soy-un-uuid");
  assert.equal(response.status, 400);
});

test("sin sessionId responde 400", async () => {
  const response = await get();
  assert.equal(response.status, 400);
});

test("una sesión válida pero sin conversaciones responde 200 con lista vacía (no distingue de una inválida)", async () => {
  setPool(fakePool([{ match: /FROM conversations/i, rows: [] }]));

  const response = await get(SESSION_ID);
  assert.equal(response.status, 200);

  const body = (await response.json()) as { turns: unknown[] };
  assert.deepEqual(body.turns, []);
});

test("un fallo interno no filtra el detalle al cliente", async () => {
  setPool({
    query: () => Promise.reject(new Error("connection string leaked: postgres://...")),
  } as never);

  const response = await get(SESSION_ID);
  assert.equal(response.status, 500);

  const body = (await response.json()) as { error: string };
  assert.doesNotMatch(body.error, /postgres:\/\//);
});
