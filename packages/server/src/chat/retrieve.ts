import type { Pool } from "pg";

export const TOP_K = 6;

// Distancia coseno máxima (0 = idéntico, 2 = opuesto) para considerar un
// chunk relevante. Sin umbral, una pregunta sin relación con la doc mete
// igualmente los 6 chunks más cercanos en el prompt y paga la llamada al
// LLM solo para que responda "No lo sé". El valor razonable depende del
// modelo de embeddings; 2 desactiva el filtro.
const DEFAULT_MAX_DISTANCE = 0.8;

export interface RetrievedChunk {
  id: string;
  content: string;
  anchor: string | null;
  url: string | null;
  title: string;
}

interface ChunkRow {
  id: string;
  content: string;
  anchor: string | null;
  url: string | null;
  title: string;
}

export async function retrieveRelevantChunks(
  pool: Pool,
  embedding: number[],
  limit: number = TOP_K,
): Promise<RetrievedChunk[]> {
  const maxDistance = Number(process.env.CHAT_MAX_DISTANCE ?? DEFAULT_MAX_DISTANCE);
  const result = await pool.query<ChunkRow>(
    `SELECT c.id, c.content, c.anchor, d.url, d.title
     FROM chunks c
     JOIN documents d ON d.id = c.document_id
     WHERE c.embedding <=> $1 <= $3
     ORDER BY c.embedding <=> $1
     LIMIT $2`,
    [JSON.stringify(embedding), limit, maxDistance],
  );
  return result.rows;
}
