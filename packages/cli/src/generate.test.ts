import { test } from "node:test";
import assert from "node:assert/strict";
import { buildComposeFile, buildEnvFile, buildWidgetSnippet, embeddingDimensions } from "./generate.js";
import { parseEnvFile } from "./envFile.js";
import { VERSION } from "./version.js";
import type { SetupConfig } from "./generate.js";

const base: SetupConfig = {
  chatProvider: "anthropic",
  embeddingProvider: "openai",
  anthropicApiKey: "sk-ant-test",
  openaiApiKey: "sk-test",
  adminToken: "a".repeat(64),
  postgresPassword: "b".repeat(32),
  port: 3000,
  allowedOrigins: ["https://docs.example.com"],
};

test("embeddingDimensions casa con los modelos por defecto de cada adaptador", () => {
  assert.equal(embeddingDimensions("openai"), 1536);
  assert.equal(embeddingDimensions("ollama"), 768);
});

test("buildEnvFile es legible de vuelta por parseEnvFile con los mismos valores", () => {
  const env = parseEnvFile(buildEnvFile(base));
  assert.equal(env.LLM_PROVIDER, "anthropic");
  assert.equal(env.EMBEDDING_PROVIDER, "openai");
  assert.equal(env.EMBEDDING_DIMENSIONS, "1536");
  assert.equal(env.ANTHROPIC_API_KEY, "sk-ant-test");
  assert.equal(env.OPENAI_API_KEY, "sk-test");
  assert.equal(env.ADMIN_TOKEN, "a".repeat(64));
  assert.equal(env.POSTGRES_PASSWORD, "b".repeat(32));
  assert.equal(env.PORT, "3000");
  assert.equal(env.ALLOWED_ORIGINS, "https://docs.example.com");
  assert.equal(env.OPENAI_BASE_URL, undefined);
  assert.equal(env.LLM_MODEL, undefined);
});

test("buildEnvFile con Ollama: dims 768, modelo elegido y sin keys", () => {
  const env = parseEnvFile(
    buildEnvFile({
      ...base,
      chatProvider: "ollama",
      embeddingProvider: "ollama",
      anthropicApiKey: undefined,
      openaiApiKey: undefined,
      chatModel: "llama3.2",
    }),
  );
  assert.equal(env.LLM_PROVIDER, "ollama");
  assert.equal(env.LLM_MODEL, "llama3.2");
  assert.equal(env.EMBEDDING_DIMENSIONS, "768");
  assert.equal(env.ANTHROPIC_API_KEY, undefined);
  assert.equal(env.OPENAI_API_KEY, undefined);
});

test("buildEnvFile emite OPENAI_BASE_URL solo si se configuró", () => {
  const env = parseEnvFile(
    buildEnvFile({ ...base, openaiBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai" }),
  );
  assert.equal(env.OPENAI_BASE_URL, "https://generativelanguage.googleapis.com/v1beta/openai");
});

test("buildComposeFile fija la imagen a la versión de la CLI y no expone la BD", () => {
  const compose = buildComposeFile();
  assert.ok(compose.includes(`ghcr.io/mikeljc-dev/docsera:${VERSION}`));
  // La contraseña la interpola compose desde .env: no puede ir hardcodeada.
  assert.ok(compose.includes("POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}"));
  assert.ok(compose.includes("postgresql://docsera:${POSTGRES_PASSWORD}@db:5432/docsera"));
  // El server dentro del contenedor siempre en 3000; el PORT del .env solo
  // cambia el lado host del mapeo.
  assert.ok(compose.includes('"${PORT:-3000}:3000"'));
  const dbSection = compose.slice(compose.indexOf("db:"), compose.indexOf("server:"));
  assert.ok(!dbSection.includes("ports:"));
});

test("buildWidgetSnippet apunta src y data-server al mismo origen", () => {
  assert.equal(
    buildWidgetSnippet("http://localhost:3000"),
    '<script src="http://localhost:3000/widget.js" data-server="http://localhost:3000"></script>',
  );
});
