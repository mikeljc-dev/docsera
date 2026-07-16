import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkBlocks } from "./chunk.js";

test("agrupa texto bajo el heading al que pertenece", () => {
  const chunks = chunkBlocks([
    { type: "heading", anchor: "intro", text: "Introducción" },
    { type: "text", text: "Primer párrafo." },
    { type: "text", text: "Segundo párrafo." },
    { type: "heading", anchor: "detalles", text: "Detalles" },
    { type: "text", text: "Tercer párrafo." },
  ]);

  assert.equal(chunks.length, 2);
  assert.equal(chunks[0]?.anchor, "intro");
  assert.equal(chunks[0]?.content, "Primer párrafo.\n\nSegundo párrafo.");
  assert.equal(chunks[1]?.anchor, "detalles");
  assert.equal(chunks[1]?.content, "Tercer párrafo.");
});

test("texto sin heading previo tiene anchor null", () => {
  const chunks = chunkBlocks([{ type: "text", text: "Sin sección." }]);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0]?.anchor, null);
});

test("bloques de texto vacíos no generan chunks", () => {
  const chunks = chunkBlocks([
    { type: "heading", anchor: "vacio", text: "Vacío" },
    { type: "heading", anchor: "otro", text: "Otro" },
    { type: "text", text: "Contenido." },
  ]);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0]?.anchor, "otro");
});

test("una sección larga se divide en varios chunks respetando MAX_CHUNK_CHARS", () => {
  const longParagraph = "x".repeat(1000);
  const chunks = chunkBlocks([
    { type: "heading", anchor: "larga", text: "Larga" },
    { type: "text", text: longParagraph },
    { type: "text", text: longParagraph },
    { type: "text", text: longParagraph },
  ]);

  assert.ok(chunks.length > 1, "debería dividirse en más de un chunk");
  for (const chunk of chunks) {
    assert.equal(chunk.anchor, "larga");
  }
  assert.equal(chunks.map((c) => c.content).join("\n\n"), [longParagraph, longParagraph, longParagraph].join("\n\n"));
});

test("chunk_index es secuencial a través de secciones", () => {
  const chunks = chunkBlocks([
    { type: "heading", anchor: "a", text: "A" },
    { type: "text", text: "uno" },
    { type: "heading", anchor: "b", text: "B" },
    { type: "text", text: "dos" },
  ]);
  assert.deepEqual(
    chunks.map((c) => c.index),
    [0, 1],
  );
});
