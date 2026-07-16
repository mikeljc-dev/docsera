import type { Pool } from "pg";

export const TOP_K = 6;

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
  const result = await pool.query<ChunkRow>(
    `SELECT c.id, c.content, c.anchor, d.url, d.title
     FROM chunks c
     JOIN documents d ON d.id = c.document_id
     ORDER BY c.embedding <=> $1
     LIMIT $2`,
    [JSON.stringify(embedding), limit],
  );
  return result.rows;
}
