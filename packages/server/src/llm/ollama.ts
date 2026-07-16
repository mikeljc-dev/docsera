import type { ChatAdapter, ChatMessage, EmbeddingsAdapter } from "./types.js";

const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_CHAT_MODEL = "llama3.1";
const DEFAULT_EMBEDDING_MODEL = "nomic-embed-text";

interface OllamaChatResponse {
  message: { content: string };
}

interface OllamaEmbedResponse {
  embeddings: number[][];
}

function baseUrl(): string {
  return process.env.OLLAMA_BASE_URL ?? DEFAULT_BASE_URL;
}

export class OllamaChatAdapter implements ChatAdapter {
  async chat(messages: ChatMessage[]): Promise<string> {
    const model = process.env.LLM_MODEL ?? DEFAULT_CHAT_MODEL;

    const response = await fetch(`${baseUrl()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, stream: false }),
    });

    if (!response.ok) {
      throw new Error(`Ollama chat API error (${response.status}): ${await response.text()}`);
    }

    const data = (await response.json()) as OllamaChatResponse;
    return data.message.content;
  }
}

export class OllamaEmbeddingsAdapter implements EmbeddingsAdapter {
  async embed(texts: string[]): Promise<number[][]> {
    const model = process.env.EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL;

    const response = await fetch(`${baseUrl()}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: texts }),
    });

    if (!response.ok) {
      throw new Error(`Ollama embeddings API error (${response.status}): ${await response.text()}`);
    }

    const data = (await response.json()) as OllamaEmbedResponse;
    return data.embeddings;
  }
}
