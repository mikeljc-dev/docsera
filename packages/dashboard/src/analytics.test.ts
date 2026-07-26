import { test } from "node:test";
import assert from "node:assert/strict";
import { percent, sourceHref, sourceLabel } from "./analytics.js";

test("percent con denominador 0 devuelve '—', no 'NaN%'", () => {
  assert.equal(percent(0, 0), "—");
  assert.equal(percent(5, 0), "—");
});

test("percent redondea al entero más cercano", () => {
  assert.equal(percent(1, 3), "33%");
  assert.equal(percent(2, 3), "67%");
  assert.equal(percent(1, 1), "100%");
  assert.equal(percent(0, 4), "0%");
});

test("sourceLabel humaniza el anchor (sin el título del documento delante)", () => {
  assert.equal(
    sourceLabel({ title: "Install", url: "https://x", anchor: "add-the-widget", times: 3 }),
    "add the widget",
  );
});

test("sourceLabel cae al título cuando no hay anchor", () => {
  assert.equal(sourceLabel({ title: "Install", url: "https://x", anchor: null, times: 3 }), "Install");
});

test("sourceHref compone url#anchor, o solo la url sin anchor", () => {
  assert.equal(
    sourceHref({ title: "T", url: "https://x/guide", anchor: "install", times: 1 }),
    "https://x/guide#install",
  );
  assert.equal(sourceHref({ title: "T", url: "https://x/guide", anchor: null, times: 1 }), "https://x/guide");
});

test("sourceHref devuelve null cuando no hay url", () => {
  assert.equal(sourceHref({ title: "T", url: null, anchor: "install", times: 1 }), null);
});
