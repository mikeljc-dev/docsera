import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { adminRoute } from "./admin.js";
import { setPool } from "../lib/db.js";
import { fakePool } from "../testing/doubles.js";

const TOKEN = "token-de-prueba";
const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

async function get(path: string, authorization?: string): Promise<Response> {
  return adminRoute.fetch(
    new Request(`http://localhost${path}`, {
      headers: authorization ? { Authorization: authorization } : {},
    }),
  );
}

async function del(path: string, authorization?: string): Promise<Response> {
  return adminRoute.fetch(
    new Request(`http://localhost${path}`, {
      method: "DELETE",
      headers: authorization ? { Authorization: authorization } : {},
    }),
  );
}

afterEach(() => {
  delete process.env.ADMIN_TOKEN;
  setPool(undefined);
});

test("sin cabecera Authorization responde 401", async () => {
  process.env.ADMIN_TOKEN = TOKEN;

  const response = await get("/admin/conversations");
  assert.equal(response.status, 401);
});

test("autenticado, devuelve la lista de conversaciones", async () => {
  process.env.ADMIN_TOKEN = TOKEN;
  setPool(
    fakePool([
      { match: /SELECT c\.id/, rows: [] },
      { match: /SELECT count\(\*\)/, rows: [{ count: "0" }] },
    ]),
  );

  const response = await get("/admin/conversations", `Bearer ${TOKEN}`);
  assert.equal(response.status, 200);

  const body = (await response.json()) as { conversations: unknown[]; total: number };
  assert.deepEqual(body.conversations, []);
  assert.equal(body.total, 0);
});

test("un texto de búsqueda demasiado largo responde 400", async () => {
  process.env.ADMIN_TOKEN = TOKEN;

  const response = await get(`/admin/conversations?search=${"x".repeat(201)}`, `Bearer ${TOKEN}`);
  assert.equal(response.status, 400);
});

test("acepta el filtro de búsqueda", async () => {
  process.env.ADMIN_TOKEN = TOKEN;
  setPool(
    fakePool([
      { match: /SELECT c\.id/, rows: [] },
      { match: /SELECT count\(\*\)/, rows: [{ count: "0" }] },
    ]),
  );

  const response = await get("/admin/conversations?search=ollama", `Bearer ${TOKEN}`);
  assert.equal(response.status, 200);
});

test("un sessionId que no es UUID responde 400", async () => {
  process.env.ADMIN_TOKEN = TOKEN;

  const response = await get("/admin/conversations?sessionId=no-es-un-uuid", `Bearer ${TOKEN}`);
  assert.equal(response.status, 400);
});

test("un since que no es fecha ISO responde 400", async () => {
  process.env.ADMIN_TOKEN = TOKEN;

  const response = await get("/admin/conversations?since=ayer", `Bearer ${TOKEN}`);
  assert.equal(response.status, 400);
});

test("un sortBy fuera de la lista permitida responde 400", async () => {
  process.env.ADMIN_TOKEN = TOKEN;

  const response = await get("/admin/conversations?sortBy=question", `Bearer ${TOKEN}`);
  assert.equal(response.status, 400);
});

test("acepta sessionId, since y sortBy válidos", async () => {
  process.env.ADMIN_TOKEN = TOKEN;
  setPool(
    fakePool([
      { match: /SELECT c\.id/, rows: [] },
      { match: /SELECT count\(\*\)/, rows: [{ count: "0" }] },
    ]),
  );

  const response = await get(
    `/admin/conversations?sessionId=${ID}&since=2026-07-01T00:00:00Z&sortBy=feedback&sortDir=asc`,
    `Bearer ${TOKEN}`,
  );
  assert.equal(response.status, 200);
});

test("DELETE sin cabecera Authorization responde 401", async () => {
  process.env.ADMIN_TOKEN = TOKEN;

  const response = await del(`/admin/conversations/${ID}`);
  assert.equal(response.status, 401);
});

test("DELETE con un id que no es UUID responde 400", async () => {
  process.env.ADMIN_TOKEN = TOKEN;

  const response = await del("/admin/conversations/no-es-un-uuid", `Bearer ${TOKEN}`);
  assert.equal(response.status, 400);
});

test("DELETE de una conversación que no existe responde 404", async () => {
  process.env.ADMIN_TOKEN = TOKEN;
  setPool(fakePool([{ match: /DELETE FROM conversations/, rows: [], rowCount: 0 }]));

  const response = await del(`/admin/conversations/${ID}`, `Bearer ${TOKEN}`);
  assert.equal(response.status, 404);
});

test("DELETE de una conversación existente responde ok", async () => {
  process.env.ADMIN_TOKEN = TOKEN;
  setPool(fakePool([{ match: /DELETE FROM conversations/, rows: [], rowCount: 1 }]));

  const response = await del(`/admin/conversations/${ID}`, `Bearer ${TOKEN}`);
  assert.equal(response.status, 200);

  const body = (await response.json()) as { ok: boolean };
  assert.equal(body.ok, true);
});

test("stats acepta un rango de días válido", async () => {
  process.env.ADMIN_TOKEN = TOKEN;
  setPool(
    fakePool([
      { match: /count\(\*\) FILTER \(WHERE answered\)/, rows: [{ total: 0, answered: 0, up: 0, down: 0 }] },
    ]),
  );

  const response = await get("/admin/stats?days=7", `Bearer ${TOKEN}`);
  assert.equal(response.status, 200);
});

test("stats rechaza un rango de días no numérico", async () => {
  process.env.ADMIN_TOKEN = TOKEN;

  const response = await get("/admin/stats?days=abc", `Bearer ${TOKEN}`);
  assert.equal(response.status, 400);
});

test("stats rechaza un rango de días fuera de límite", async () => {
  process.env.ADMIN_TOKEN = TOKEN;

  const response = await get("/admin/stats?days=999", `Bearer ${TOKEN}`);
  assert.equal(response.status, 400);
});
