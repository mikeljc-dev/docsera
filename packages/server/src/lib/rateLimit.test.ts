import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRateLimiter } from "./rateLimit.js";

// El almacén de buckets es compartido a nivel de módulo (una sola instancia
// vive en producción), así que cada test usa una key única para no
// interferir con las demás.

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("permite peticiones hasta el límite", () => {
  const allow = createRateLimiter(3, 60_000);
  const key = randomUUID();
  assert.equal(allow(key), true);
  assert.equal(allow(key), true);
  assert.equal(allow(key), true);
});

test("bloquea al superar el límite dentro de la ventana", () => {
  const allow = createRateLimiter(2, 60_000);
  const key = randomUUID();
  assert.equal(allow(key), true);
  assert.equal(allow(key), true);
  assert.equal(allow(key), false);
});

test("claves distintas tienen contadores independientes", () => {
  const allow = createRateLimiter(1, 60_000);
  const keyA = randomUUID();
  const keyB = randomUUID();
  assert.equal(allow(keyA), true);
  assert.equal(allow(keyB), true);
  assert.equal(allow(keyA), false);
});

test("el contador se reinicia pasada la ventana", async () => {
  const allow = createRateLimiter(1, 50);
  const key = randomUUID();
  assert.equal(allow(key), true);
  assert.equal(allow(key), false);
  await delay(80);
  assert.equal(allow(key), true);
});
