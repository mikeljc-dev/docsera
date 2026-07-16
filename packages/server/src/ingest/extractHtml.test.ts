import { test } from "node:test";
import assert from "node:assert/strict";
import { extractFromHtml } from "./extractHtml.js";

test("elimina nav, header, footer y script del contenido", () => {
  const html = `<html><head><title>Doc</title></head>
    <body>
      <nav>Menú</nav>
      <header>Cabecera</header>
      <main>
        <h1>Título</h1>
        <p>Contenido real.</p>
      </main>
      <footer>Pie</footer>
      <script>console.log("no debería aparecer")</script>
    </body></html>`;

  const { blocks } = extractFromHtml(html);
  const allText = blocks.map((b) => b.text).join(" ");

  assert.ok(!allText.includes("Menú"));
  assert.ok(!allText.includes("Cabecera"));
  assert.ok(!allText.includes("Pie"));
  assert.ok(!allText.includes("console.log"));
  assert.ok(allText.includes("Contenido real."));
});

test("usa <title> como título del documento", () => {
  const html = "<html><head><title>Mi Página</title></head><body><p>x</p></body></html>";
  const { title } = extractFromHtml(html);
  assert.equal(title, "Mi Página");
});

test("cae al primer <h1> si no hay <title>", () => {
  const html = "<html><body><h1>Encabezado</h1><p>x</p></body></html>";
  const { title } = extractFromHtml(html);
  assert.equal(title, "Encabezado");
});

test("usa el id del heading como anchor si existe, si no genera un slug", () => {
  const html = `<html><body>
    <h2 id="mi-id-custom">Un título con espacios</h2>
    <p>texto</p>
  </body></html>`;
  const { blocks } = extractFromHtml(html);
  const heading = blocks.find((b) => b.type === "heading");
  assert.equal(heading?.anchor, "mi-id-custom");
});

test("genera el anchor a partir del texto cuando no hay id", () => {
  const html = "<html><body><h2>Un Título Con Espacios</h2><p>texto</p></body></html>";
  const { blocks } = extractFromHtml(html);
  const heading = blocks.find((b) => b.type === "heading");
  assert.equal(heading?.anchor, "un-titulo-con-espacios");
});

test("prefiere <main> sobre el resto del <body> si existe", () => {
  const html = `<html><body>
    <p>Fuera de main, no debería salir.</p>
    <main><p>Dentro de main.</p></main>
  </body></html>`;
  const { blocks } = extractFromHtml(html);
  const allText = blocks.map((b) => b.text).join(" ");
  assert.ok(!allText.includes("Fuera de main"));
  assert.ok(allText.includes("Dentro de main."));
});
