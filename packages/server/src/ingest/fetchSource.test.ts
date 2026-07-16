import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSitemap } from "./fetchSource.js";

test("un urlset estándar devuelve sus páginas y ningún sitemap anidado", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://docs.example.com/</loc></url>
      <url><loc>https://docs.example.com/guia</loc></url>
    </urlset>`;
  assert.deepEqual(parseSitemap(xml), {
    pages: ["https://docs.example.com/", "https://docs.example.com/guia"],
    sitemaps: [],
  });
});

test("un sitemapindex devuelve sitemaps anidados y ninguna página", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <sitemap><loc>https://example.com/sitemap-docs.xml</loc></sitemap>
      <sitemap><loc>https://example.com/sitemap-blog.xml</loc></sitemap>
    </sitemapindex>`;
  assert.deepEqual(parseSitemap(xml), {
    pages: [],
    sitemaps: ["https://example.com/sitemap-docs.xml", "https://example.com/sitemap-blog.xml"],
  });
});

test("un sitemap no estándar cae a tratar cualquier <loc> como página", () => {
  const xml = `<paginas>
    <loc>https://example.com/a</loc>
    <loc>https://example.com/b</loc>
  </paginas>`;
  assert.deepEqual(parseSitemap(xml), {
    pages: ["https://example.com/a", "https://example.com/b"],
    sitemaps: [],
  });
});

test("ignora <loc> vacíos y recorta espacios", () => {
  const xml = `<urlset>
    <url><loc>  https://example.com/a  </loc></url>
    <url><loc></loc></url>
  </urlset>`;
  assert.deepEqual(parseSitemap(xml), { pages: ["https://example.com/a"], sitemaps: [] });
});

test("XML sin <loc> devuelve listas vacías", () => {
  assert.deepEqual(parseSitemap("<urlset></urlset>"), { pages: [], sitemaps: [] });
});
