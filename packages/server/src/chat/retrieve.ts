import type { Pool } from "pg";

export const TOP_K = 6;
// Candidatos por cada rama (vector y texto) antes de fusionar.
const CANDIDATES = 12;
// Constante clásica de Reciprocal Rank Fusion: amortigua la diferencia
// entre las primeras posiciones sin dejar que una sola rama domine.
const RRF_K = 60;

// Distancia coseno máxima (0 = idéntico, 2 = opuesto) para considerar un
// chunk relevante en la rama vectorial. Sin umbral, una pregunta sin
// relación con la doc mete igualmente los chunks más cercanos en el prompt
// y paga la llamada al LLM solo para que responda "No lo sé". El valor
// razonable depende del modelo de embeddings; 2 desactiva el filtro.
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

// Fusión RRF pura sobre listas de ids ya ordenadas por relevancia:
// score(id) = Σ 1/(k + posición). Exportada para poder testearla.
export function fuseRankings(rankings: string[][], k: number = RRF_K): string[] {
  const scores = new Map<string, number>();
  for (const ranking of rankings) {
    ranking.forEach((id, index) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + index + 1));
    });
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

// Recuperación híbrida: la rama vectorial (semántica, con umbral de
// distancia) y la rama full-text ('simple', términos exactos: nombres de
// funciones, variables, códigos de error) se fusionan por RRF. Si ninguna
// rama aporta candidatos, la pregunta se considera sin cobertura y el
// llamador responde la frase de no-respuesta sin llamar al LLM.
export async function retrieveRelevantChunks(
  pool: Pool,
  embedding: number[],
  query: string,
  limit: number = TOP_K,
): Promise<RetrievedChunk[]> {
  const maxDistance = Number(process.env.CHAT_MAX_DISTANCE ?? DEFAULT_MAX_DISTANCE);

  const [vectorResult, textResult] = await Promise.all([
    pool.query<ChunkRow>(
      `SELECT c.id, c.content, c.anchor, d.url, d.title
       FROM chunks c
       JOIN documents d ON d.id = c.document_id
       WHERE c.embedding <=> $1 <= $3
       ORDER BY c.embedding <=> $1
       LIMIT $2`,
      [JSON.stringify(embedding), CANDIDATES, maxDistance],
    ),
    pool.query<ChunkRow>(
      `SELECT c.id, c.content, c.anchor, d.url, d.title
       FROM chunks c
       JOIN documents d ON d.id = c.document_id
       WHERE c.tsv @@ websearch_to_tsquery('simple', $1)
       ORDER BY ts_rank_cd(c.tsv, websearch_to_tsquery('simple', $1)) DESC
       LIMIT $2`,
      [query, CANDIDATES],
    ),
  ]);

  const byId = new Map<string, RetrievedChunk>();
  for (const row of [...vectorResult.rows, ...textResult.rows]) {
    if (!byId.has(row.id)) byId.set(row.id, row);
  }

  const fused = fuseRankings([
    vectorResult.rows.map((row) => row.id),
    textResult.rows.map((row) => row.id),
  ]);

  return fused.slice(0, limit).map((id) => byId.get(id) as RetrievedChunk);
}
