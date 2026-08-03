import { AnthropicChatAdapter } from "./anthropic.js";
import { OllamaChatAdapter, OllamaEmbeddingsAdapter } from "./ollama.js";
import { OpenAiChatAdapter, OpenAiEmbeddingsAdapter } from "./openai.js";
import type { ChatAdapter, EmbeddingsAdapter } from "./types.js";

export type { ChatAdapter, ChatMessage, EmbeddingsAdapter } from "./types.js";

// Misma costura que setPool(), por el mismo motivo: ejercer las rutas sin
// gastar llamadas reales al proveedor. Nadie las llama en producción.
let chatOverride: ChatAdapter | undefined;
let embeddingsOverride: EmbeddingsAdapter | undefined;

export function setChatAdapter(replacement: ChatAdapter | undefined): void {
  chatOverride = replacement;
}

export function setEmbeddingsAdapter(replacement: EmbeddingsAdapter | undefined): void {
  embeddingsOverride = replacement;
}

// Valida la config de proveedor al arrancar en vez de descubrir el problema
// en la primera pregunta (donde sale como un 500 genérico y hay que bucear en
// los logs). Cubre el provider desconocido y la API key que falta para el
// provider elegido; Ollama no necesita key. En inglés como el resto de lo que
// ve quien autohospeda (.env.example, README). Igual espíritu que
// assertEmbeddingDimensions: fallar rápido y claro.
export function validateProviderConfig(env: NodeJS.ProcessEnv = process.env): void {
  const problems: string[] = [];

  const llm = env.LLM_PROVIDER ?? "anthropic";
  if (llm === "anthropic") {
    if (!env.ANTHROPIC_API_KEY) problems.push("LLM_PROVIDER=anthropic requires ANTHROPIC_API_KEY.");
  } else if (llm === "openai") {
    if (!env.OPENAI_API_KEY) problems.push("LLM_PROVIDER=openai requires OPENAI_API_KEY.");
  } else if (llm !== "ollama") {
    problems.push(`Unknown LLM_PROVIDER "${llm}". Use anthropic | openai | ollama.`);
  }

  const embeddings = env.EMBEDDING_PROVIDER ?? "openai";
  if (embeddings === "openai") {
    if (!env.OPENAI_API_KEY) problems.push("EMBEDDING_PROVIDER=openai requires OPENAI_API_KEY.");
  } else if (embeddings !== "ollama") {
    problems.push(`Unknown EMBEDDING_PROVIDER "${embeddings}". Use openai | ollama.`);
  }

  if (problems.length > 0) {
    throw new Error(`Invalid LLM configuration:\n- ${problems.join("\n- ")}`);
  }
}

export function getChatAdapter(): ChatAdapter {
  if (chatOverride) return chatOverride;
  const provider = process.env.LLM_PROVIDER ?? "anthropic";
  switch (provider) {
    case "anthropic":
      return new AnthropicChatAdapter();
    case "openai":
      return new OpenAiChatAdapter();
    case "ollama":
      return new OllamaChatAdapter();
    default:
      throw new Error(`LLM_PROVIDER desconocido: "${provider}". Usa anthropic | openai | ollama.`);
  }
}

export function getEmbeddingsAdapter(): EmbeddingsAdapter {
  if (embeddingsOverride) return embeddingsOverride;
  const provider = process.env.EMBEDDING_PROVIDER ?? "openai";
  switch (provider) {
    case "openai":
      return new OpenAiEmbeddingsAdapter();
    case "ollama":
      return new OllamaEmbeddingsAdapter();
    default:
      throw new Error(
        `EMBEDDING_PROVIDER desconocido: "${provider}". Usa openai | ollama (Anthropic no tiene API de embeddings).`,
      );
  }
}
