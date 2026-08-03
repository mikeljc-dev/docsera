import { test } from "node:test";
import assert from "node:assert/strict";
import { validateProviderConfig } from "./index.js";

test("Ollama para ambos no necesita ninguna key", () => {
  validateProviderConfig({ LLM_PROVIDER: "ollama", EMBEDDING_PROVIDER: "ollama" });
});

test("anthropic + openai embeddings con sus keys pasa", () => {
  validateProviderConfig({
    LLM_PROVIDER: "anthropic",
    ANTHROPIC_API_KEY: "sk-ant-x",
    EMBEDDING_PROVIDER: "openai",
    OPENAI_API_KEY: "sk-x",
  });
});

test("una sola key de OpenAI cubre chat + embeddings en modo compat", () => {
  // El modo compatibilidad (Gemini vía OPENAI_BASE_URL) usa OPENAI_API_KEY
  // tanto para chat como para embeddings.
  validateProviderConfig({
    LLM_PROVIDER: "openai",
    EMBEDDING_PROVIDER: "openai",
    OPENAI_API_KEY: "sk-x",
  });
});

test("anthropic sin ANTHROPIC_API_KEY falla nombrando la variable", () => {
  assert.throws(
    () => validateProviderConfig({ LLM_PROVIDER: "anthropic", EMBEDDING_PROVIDER: "ollama" }),
    /LLM_PROVIDER=anthropic requires ANTHROPIC_API_KEY/,
  );
});

test("openai sin OPENAI_API_KEY falla nombrando la variable", () => {
  assert.throws(
    () => validateProviderConfig({ LLM_PROVIDER: "openai", EMBEDDING_PROVIDER: "ollama" }),
    /LLM_PROVIDER=openai requires OPENAI_API_KEY/,
  );
});

test("EMBEDDING_PROVIDER=openai sin key también falla", () => {
  assert.throws(
    () => validateProviderConfig({ LLM_PROVIDER: "ollama", EMBEDDING_PROVIDER: "openai" }),
    /EMBEDDING_PROVIDER=openai requires OPENAI_API_KEY/,
  );
});

test("un provider desconocido se rechaza con las opciones válidas", () => {
  assert.throws(
    () => validateProviderConfig({ LLM_PROVIDER: "gemini", EMBEDDING_PROVIDER: "ollama" }),
    /Unknown LLM_PROVIDER "gemini"\. Use anthropic \| openai \| ollama/,
  );
});

test("acumula varios problemas en un solo error", () => {
  // Sin ninguna variable: anthropic (default) sin key + openai embeddings
  // (default) sin key.
  assert.throws(
    () => validateProviderConfig({}),
    (error: Error) => {
      assert.match(error.message, /ANTHROPIC_API_KEY/);
      assert.match(error.message, /OPENAI_API_KEY/);
      return true;
    },
  );
});
