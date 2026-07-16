import { test } from "node:test";
import assert from "node:assert/strict";
import { buildChatMessages, isNoAnswer, NO_ANSWER_TEXT } from "./prompt.js";

test("isNoAnswer reconoce el texto exacto", () => {
  assert.equal(isNoAnswer(NO_ANSWER_TEXT), true);
});

test("isNoAnswer es insensible a mayúsculas, acentos y puntuación", () => {
  assert.equal(isNoAnswer("no lo se"), true);
  assert.equal(isNoAnswer("No Lo Sé"), true);
  assert.equal(isNoAnswer('"No lo sé."'), true);
  assert.equal(isNoAnswer("  no lo sé  "), true);
});

test("isNoAnswer no marca como negativa una respuesta real", () => {
  assert.equal(isNoAnswer("La respuesta es 42."), false);
  assert.equal(isNoAnswer("No lo sé, pero puedo intentar ayudarte de otra forma."), false);
});

test("buildChatMessages produce system + user con el contexto numerado", () => {
  const messages = buildChatMessages("¿Qué es esto?", [
    { id: "1", content: "Contenido A", anchor: null, url: "https://x.com/a", title: "Doc A" },
    { id: "2", content: "Contenido B", anchor: null, url: "https://x.com/b", title: "Doc B" },
  ]);

  assert.equal(messages.length, 2);
  assert.equal(messages[0]?.role, "system");
  assert.equal(messages[1]?.role, "user");
  assert.match(messages[1]?.content ?? "", /\[1\] \(Doc A\)\nContenido A/);
  assert.match(messages[1]?.content ?? "", /\[2\] \(Doc B\)\nContenido B/);
  assert.match(messages[1]?.content ?? "", /Pregunta: ¿Qué es esto\?$/);
});

test("el system prompt instruye a no repetir las etiquetas numeradas", () => {
  const [system] = buildChatMessages("x", []);
  assert.match(system?.content ?? "", /no.*(menciones|copies)/i);
});
