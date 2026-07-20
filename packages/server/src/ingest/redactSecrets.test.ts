import { test } from "node:test";
import assert from "node:assert/strict";
import { redactSecrets } from "./redactSecrets.js";

test("enmascara una clave de GitHub y cuenta 1 redacción", () => {
  const { text, count } = redactSecrets("token: ghp_" + "a".repeat(36));
  assert.equal(count, 1);
  assert.match(text, /\[REDACTED:github-token\]/);
  assert.ok(!text.includes("ghp_"));
});

test("enmascara un Access Key ID de AWS", () => {
  const { text, count } = redactSecrets("AKIAABCDEFGHIJKLMNOP");
  assert.equal(count, 1);
  assert.match(text, /\[REDACTED:aws-access-key-id\]/);
});

test("enmascara un bloque de clave privada completo", () => {
  const key = "-----BEGIN RSA PRIVATE KEY-----\nMIIBAAKC...\n-----END RSA PRIVATE KEY-----";
  const { text, count } = redactSecrets(`before\n${key}\nafter`);
  assert.equal(count, 1);
  assert.match(text, /\[REDACTED:private-key\]/);
  assert.ok(text.includes("before") && text.includes("after"));
});

test("una clave sk_test_ de Stripe (segura de publicar) NO se toca", () => {
  const { text, count } = redactSecrets("sk_test_" + "b".repeat(24));
  assert.equal(count, 0);
  assert.ok(text.includes("sk_test_"));
});

test("enmascara una tarjeta Visa válida (Luhn) con espacios", () => {
  const { text, count } = redactSecrets("card: 4242 4242 4242 4242");
  assert.equal(count, 1);
  assert.match(text, /\[REDACTED:card-number\]/);
});

test("no enmascara una tira de dígitos que falla Luhn", () => {
  const { text, count } = redactSecrets("order id: 4242 4242 4242 4241");
  assert.equal(count, 0);
  assert.ok(text.includes("4242 4242 4242 4241"));
});

test("no enmascara un ISBN-13 aunque tenga la longitud de una tarjeta", () => {
  // 978-3-16-148410-0: pasa la longitud (13) pero no el prefijo de red ni Luhn.
  const { text, count } = redactSecrets("ISBN 978-3-16-148410-0");
  assert.equal(count, 0);
  assert.ok(text.includes("978-3-16-148410-0"));
});

test("varios secretos distintos en el mismo texto cuentan cada uno", () => {
  const { count } = redactSecrets(`
    AWS: AKIAABCDEFGHIJKLMNOP
    GitHub: ghp_${"c".repeat(36)}
    Card: 4111 1111 1111 1111
  `);
  assert.equal(count, 3);
});

test("texto sin nada sensible no cambia", () => {
  const { text, count } = redactSecrets("Run `npx docsera` to install Docsera in one command.");
  assert.equal(count, 0);
  assert.equal(text, "Run `npx docsera` to install Docsera in one command.");
});

test("no toca emails ni teléfonos a propósito", () => {
  const { text, count } = redactSecrets("Contact us at support@example.com or +1 555-123-4567.");
  assert.equal(count, 0);
  assert.ok(text.includes("support@example.com"));
  assert.ok(text.includes("+1 555-123-4567"));
});
