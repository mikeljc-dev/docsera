import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifySlackSignature } from "./verify.js";

const SECRET = "test-signing-secret";

function sign(timestamp: string, body: string): string {
  return "v0=" + createHmac("sha256", SECRET).update(`v0:${timestamp}:${body}`).digest("hex");
}

test("acepta una firma válida con timestamp actual", () => {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = "command=/ask&text=hola";
  assert.equal(verifySlackSignature(SECRET, timestamp, body, sign(timestamp, body)), true);
});

test("rechaza un body manipulado", () => {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = "command=/ask&text=hola";
  const signature = sign(timestamp, body);
  assert.equal(verifySlackSignature(SECRET, timestamp, "command=/ask&text=otra", signature), false);
});

test("rechaza un timestamp con más de 5 minutos de diferencia (protección de replay)", () => {
  const staleTimestamp = String(Math.floor(Date.now() / 1000) - 6 * 60);
  const body = "command=/ask&text=hola";
  assert.equal(verifySlackSignature(SECRET, staleTimestamp, body, sign(staleTimestamp, body)), false);
});

test("un timestamp no numérico es firma inválida, no un error", () => {
  assert.equal(verifySlackSignature(SECRET, "no-es-un-numero", "body", "v0=deadbeef"), false);
});

test("una firma de longitud distinta es inválida sin comparar", () => {
  const timestamp = String(Math.floor(Date.now() / 1000));
  assert.equal(verifySlackSignature(SECRET, timestamp, "body", "v0=corta"), false);
});
