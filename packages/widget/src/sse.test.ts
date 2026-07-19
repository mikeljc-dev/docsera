import { test } from "node:test";
import assert from "node:assert/strict";
import { smooth } from "./sse.js";

// Planificador síncrono: ejecuta el siguiente paso al momento, así el test no
// depende de requestAnimationFrame ni de temporizadores reales.
const yaMismo = (cb: () => void): void => cb();

async function trocear(texto: string): Promise<string[]> {
  const trozos: string[] = [];
  await smooth(texto, (c) => trozos.push(c), yaMismo);
  return trozos;
}

test("no pierde ni reordena una sola letra", async () => {
  const texto = "Docsera responde con citas a las fuentes de tu documentación.";
  assert.equal((await trocear(texto)).join(""), texto);
});

test("un fragmento corto sale de una pieza, sin animarlo", async () => {
  assert.deepEqual(await trocear("Sí."), ["Sí."]);
  assert.deepEqual(await trocear("12345678"), ["12345678"]);
});

test("un fragmento grande se reparte en varios trozos", async () => {
  const trozos = await trocear("x".repeat(400));
  assert.ok(trozos.length > 5, `esperaba varios trozos, hubo ${trozos.length}`);
  assert.equal(trozos.join("").length, 400);
});

test("drena proporcionalmente: nunca se queda atrás con textos enormes", async () => {
  // 20 000 caracteres a ritmo fijo tardarían miles de frames; proporcional
  // los agota en unas decenas.
  const trozos = await trocear("y".repeat(20000));
  assert.ok(trozos.length < 150, `demasiados frames: ${trozos.length}`);
  assert.equal(trozos.join("").length, 20000);
});

test("respeta los saltos de línea y los espacios del Markdown", async () => {
  const texto = "- uno\n- dos\n\n```\ncódigo  con   espacios\n```";
  assert.equal((await trocear(texto)).join(""), texto);
});
