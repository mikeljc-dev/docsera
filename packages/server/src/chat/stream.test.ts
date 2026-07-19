import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_NO_ANSWER_TEXT } from "./prompt.js";
import { streamAnswer } from "./stream.js";

async function* fromArray(deltas: string[]): AsyncGenerator<string> {
  for (const delta of deltas) yield delta;
}

async function collect(deltas: string[]): Promise<string[]> {
  const out: string[] = [];
  for await (const delta of streamAnswer(fromArray(deltas))) out.push(delta);
  return out;
}

test("una respuesta larga se emite en cuanto supera la retención", async () => {
  const emitted = await collect(["El widget se configura ", "con atributos data-*", " en el script."]);

  assert.equal(emitted.join(""), "El widget se configura con atributos data-* en el script.");
  // Los dos primeros fragmentos salen fusionados: el primero solo no llega
  // al umbral de retención.
  assert.equal(emitted[0], "El widget se configura con atributos data-*");
  assert.equal(emitted[1], " en el script.");
});

test("el centinela nunca se emite: sale la frase de no-respuesta", async () => {
  delete process.env.CHAT_NO_ANSWER_TEXT;
  assert.deepEqual(await collect(["NO", "_ANS", "WER"]), [DEFAULT_NO_ANSWER_TEXT]);
});

test("el centinela decorado por modelos pequeños tampoco se filtra", async () => {
  delete process.env.CHAT_NO_ANSWER_TEXT;
  assert.deepEqual(await collect(["**NO_", "ANSWER**"]), [DEFAULT_NO_ANSWER_TEXT]);
});

test("una respuesta corta y real se emite tal cual al cerrar el stream", async () => {
  delete process.env.CHAT_NO_ANSWER_TEXT;
  assert.deepEqual(await collect(["Sí, ", "usa AGPL."]), ["Sí, usa AGPL."]);
});

test("una respuesta vacía se degrada a no-respuesta, no a burbuja en blanco", async () => {
  delete process.env.CHAT_NO_ANSWER_TEXT;
  assert.deepEqual(await collect([]), [DEFAULT_NO_ANSWER_TEXT]);
  assert.deepEqual(await collect(["  ", "\n"]), [DEFAULT_NO_ANSWER_TEXT]);
});

test("respeta la frase de no-respuesta configurada", async () => {
  process.env.CHAT_NO_ANSWER_TEXT = "No lo sé.";
  try {
    assert.deepEqual(await collect(["NO_ANSWER"]), ["No lo sé."]);
  } finally {
    delete process.env.CHAT_NO_ANSWER_TEXT;
  }
});
