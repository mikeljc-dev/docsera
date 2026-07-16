const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_BATCH_SIZE = 100;

interface OpenAiEmbeddingResponse {
  data: { embedding: number[]; index: number }[];
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no configurada: necesaria para generar embeddings");
  }

  const dimensions = Number(process.env.EMBEDDING_DIMENSIONS ?? 1536);

  const response = await fetch(OPENAI_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts, dimensions }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI embeddings API error (${response.status}): ${body}`);
  }

  const data = (await response.json()) as OpenAiEmbeddingResponse;
  return data.data.sort((a, b) => a.index - b.index).map((item) => item.embedding);
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
    results.push(...(await embedBatch(batch)));
  }
  return results;
}
