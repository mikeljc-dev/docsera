import { test } from "node:test";
import assert from "node:assert/strict";
import { sinceFor, stripMarkdown } from "./conversations.js";

const DAY_MS = 86_400_000;
// Un instante fijo para que la aritmética de sinceFor sea determinista.
const NOW = Date.UTC(2026, 6, 20, 12, 0, 0); // 2026-07-20T12:00:00Z

test("sinceFor('all') no filtra por fecha", () => {
  assert.equal(sinceFor("all", NOW), undefined);
});

test("sinceFor('7d') resta exactamente 7 días al ahora inyectado", () => {
  assert.equal(sinceFor("7d", NOW), new Date(NOW - 7 * DAY_MS).toISOString());
});

test("sinceFor('30d') resta exactamente 30 días", () => {
  assert.equal(sinceFor("30d", NOW), new Date(NOW - 30 * DAY_MS).toISOString());
});

test("sinceFor('today') cae en el mismo día que el ahora, no en el futuro", () => {
  const since = sinceFor("today", NOW);
  assert.ok(since, "devuelve un timestamp");
  const t = new Date(since).getTime();
  assert.ok(t <= NOW, "no es posterior al ahora");
  assert.ok(t > NOW - DAY_MS, "cae dentro de las últimas 24h (medianoche local de hoy)");
});

test("stripMarkdown quita fences con lenguaje y deja el código", () => {
  assert.equal(stripMarkdown("```bash\nnpx docsera\n```"), "npx docsera\n");
});

test("stripMarkdown quita backticks de código inline", () => {
  assert.equal(stripMarkdown("usa `npx docsera` para empezar"), "usa npx docsera para empezar");
});

test("stripMarkdown quita encabezados, negrita y cursiva", () => {
  assert.equal(stripMarkdown("# Título"), "Título");
  assert.equal(stripMarkdown("esto es **muy** importante"), "esto es muy importante");
  assert.equal(stripMarkdown("un poco *sutil*"), "un poco sutil");
});

test("stripMarkdown deja solo el texto de un enlace, no la URL", () => {
  assert.equal(stripMarkdown("mira [las docs](https://docsera.dev/docs)"), "mira las docs");
});

test("stripMarkdown no toca texto plano", () => {
  assert.equal(stripMarkdown("una respuesta normal sin sintaxis"), "una respuesta normal sin sintaxis");
});
