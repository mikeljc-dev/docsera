import { test } from "node:test";
import assert from "node:assert/strict";
import { detectSource } from "./detect.js";

test("owner/repo a pelo es github", () => {
  assert.deepEqual(detectSource("mikeljc-dev/docsera"), {
    type: "github",
    source: "mikeljc-dev/docsera",
  });
});

test("una URL de github.com es github", () => {
  assert.deepEqual(detectSource("https://github.com/mikeljc-dev/docsera"), {
    type: "github",
    source: "https://github.com/mikeljc-dev/docsera",
  });
});

test("una URL acabada en .xml es sitemap", () => {
  assert.deepEqual(detectSource("https://example.com/sitemap.xml"), {
    type: "sitemap",
    source: "https://example.com/sitemap.xml",
  });
});

test("cualquier otra URL http(s) es url", () => {
  assert.deepEqual(detectSource("https://docs.example.com/intro"), {
    type: "url",
    source: "https://docs.example.com/intro",
  });
});

test("entradas no válidas devuelven null", () => {
  assert.equal(detectSource(""), null);
  assert.equal(detectSource("   "), null);
  assert.equal(detectSource("not a url"), null);
  assert.equal(detectSource("ftp://example.com/docs"), null);
});

test("recorta espacios alrededor", () => {
  assert.deepEqual(detectSource("  https://example.com/sitemap.xml  "), {
    type: "sitemap",
    source: "https://example.com/sitemap.xml",
  });
});
