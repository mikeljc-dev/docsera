import type { Pool } from "pg";
import { isRerankerEnabled, rerank } from "./rerank.js";

export const TOP_K = 6;
// Candidatos por cada rama (vector y texto) antes de fusionar.
const CANDIDATES = 12;
// Cuántos candidatos ya fusionados por RRF le llegan al re-ranker antes de
// cortar a TOP_K. Darle solo los TOP_K finales no serviría de nada: el punto
// del cross-encoder es poder promocionar algo que RRF dejó más abajo.
const RERANK_POOL = 12;
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

// Un término de búsqueda: el par (embedding, texto) con el que se lanzan sus
// dos ramas (vectorial y full-text). Normalmente hay uno solo, pero en un
// seguimiento la reescritura y la pregunta literal entran como dos términos.
export interface SearchTerm {
  embedding: number[];
  query: string;
}

interface ChunkRow {
  id: string;
  content: string;
  anchor: string | null;
  url: string | null;
  title: string;
}

const VECTOR_SQL = `SELECT c.id, c.content, c.anchor, d.url, d.title
   FROM chunks c
   JOIN documents d ON d.id = c.document_id
   WHERE c.embedding <=> $1 <= $3
   ORDER BY c.embedding <=> $1
   LIMIT $2`;

const TEXT_SQL = `SELECT c.id, c.content, c.anchor, d.url, d.title
   FROM chunks c
   JOIN documents d ON d.id = c.document_id
   WHERE c.tsv @@ websearch_to_tsquery('simple', $1)
   ORDER BY ts_rank_cd(c.tsv, websearch_to_tsquery('simple', $1)) DESC
   LIMIT $2`;

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

// Ejecuta las dos ramas (vectorial y full-text) de un término y devuelve sus
// filas y sus dos rankings ordenados por relevancia.
async function runBranches(
  pool: Pool,
  term: SearchTerm,
  maxDistance: number,
): Promise<{ rows: ChunkRow[]; rankings: string[][] }> {
  const [vectorResult, textResult] = await Promise.all([
    pool.query<ChunkRow>(VECTOR_SQL, [JSON.stringify(term.embedding), CANDIDATES, maxDistance]),
    pool.query<ChunkRow>(TEXT_SQL, [term.query, CANDIDATES]),
  ]);
  return {
    rows: [...vectorResult.rows, ...textResult.rows],
    rankings: [vectorResult.rows.map((row) => row.id), textResult.rows.map((row) => row.id)],
  };
}

// Recuperación híbrida sobre uno o varios términos de búsqueda: cada término
// aporta una rama vectorial (semántica, con umbral de distancia) y una rama
// full-text ('simple', términos exactos: nombres de funciones, variables,
// códigos de error), y todas las ramas se fusionan por RRF. Con varios
// términos —seguimiento con reescritura + pregunta literal— una reescritura
// desviada deja de secuestrar sola la recuperación (ver deuda #5). Si ninguna
// rama aporta candidatos, la pregunta se considera sin cobertura y el llamador
// responde la frase de no-respuesta sin llamar al LLM. `rerankQuery` es la
// pregunta con la que reordena el cross-encoder (la de más señal de intención).
export async function retrieveFromTerms(
  pool: Pool,
  terms: SearchTerm[],
  rerankQuery: string,
  limit: number = TOP_K,
): Promise<RetrievedChunk[]> {
  const maxDistance = Number(process.env.CHAT_MAX_DISTANCE ?? DEFAULT_MAX_DISTANCE);

  const branches = await Promise.all(terms.map((term) => runBranches(pool, term, maxDistance)));

  const byId = new Map<string, RetrievedChunk>();
  for (const branch of branches) {
    for (const row of branch.rows) {
      if (!byId.has(row.id)) byId.set(row.id, row);
    }
  }

  const fused = fuseRankings(branches.flatMap((branch) => branch.rankings));

  if (isRerankerEnabled() && fused.length > 0) {
    try {
      const candidates = fused.slice(0, RERANK_POOL).map((id) => byId.get(id) as RetrievedChunk);
      const rerankedIds = await rerank(
        rerankQuery,
        candidates.map((chunk) => ({ id: chunk.id, content: chunk.content })),
      );
      return rerankedIds.slice(0, limit).map((id) => byId.get(id) as RetrievedChunk);
    } catch (error) {
      // Un fallo del re-ranker (sin red la primera vez, WASM roto...) no
      // debe tirar la pregunta entera: se cae al orden de RRF de siempre.
      console.error("Re-ranking falló, usando el orden de RRF sin reordenar:", error);
    }
  }

  return fused.slice(0, limit).map((id) => byId.get(id) as RetrievedChunk);
}

// Firma de un solo término, la que usan el MCP (`search_docs`) y las pruebas
// de integración: sin historial no hay pregunta literal distinta que fusionar.
export function retrieveRelevantChunks(
  pool: Pool,
  embedding: number[],
  query: string,
  limit: number = TOP_K,
): Promise<RetrievedChunk[]> {
  return retrieveFromTerms(pool, [{ embedding, query }], query, limit);
}
