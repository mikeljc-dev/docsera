import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { extractFromPdf } from "./extractPdf.js";

// fixtures/sample.pdf y fixtures/no-title.pdf: generados una vez con
// pdf-lib (no es dependencia del proyecto, solo se usó para crearlos) y
// commiteados como binarios — más fiable que construir un PDF a mano campo
// a campo. sample.pdf: título "Docsera Whitepaper", 3 páginas (1:
// "Installation" + una frase, 2: "Configuration" + otra, 3: en blanco a
// propósito, para probar que se descarta). no-title.pdf: sin /Title en su
// Info dictionary.
const FIXTURE_PATH = fileURLToPath(new URL("./fixtures/sample.pdf", import.meta.url));
const fixtureBytes = readFileSync(FIXTURE_PATH);

// Un PDF sin /Title en su Info dictionary (también generado con pdf-lib, sin
// llamar a setTitle), para probar la caída al fallback.
const NO_TITLE_FIXTURE_PATH = fileURLToPath(new URL("./fixtures/no-title.pdf", import.meta.url));
const noTitleFixtureBytes = readFileSync(NO_TITLE_FIXTURE_PATH);

// getDocumentProxy() transfiere (detach) el buffer que recibe, igual que un
// postMessage real con una lista de transferibles: reutilizar el mismo
// Uint8Array en más de una llamada revienta la segunda con un
// DataCloneError que no tiene nada que ver con lo que se está probando. Cada
// test necesita su propia copia.
function freshBytes(source: Buffer): Uint8Array {
  return new Uint8Array(source);
}

test("extrae el título de los metadatos del PDF", async () => {
  const { title } = await extractFromPdf(freshBytes(fixtureBytes), "Fallback");
  assert.equal(title, "Docsera Whitepaper");
});

test("una sección (heading + texto) por página con contenido", async () => {
  const { blocks } = await extractFromPdf(freshBytes(fixtureBytes), "Fallback");
  assert.deepEqual(
    blocks.map((b) => b.type),
    ["heading", "text", "heading", "text"],
  );
});

test("el anchor de cada sección es #page=N, que los visores de PDF entienden", async () => {
  const { blocks } = await extractFromPdf(freshBytes(fixtureBytes), "Fallback");
  const headings = blocks.filter((b) => b.type === "heading");
  assert.deepEqual(
    headings.map((b) => b.anchor),
    ["page=1", "page=2"],
  );
});

test("el texto de cada página se recoge en el bloque de texto siguiente", async () => {
  const { blocks } = await extractFromPdf(freshBytes(fixtureBytes), "Fallback");
  const [, firstText, , secondText] = blocks;
  assert.match(firstText?.text ?? "", /npx docsera/);
  assert.match(secondText?.text ?? "", /ANTHROPIC_API_KEY/);
});

test("la página en blanco no genera sección", async () => {
  const { blocks } = await extractFromPdf(freshBytes(fixtureBytes), "Fallback");
  // Solo 2 secciones (4 bloques): la página 3, vacía, no aparece.
  assert.equal(blocks.length, 4);
});

test("sin título en los metadatos, usa el fallback", async () => {
  const { title } = await extractFromPdf(freshBytes(noTitleFixtureBytes), "Fallback title");
  assert.equal(title, "Fallback title");
});
