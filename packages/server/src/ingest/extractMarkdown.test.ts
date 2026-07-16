import { test } from "node:test";
import assert from "node:assert/strict";
import { extractFromMarkdown } from "./extractMarkdown.js";

test("extrae headings con su anchor y texto en bloques separados", () => {
  const { title, blocks } = extractFromMarkdown(
    "# Título\n\nPárrafo intro.\n\n## Sección\n\nOtro párrafo.\n",
    "fallback",
  );

  assert.equal(title, "Título");
  assert.deepEqual(blocks, [
    { type: "heading", anchor: "titulo", text: "Título" },
    { type: "text", text: "Párrafo intro." },
    { type: "heading", anchor: "seccion", text: "Sección" },
    { type: "text", text: "Otro párrafo." },
  ]);
});

test("usa el título de fallback si no hay ningún H1", () => {
  const { title } = extractFromMarkdown("## Solo un H2\n\ntexto\n", "Mi Fallback");
  assert.equal(title, "Mi Fallback");
});

test("solo el primer H1 define el título", () => {
  const { title } = extractFromMarkdown("# Primero\n\ntexto\n\n# Segundo\n", "fallback");
  assert.equal(title, "Primero");
});

test("preserva los saltos de línea dentro de un bloque de código", () => {
  const markdown = "# T\n\n```html\n<script src=\"x.js\"></script>\n```\n";
  const { blocks } = extractFromMarkdown(markdown, "fallback");
  const codeBlock = blocks.find((b) => b.text.includes("```"));

  assert.ok(codeBlock, "debería haber un bloque con el código");
  assert.equal(codeBlock?.text, '```html\n<script src="x.js"></script>\n```');
});

test("une líneas de un mismo párrafo con espacios", () => {
  const { blocks } = extractFromMarkdown("Línea uno\nLínea dos\n", "fallback");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]?.text, "Línea uno Línea dos");
});
