import { test } from "node:test";
import assert from "node:assert/strict";
import { mapHistoryToMessages } from "./history.js";
import type { HistoryTurn } from "./types.js";

const baseTurn: HistoryTurn = {
  conversationId: "c1",
  question: "How do I add the widget?",
  answer: "Drop in the script tag.",
  answered: true,
  feedback: null,
  sources: [{ url: "https://docs.example.com", title: "Install", anchor: "add-the-widget" }],
};

test("cada turno se abre en un mensaje de usuario y uno de asistente, en orden", () => {
  const messages = mapHistoryToMessages([baseTurn]);
  assert.equal(messages.length, 2);
  assert.deepEqual(messages[0], { role: "user", content: "How do I add the widget?" });
  assert.equal(messages[1]?.role, "assistant");
  assert.equal(messages[1]?.content, "Drop in the script tag.");
  assert.equal(messages[1]?.answered, true);
  assert.equal(messages[1]?.conversationId, "c1");
  assert.deepEqual(messages[1]?.sources, baseTurn.sources);
});

test("varios turnos conservan el orden cronologico aplanado", () => {
  const messages = mapHistoryToMessages([
    { ...baseTurn, question: "Q1" },
    { ...baseTurn, question: "Q2" },
  ]);
  assert.equal(messages.length, 4);
  assert.equal(messages[0]?.content, "Q1");
  assert.equal(messages[2]?.content, "Q2");
});

test("un answer null se convierte en cadena vacia, no en el string 'null'", () => {
  const messages = mapHistoryToMessages([{ ...baseTurn, answer: null }]);
  assert.equal(messages[1]?.content, "");
});

test("un turno sin fuentes deja sources en undefined, no en un array vacio", () => {
  const messages = mapHistoryToMessages([{ ...baseTurn, sources: [] }]);
  assert.equal(messages[1]?.sources, undefined);
});

test("feedback null se normaliza a undefined; un feedback real se conserva", () => {
  const sinFeedback = mapHistoryToMessages([{ ...baseTurn, feedback: null }]);
  assert.equal(sinFeedback[1]?.feedback, undefined);

  const conFeedback = mapHistoryToMessages([{ ...baseTurn, feedback: "up" }]);
  assert.equal(conFeedback[1]?.feedback, "up");
});

test("answered false se propaga tal cual (una respuesta 'no lo se' guardada)", () => {
  const messages = mapHistoryToMessages([{ ...baseTurn, answered: false }]);
  assert.equal(messages[1]?.answered, false);
});

test("una lista de turnos vacia da una lista de mensajes vacia", () => {
  assert.deepEqual(mapHistoryToMessages([]), []);
});
