import { test } from "node:test";
import assert from "node:assert/strict";
import { allowedOriginsWarning, parseAllowedOrigins } from "./cors.js";

test("parseAllowedOrigins: vacío o ausente da lista vacía", () => {
  assert.deepEqual(parseAllowedOrigins(undefined), []);
  assert.deepEqual(parseAllowedOrigins(""), []);
  assert.deepEqual(parseAllowedOrigins("  "), []);
});

test("parseAllowedOrigins: recorta espacios y descarta huecos", () => {
  assert.deepEqual(
    parseAllowedOrigins(" https://a.com , https://b.com ,, https://c.com "),
    ["https://a.com", "https://b.com", "https://c.com"],
  );
});

test("allowedOriginsWarning: lista vacía avisa del bloqueo CORS del widget", () => {
  const warning = allowedOriginsWarning([]);
  assert.ok(warning);
  assert.match(warning, /ALLOWED_ORIGINS is empty/);
  assert.match(warning, /CORS/);
  // El aviso dice cuándo puede ignorarse, para no asustar a quien no usa widget.
  assert.match(warning, /MCP server|HTTP API|Discord\/Slack/);
});

test("allowedOriginsWarning: con al menos un origen no avisa", () => {
  assert.equal(allowedOriginsWarning(["https://docs.example.com"]), null);
});
