import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify } from "./slugify.js";

test("pasa a minúsculas y reemplaza espacios por guiones", () => {
  assert.equal(slugify("Hola Mundo"), "hola-mundo");
});

test("elimina acentos y diacríticos", () => {
  assert.equal(slugify("Configuración Rápida"), "configuracion-rapida");
});

test("colapsa caracteres no alfanuméricos consecutivos en un solo guion", () => {
  assert.equal(slugify("¿Cómo instalo esto?!"), "como-instalo-esto");
});

test("quita guiones al principio y al final", () => {
  assert.equal(slugify("  espacios raros  "), "espacios-raros");
});

test("cadena vacía da string vacío", () => {
  assert.equal(slugify(""), "");
});
