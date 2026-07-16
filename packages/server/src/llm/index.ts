import { AnthropicChatAdapter } from "./anthropic.js";
import { OllamaChatAdapter, OllamaEmbeddingsAdapter } from "./ollama.js";
import { OpenAiChatAdapter, OpenAiEmbeddingsAdapter } from "./openai.js";
import type { ChatAdapter, EmbeddingsAdapter } from "./types.js";

export type { ChatAdapter, ChatMessage, EmbeddingsAdapter } from "./types.js";

export function getChatAdapter(): ChatAdapter {
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
