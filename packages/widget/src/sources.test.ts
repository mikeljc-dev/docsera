import { test } from "node:test";
import assert from "node:assert/strict";
import { sourceHref, sourceLabel } from "./sources.js";

test("sourceHref cuelga el anchor de la URL con #", () => {
  assert.equal(
    sourceHref({ url: "https://docs.example.com/guide", title: "Guide", anchor: "install" }),
    "https://docs.example.com/guide#install",
  );
});

test("sourceHref sin anchor devuelve la URL a secas", () => {
  assert.equal(
    sourceHref({ url: "https://docs.example.com/guide", title: "Guide", anchor: null }),
    "https://docs.example.com/guide",
  );
});

test("sourceHref sin URL devuelve cadena vacia (se pinta como texto, no enlace)", () => {
  assert.equal(sourceHref({ url: null, title: "Guide", anchor: "install" }), "");
});

test("sourceLabel humaniza el anchor: guiones a espacios tras el titulo", () => {
  assert.equal(
    sourceLabel({ url: "https://x", title: "Install", anchor: "add-the-widget" }),
    "Install § add the widget",
  );
});

test("sourceLabel sin anchor es solo el titulo", () => {
  assert.equal(sourceLabel({ url: "https://x", title: "Install", anchor: null }), "Install");
});
