import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAnswerMessage } from "./message.js";
import type { ChatResult } from "../chat/index.js";

function result(overrides: Partial<ChatResult> = {}): ChatResult {
  return {
    answer: "Docsera is AGPL-3.0.",
    sources: [{ url: "https://docs.example.com/", title: "Docs", anchor: "license" }],
    sessionId: "s",
    conversationId: "c",
    answered: true,
    ...overrides,
  };
}

test("respuesta con fuentes: embed con field Sources y enlaces con ancla", () => {
  const message = buildAnswerMessage(result());
  const embed = message.embeds[0];
  assert.ok(embed);
  assert.equal(embed.description, "Docsera is AGPL-3.0.");
  assert.deepEqual(embed.fields, [
    { name: "Sources", value: "[Docs](https://docs.example.com/#license)" },
  ]);
});

test("fuente sin ancla enlaza a la URL a secas; sin URL, solo el título", () => {
  const message = buildAnswerMessage(
    result({
      sources: [
        { url: "https://docs.example.com/", title: "Docs", anchor: null },
        { url: null, title: "README", anchor: null },
      ],
    }),
  );
  assert.equal(
    message.embeds[0]?.fields?.[0]?.value,
    "[Docs](https://docs.example.com/)\nREADME",
  );
});

test("sin respuesta no hay field de fuentes", () => {
  const message = buildAnswerMessage(result({ answered: false, sources: [] }));
  assert.equal(message.embeds[0]?.fields, undefined);
});

test("la descripción se trunca al límite de embed de Discord", () => {
  const message = buildAnswerMessage(result({ answer: "x".repeat(5000) }));
  const description = message.embeds[0]?.description ?? "";
  assert.equal(description.length, 4096);
  assert.ok(description.endsWith("…"));
});

test("las fuentes que no caben en el field se omiten enteras", () => {
  const sources = Array.from({ length: 40 }, (_, i) => ({
    url: `https://docs.example.com/page-${i}`,
    title: `A fairly long page title number ${i}`,
    anchor: null,
  }));
  const value = buildAnswerMessage(result({ sources })).embeds[0]?.fields?.[0]?.value ?? "";
  assert.ok(value.length <= 1024);
  // Ningún enlace partido: cada línea es un markdown link completo.
  for (const line of value.split("\n")) {
    assert.match(line, /^\[.+\]\(https:\/\/docs\.example\.com\/page-\d+\)$/);
  }
});
