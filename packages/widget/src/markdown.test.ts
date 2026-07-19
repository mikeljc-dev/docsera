import { test } from "node:test";
import assert from "node:assert/strict";
import { safeHref } from "./markdown.js";

// safeHref es la frontera de seguridad del renderizador: Lit interpola el
// href como texto pero no valida el esquema, así que todo lo que pase de aquí
// acaba en un <a href> navegable.
test("acepta http y https absolutos", () => {
  assert.equal(safeHref("https://docs.example.com/a"), "https://docs.example.com/a");
  assert.equal(safeHref("http://example.com"), "http://example.com");
  assert.equal(safeHref("HTTPS://EXAMPLE.COM/X"), "HTTPS://EXAMPLE.COM/X");
});

test("conserva paréntesis y anclas de URLs reales", () => {
  const wiki = "https://en.wikipedia.org/wiki/Foo_(bar)";
  assert.equal(safeHref(wiki), wiki);
  assert.equal(safeHref("https://d.com/p#sec-1"), "https://d.com/p#sec-1");
});

test("rechaza los esquemas ejecutables", () => {
  assert.equal(safeHref("javascript:alert(1)"), null);
  assert.equal(safeHref("JavaScript:alert(1)"), null);
  assert.equal(safeHref("data:text/html,<script>alert(1)</script>"), null);
  assert.equal(safeHref("vbscript:msgbox(1)"), null);
  assert.equal(safeHref("file:///etc/passwd"), null);
});

test("rechaza relativos: apuntarían a la web anfitriona, no a la doc", () => {
  assert.equal(safeHref("./LICENSE"), null);
  assert.equal(safeHref("/docs/install"), null);
  assert.equal(safeHref("../README.md"), null);
  assert.equal(safeHref(""), null);
});

test("rechaza lo que podría romper el atributo href", () => {
  assert.equal(safeHref('https://ok.com" onmouseover="alert(1)'), null);
  assert.equal(safeHref("https://ok.com<script>"), null);
  assert.equal(safeHref("https://ok.com con espacio"), null);
});
