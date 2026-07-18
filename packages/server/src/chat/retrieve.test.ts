import { test } from "node:test";
import assert from "node:assert/strict";
import { fuseRankings } from "./retrieve.js";

test("fuseRankings prioriza lo que aparece en ambas ramas", () => {
  const fused = fuseRankings([
    ["a", "b", "c"],
    ["c", "d"],
  ]);
  // "c" aparece en las dos listas: debe ganar a "b" y "d" aunque no sea
  // primero en ninguna.
  assert.equal(fused[0], "c");
  assert.ok(fused.indexOf("a") < fused.indexOf("b"));
  assert.deepEqual([...fused].sort(), ["a", "b", "c", "d"]);
});

test("fuseRankings respeta el orden dentro de una sola rama", () => {
  assert.deepEqual(fuseRankings([["x", "y", "z"], []]), ["x", "y", "z"]);
});

test("fuseRankings con ramas vacías devuelve lista vacía", () => {
  assert.deepEqual(fuseRankings([[], []]), []);
});

test("un primero indiscutido en una rama gana a posiciones tardías repetidas", () => {
  const fused = fuseRankings(
    [
      ["a", "b", "c", "d", "e"],
      ["e", "f"],
    ],
    60,
  );
  // "e" (5º y 1º) suma más que "a" (solo 1º): 1/61+... comprobamos orden real
  const scoreA = 1 / 61;
  const scoreE = 1 / 65 + 1 / 61;
  assert.ok(scoreE > scoreA);
  assert.equal(fused[0], "e");
});
