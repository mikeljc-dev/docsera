import { test } from "node:test";
import assert from "node:assert/strict";
import { buildChatMessages, DEFAULT_NO_ANSWER_TEXT, isNoAnswer, noAnswerText } from "./prompt.js";

test("isNoAnswer reconoce el centinela NO_ANSWER", () => {
  delete process.env.CHAT_NO_ANSWER_TEXT;
  assert.equal(isNoAnswer("NO_ANSWER"), true);
  assert.equal(isNoAnswer("no_answer"), true);
  assert.equal(isNoAnswer("  NO_ANSWER.  "), true);
  assert.equal(isNoAnswer("No answer"), true);
});

test("isNoAnswer reconoce el texto exacto por defecto", () => {
  delete process.env.CHAT_NO_ANSWER_TEXT;
  assert.equal(noAnswerText(), DEFAULT_NO_ANSWER_TEXT);
  assert.equal(isNoAnswer(DEFAULT_NO_ANSWER_TEXT), true);
});

test("isNoAnswer es insensible a mayúsculas, acentos y puntuación", () => {
  delete process.env.CHAT_NO_ANSWER_TEXT;
  assert.equal(isNoAnswer("i don't know"), true);
  assert.equal(isNoAnswer("I Don't Know."), true);
  assert.equal(isNoAnswer('"I don\'t know."'), true);
  assert.equal(isNoAnswer("  I don't know.  "), true);
});

test("isNoAnswer no marca como negativa una respuesta real", () => {
  delete process.env.CHAT_NO_ANSWER_TEXT;
  assert.equal(isNoAnswer("The answer is 42."), false);
  assert.equal(isNoAnswer("I don't know the exact date, but it was in 2024."), false);
});

test("la frase de no-respuesta es configurable con CHAT_NO_ANSWER_TEXT", () => {
  process.env.CHAT_NO_ANSWER_TEXT = "No lo sé.";
  try {
    assert.equal(noAnswerText(), "No lo sé.");
    assert.equal(isNoAnswer("no lo se"), true);
    assert.equal(isNoAnswer('"No lo sé."'), true);
    assert.equal(isNoAnswer("NO_ANSWER"), true);
    assert.equal(isNoAnswer("I don't know."), false);
  } finally {
    delete process.env.CHAT_NO_ANSWER_TEXT;
  }
});

test("el system prompt pide el centinela, no la frase localizada", () => {
  process.env.CHAT_NO_ANSWER_TEXT = "No lo sé.";
  try {
    const [system] = buildChatMessages("x", []);
    assert.match(system?.content ?? "", /NO_ANSWER/);
    assert.doesNotMatch(system?.content ?? "", /No lo sé/);
  } finally {
    delete process.env.CHAT_NO_ANSWER_TEXT;
  }
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
  assert.match(messages[1]?.content ?? "", /Question: ¿Qué es esto\?$/);
});

test("el system prompt instruye a no repetir las etiquetas numeradas", () => {
  const [system] = buildChatMessages("x", []);
  assert.match(system?.content ?? "", /never write those\s+bracketed numbers/i);
});
