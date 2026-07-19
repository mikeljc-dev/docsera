import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { verifyDiscordSignature } from "./verify.js";

// La clave pública "cruda" que muestra el portal de Discord son los últimos
// 32 bytes del SPKI/DER.
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const publicKeyHex = (publicKey.export({ format: "der", type: "spki" }) as Buffer)
  .subarray(-32)
  .toString("hex");

const timestamp = "1700000000";
const body = '{"type":1}';
const signatureHex = sign(null, Buffer.from(timestamp + body, "utf-8"), privateKey).toString("hex");

test("acepta una firma válida", () => {
  assert.equal(verifyDiscordSignature(publicKeyHex, timestamp, body, signatureHex), true);
});

test("rechaza un body manipulado", () => {
  assert.equal(verifyDiscordSignature(publicKeyHex, timestamp, '{"type":2}', signatureHex), false);
});

test("rechaza un timestamp manipulado", () => {
  assert.equal(verifyDiscordSignature(publicKeyHex, "1700000001", body, signatureHex), false);
});

test("clave o firma malformadas cuentan como firma inválida, no como error", () => {
  assert.equal(verifyDiscordSignature("no-es-hex", timestamp, body, signatureHex), false);
  assert.equal(verifyDiscordSignature(publicKeyHex, timestamp, body, "abc123"), false);
  assert.equal(verifyDiscordSignature("", timestamp, body, ""), false);
});
