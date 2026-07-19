import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCondenseMessages, resolveStandaloneQuestion } from "./condense.js";
import type { Turn } from "./history.js";

const TURNS: Turn[] = [
  { question: "¿Qué es Docsera?", answer: "Un widget de chat sobre tus docs." },
  { question: "¿Es open source?", answer: "Sí, AGPL-3.0." },
];

test("buildCondenseMessages incluye el historial y el último mensaje", () => {
  const messages = buildCondenseMessages("¿y eso cómo se configura?", TURNS);

  assert.equal(messages.length, 2);
  assert.equal(messages[0]?.role, "system");
  assert.equal(messages[1]?.role, "user");
  assert.match(messages[1]?.content ?? "", /User: ¿Qué es Docsera\?/);
  assert.match(messages[1]?.content ?? "", /Assistant: Sí, AGPL-3\.0\./);
  assert.match(messages[1]?.content ?? "", /Latest message: ¿y eso cómo se configura\?$/);
});

test("el system prompt de reescritura prohíbe responder y fija el idioma", () => {
  const [system] = buildCondenseMessages("x", TURNS);
  assert.match(system?.content ?? "", /never answer the question/i);
  assert.match(system?.content ?? "", /keep the original language/i);
});

test("resolveStandaloneQuestion devuelve la reescritura limpia", () => {
  assert.equal(
    resolveStandaloneQuestion("¿Cómo se configura Docsera?", "¿y eso?"),
    "¿Cómo se configura Docsera?",
  );
  assert.equal(resolveStandaloneQuestion("  How do I install it?  ", "how?"), "How do I install it?");
});

test("resolveStandaloneQuestion quita comillas y prefijos del modelo", () => {
  assert.equal(resolveStandaloneQuestion('"How do I install Docsera?"', "x"), "How do I install Docsera?");
  assert.equal(resolveStandaloneQuestion("`How do I install Docsera?`", "x"), "How do I install Docsera?");
  assert.equal(
    resolveStandaloneQuestion("Standalone question: How do I install Docsera?", "x"),
    "How do I install Docsera?",
  );
});

test("resolveStandaloneQuestion vuelve a la original si la reescritura no sirve", () => {
  assert.equal(resolveStandaloneQuestion("", "¿y eso?"), "¿y eso?");
  assert.equal(resolveStandaloneQuestion("   ", "¿y eso?"), "¿y eso?");
  // El modelo ignoró la instrucción y respondió en vez de reescribir.
  assert.equal(resolveStandaloneQuestion("a".repeat(301), "¿y eso?"), "¿y eso?");
});
