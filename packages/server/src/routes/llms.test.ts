import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLlmsTxt, llmsRoute, publicOrigin } from "./llms.js";
import { setPool } from "../lib/db.js";
import { fakePool } from "../testing/doubles.js";

const ORIGIN = "https://api.example.com";

test("empieza por el título como H1 y describe cómo consultar", () => {
  const txt = buildLlmsTxt(ORIGIN, "Acme Docs", []);

  assert.match(txt, /^# Acme Docs\n/);
  assert.match(txt, /https:\/\/api\.example\.com\/mcp/);
  assert.match(txt, /https:\/\/api\.example\.com\/chat/);
  assert.match(txt, /https:\/\/api\.example\.com\/chat\/stream/);
});

test("lista cada documento indexado como enlace Markdown", () => {
  const txt = buildLlmsTxt(ORIGIN, "Docs", [
    { title: "Installation", url: "https://docs.example.com/install" },
    { title: "Configuration", url: "https://docs.example.com/config" },
  ]);

  assert.match(txt, /- \[Installation\]\(https:\/\/docs\.example\.com\/install\)/);
  assert.match(txt, /- \[Configuration\]\(https:\/\/docs\.example\.com\/config\)/);
});

test("un documento sin URL se lista sin enlace, no se omite", () => {
  const txt = buildLlmsTxt(ORIGIN, "Docs", [{ title: "Internal notes", url: null }]);

  assert.match(txt, /- Internal notes/);
  assert.doesNotMatch(txt, /\[Internal notes\]\(/);
});

test("sin título usable cae a la URL, y sin ninguno de los dos a Untitled", () => {
  const txt = buildLlmsTxt(ORIGIN, "Docs", [
    { title: null, url: "https://docs.example.com/x" },
    { title: "   ", url: null },
  ]);

  assert.match(txt, /- \[https:\/\/docs\.example\.com\/x\]\(https:\/\/docs\.example\.com\/x\)/);
  assert.match(txt, /- Untitled/);
});

test("termina en salto de línea, como cualquier fichero de texto", () => {
  assert.ok(buildLlmsTxt(ORIGIN, "Docs", []).endsWith("\n"));
});

test("detrás de un proxy que termina TLS, el origen publicado usa https", () => {
  assert.equal(publicOrigin("http://api.example.com/llms.txt", "https"), "https://api.example.com");
  // El proxy puede encadenar varios saltos; manda el primero.
  assert.equal(
    publicOrigin("http://api.example.com/llms.txt", "https, http"),
    "https://api.example.com",
  );
});

test("sin cabecera de proxy se respeta el esquema de la petición", () => {
  assert.equal(publicOrigin("http://localhost:3000/llms.txt"), "http://localhost:3000");
  assert.equal(publicOrigin("https://api.example.com/llms.txt"), "https://api.example.com");
});

test("GET /llms.txt sirve text/plain con el H1 y las páginas indexadas", async () => {
  setPool(
    fakePool([
      {
        match: /FROM documents/i,
        rows: [{ title: "Installation", url: "https://docs.example.com/install" }],
      },
    ]),
  );
  process.env.LLMS_TXT_TITLE = "Acme Docs";

  try {
    const response = await llmsRoute.fetch(new Request("https://api.example.com/llms.txt"));

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /text\/plain/);
    const body = await response.text();
    assert.match(body, /^# Acme Docs\n/);
    assert.match(body, /- \[Installation\]\(https:\/\/docs\.example\.com\/install\)/);
  } finally {
    delete process.env.LLMS_TXT_TITLE;
    setPool(undefined);
  }
});

test("detrás de proxy TLS, los enlaces publicados salen en https", async () => {
  setPool(fakePool([{ match: /FROM documents/i, rows: [] }]));

  try {
    const response = await llmsRoute.fetch(
      new Request("http://api.example.com/llms.txt", {
        headers: { "x-forwarded-proto": "https" },
      }),
    );
    const body = await response.text();

    assert.match(body, /\(https:\/\/api\.example\.com\/mcp\)/);
    assert.doesNotMatch(body, /\(http:\/\/api\.example\.com/);
  } finally {
    setPool(undefined);
  }
});
