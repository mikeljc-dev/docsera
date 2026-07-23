import { test } from "node:test";
import assert from "node:assert/strict";
import { truncateEncodedPair } from "./rerank.js";

test("una secuencia dentro del límite no se toca", () => {
  const pair = { ids: [101, 1, 2, 102], attentionMask: [1, 1, 1, 1], tokenTypeIds: [0, 0, 0, 0] };
  assert.deepEqual(truncateEncodedPair(pair, 10), pair);
});

test("una secuencia más larga que el límite se recorta conservando el SEP final", () => {
  const ids = [101, 1, 2, 3, 4, 5, 6, 7, 8, 102];
  const attentionMask = ids.map(() => 1);
  const tokenTypeIds = [0, 0, 0, 0, 1, 1, 1, 1, 1, 1];

  const result = truncateEncodedPair({ ids, attentionMask, tokenTypeIds }, 5);

  assert.equal(result.ids.length, 5);
  assert.equal(result.ids[result.ids.length - 1], 102, "el último token sigue siendo [SEP]");
  assert.deepEqual(result.ids.slice(0, 4), [101, 1, 2, 3], "conserva el principio de la secuencia");
  assert.equal(result.attentionMask.length, 5);
  assert.equal(result.tokenTypeIds.length, 5);
  assert.equal(
    result.tokenTypeIds[result.tokenTypeIds.length - 1],
    1,
    "el SEP final hereda el type_id del último token real (el pasaje)",
  );
});

test("el límite exacto no dispara truncado", () => {
  const ids = [101, 1, 2, 102];
  const pair = { ids, attentionMask: ids.map(() => 1), tokenTypeIds: [0, 0, 0, 0] };
  const result = truncateEncodedPair(pair, 4);
  assert.deepEqual(result, pair);
});
