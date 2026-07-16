import type { ChatAdapter, ChatMessage, EmbeddingsAdapter } from "./types.js";

const CHAT_URL = "https://api.openai.com/v1/chat/completions";
const EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";
const DEFAULT_CHAT_MODEL = "gpt-4o-mini";
const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_BATCH_SIZE = 100;

interface OpenAiChatResponse {
  choices: { message: { content: string } }[];
}

interface OpenAiEmbeddingResponse {
  data: { embedding: number[]; index: number }[];
}

function requireApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no configurada");
  }
  return apiKey;
}

export class OpenAiChatAdapter implements ChatAdapter {
  async chat(messages: ChatMessage[]): Promise<string> {
    const apiKey = requireApiKey();
    const model = process.env.LLM_MODEL ?? DEFAULT_CHAT_MODEL;

    const response = await fetch(CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI chat API error (${response.status}): ${await response.text()}`);
    }

    const data = (await response.json()) as OpenAiChatResponse;
    const content = data.choices[0]?.message.content;
    if (!content) {
      throw new Error("OpenAI no devolvió contenido en la respuesta");
    }
    return content;
  }
}

export class OpenAiEmbeddingsAdapter implements EmbeddingsAdapter {
  async embed(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
      results.push(...(await this.embedBatch(batch)));
    }
    return results;
  }

  private async embedBatch(texts: string[]): Promise<number[][]> {
    const apiKey = requireApiKey();
    const model = process.env.EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL;
    const dimensions = Number(process.env.EMBEDDING_DIMENSIONS ?? 1536);

    const response = await fetch(EMBEDDINGS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, input: texts, dimensions }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI embeddings API error (${response.status}): ${await response.text()}`);
    }

    const data = (await response.json()) as OpenAiEmbeddingResponse;
    return data.data.sort((a, b) => a.index - b.index).map((item) => item.embedding);
  }
}
