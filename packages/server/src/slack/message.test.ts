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

test("respuesta con fuentes: sección con el texto y contexto con los enlaces mrkdwn", () => {
  const message = buildAnswerMessage(result());
  assert.equal(message.response_type, "in_channel");
  assert.equal(message.text, "Docsera is AGPL-3.0.");
  assert.equal(message.blocks?.[0]?.text?.text, "Docsera is AGPL-3.0.");
  assert.equal(
    message.blocks?.[1]?.elements?.[0]?.text,
    "*Sources:* <https://docs.example.com/#license|Docs>",
  );
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
    message.blocks?.[1]?.elements?.[0]?.text,
    "*Sources:* <https://docs.example.com/|Docs> · README",
  );
});

test("sin respuesta no hay bloque de contexto", () => {
  const message = buildAnswerMessage(result({ answered: false, sources: [] }));
  assert.equal(message.blocks?.length, 1);
});

test("el texto de la sección se trunca al límite de Slack", () => {
  const message = buildAnswerMessage(result({ answer: "x".repeat(4000) }));
  const text = message.blocks?.[0]?.text?.text ?? "";
  assert.equal(text.length, 3000);
  assert.ok(text.endsWith("…"));
});

test("las fuentes que no caben en el contexto se omiten enteras", () => {
  const sources = Array.from({ length: 40 }, (_, i) => ({
    url: `https://docs.example.com/page-${i}`,
    title: `A fairly long page title number ${i}`,
    anchor: null,
  }));
  const text = buildAnswerMessage(result({ sources })).blocks?.[1]?.elements?.[0]?.text ?? "";
  assert.ok(text.length <= 2000);
  for (const line of text.replace("*Sources:* ", "").split(" · ")) {
    assert.match(line, /^<https:\/\/docs\.example\.com\/page-\d+\|.+>$/);
  }
});
