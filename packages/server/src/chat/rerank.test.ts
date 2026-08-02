import { test } from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadRerankDeps, resolveRerankerCacheDir, truncateEncodedPair } from "./rerank.js";

test("la ruta de cache cae en tmpdir cuando no hay override", () => {
  assert.equal(resolveRerankerCacheDir({}), join(tmpdir(), "docsera-reranker"));
});

test("RERANKER_CACHE_DIR apunta la cache a un directorio persistente", () => {
  assert.equal(resolveRerankerCacheDir({ RERANKER_CACHE_DIR: "/data/reranker" }), "/data/reranker");
});

test("un RERANKER_CACHE_DIR en blanco cae al default en vez de a una ruta vacia", () => {
  assert.equal(resolveRerankerCacheDir({ RERANKER_CACHE_DIR: "  " }), join(tmpdir(), "docsera-reranker"));
});

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

type OrtImporter = () => Promise<typeof import("onnxruntime-web")>;
type TokenizersImporter = () => Promise<typeof import("@huggingface/tokenizers")>;

test("loadRerankDeps entrega ort y el constructor Tokenizer de los importadores", async () => {
  const fakeOrt = { tag: "ort" };
  const FakeTokenizer = function FakeTokenizer() {};
  const deps = await loadRerankDeps(
    (async () => fakeOrt) as unknown as OrtImporter,
    (async () => ({ Tokenizer: FakeTokenizer })) as unknown as TokenizersImporter,
  );
  assert.equal(deps.ort, fakeOrt);
  assert.equal(deps.Tokenizer, FakeTokenizer);
});

test("loadRerankDeps traduce una dep opcional ausente en un error accionable", async () => {
  // Simula la imagen delgada: onnxruntime-web no está instalado.
  await assert.rejects(
    loadRerankDeps(
      () => Promise.reject(new Error("Cannot find module 'onnxruntime-web'")),
      (async () => ({ Tokenizer: function () {} })) as unknown as TokenizersImporter,
    ),
    /no están instalados|INSTALL_RERANKER/,
  );
});
