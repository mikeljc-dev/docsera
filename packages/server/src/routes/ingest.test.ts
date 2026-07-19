import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { ingestRoute } from "./ingest.js";

const TOKEN = "token-de-prueba";

async function post(body: unknown, authorization?: string): Promise<Response> {
  return ingestRoute.fetch(
    new Request("http://localhost/ingest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authorization ? { Authorization: authorization } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}

afterEach(() => {
  delete process.env.ADMIN_TOKEN;
});

test("sin cabecera Authorization responde 401", async () => {
  process.env.ADMIN_TOKEN = TOKEN;

  const response = await post({ type: "markdown", source: "# Hola" });

  assert.equal(response.status, 401);
  assert.match(((await response.json()) as { error: string }).error, /No autorizado/);
});

test("con un token que no es el correcto responde 401", async () => {
  process.env.ADMIN_TOKEN = TOKEN;

  for (const header of ["Bearer otro-token", "Bearer ", TOKEN, "Basic " + TOKEN]) {
    const response = await post({ type: "markdown", source: "# Hola" }, header);
    assert.equal(response.status, 401, `debería rechazar: ${header}`);
  }
});

test("sin ADMIN_TOKEN configurado el endpoint queda cerrado, no abierto", async () => {
  delete process.env.ADMIN_TOKEN;

  const response = await post({ type: "markdown", source: "# Hola" }, `Bearer ${TOKEN}`);

  // 500, no 200: un servidor mal configurado no debe dejar ingerir a nadie.
  assert.equal(response.status, 500);
});

test("autenticado pero con body inválido responde 400, no 401", async () => {
  process.env.ADMIN_TOKEN = TOKEN;

  const response = await post({ type: "formato-inexistente" }, `Bearer ${TOKEN}`);

  assert.equal(response.status, 400);
});
