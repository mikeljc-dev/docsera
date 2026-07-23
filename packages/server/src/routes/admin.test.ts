import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { adminRoute } from "./admin.js";
import { setPool } from "../lib/db.js";
import { fakePool } from "../testing/doubles.js";

const TOKEN = "token-de-prueba";

async function get(path: string, authorization?: string): Promise<Response> {
  return adminRoute.fetch(
    new Request(`http://localhost${path}`, {
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
