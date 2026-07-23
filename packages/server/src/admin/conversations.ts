import type { Pool } from "pg";

export interface ConversationSource {
  url: string | null;
  title: string;
  anchor: string | null;
}

export interface ConversationRow {
  id: string;
  sessionId: string;
  question: string;
  answer: string | null;
  answered: boolean;
  feedback: number | null;
  createdAt: string;
  sources: ConversationSource[];
}

export type SortBy = "date" | "feedback" | "sources";
export type SortDir = "asc" | "desc";

export interface ListConversationsOptions {
  answered?: boolean;
  search?: string;
  sessionId?: string;
  since?: string;
  sortBy?: SortBy;
  sortDir?: SortDir;
  limit: number;
  offset: number;
}

export interface ListConversationsResult {
  conversations: ConversationRow[];
  total: number;
}

interface RawConversationRow {
  id: string;
  session_id: string;
  question: string;
  answer: string | null;
  answered: boolean;
  feedback: number | null;
  created_at: string;
  sources: ConversationSource[];
}

// Whitelist explícita, nunca el parámetro del request tal cual: aunque solo
// se usen internamente, componer un ORDER BY con texto llegado de fuera
// sería inyección SQL de manual de instituto.
const ORDER_BY: Record<string, string> = {
  "date-desc": "c.created_at DESC",
  "date-asc": "c.created_at ASC",
  // NULLS LAST a propósito: "sin feedback" no es ni el más ni el menos
  // valorado, no debería colarse primero en ninguna dirección.
  "feedback-desc": "c.feedback DESC NULLS LAST",
  "feedback-asc": "c.feedback ASC NULLS LAST",
  "sources-desc": "source_count DESC",
  "sources-asc": "source_count ASC",
};

// Misma deduplicación que usa el widget para las citas en vivo (ver
// dedupeSources en chat/index.ts): varios chunks pueden compartir
// url+anchor si una sección quedó partida en más de un trozo.
function dedupeSources(sources: ConversationSource[]): ConversationSource[] {
  const seen = new Set<string>();
  const result: ConversationSource[] = [];
  for (const source of sources) {
    const key = `${source.url ?? ""}#${source.anchor ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(source);
  }
  return result;
}

export async function listConversations(
  pool: Pool,
  options: ListConversationsOptions,
): Promise<ListConversationsResult> {
  const answeredFilter = options.answered ?? null;
  const searchFilter = options.search?.trim() || null;
  const sessionFilter = options.sessionId ?? null;
  const sinceFilter = options.since ?? null;
  const orderClause =
    ORDER_BY[`${options.sortBy ?? "date"}-${options.sortDir ?? "desc"}`] ?? ORDER_BY["date-desc"];

  const [conversationsResult, totalResult] = await Promise.all([
    pool.query<RawConversationRow & { source_count: number }>(
      `SELECT c.id, c.session_id, c.question, c.answer, c.answered, c.feedback, c.created_at,
              count(DISTINCT ch.id)::int AS source_count,
              COALESCE(
                json_agg(
                  json_build_object('url', d.url, 'title', d.title, 'anchor', ch.anchor)
                ) FILTER (WHERE ch.id IS NOT NULL),
                '[]'
              ) AS sources
       FROM conversations c
       LEFT JOIN conversation_sources cs ON cs.conversation_id = c.id
       LEFT JOIN chunks ch ON ch.id = cs.chunk_id
       LEFT JOIN documents d ON d.id = ch.document_id
       WHERE ($1::boolean IS NULL OR c.answered = $1)
         AND ($4::text IS NULL OR c.question ILIKE '%' || $4 || '%')
         AND ($5::uuid IS NULL OR c.session_id = $5)
         AND ($6::timestamptz IS NULL OR c.created_at >= $6)
       GROUP BY c.id
       ORDER BY ${orderClause}
       LIMIT $2 OFFSET $3`,
      [answeredFilter, options.limit, options.offset, searchFilter, sessionFilter, sinceFilter],
    ),
    pool.query<{ count: string }>(
      `SELECT count(*) FROM conversations c
       WHERE ($1::boolean IS NULL OR c.answered = $1)
         AND ($2::text IS NULL OR c.question ILIKE '%' || $2 || '%')
         AND ($3::uuid IS NULL OR c.session_id = $3)
         AND ($4::timestamptz IS NULL OR c.created_at >= $4)`,
      [answeredFilter, searchFilter, sessionFilter, sinceFilter],
    ),
  ]);

  return {
    conversations: conversationsResult.rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      question: row.question,
      answer: row.answer,
      answered: row.answered,
      feedback: row.feedback,
      createdAt: row.created_at,
      sources: dedupeSources(row.sources),
    })),
    total: Number(totalResult.rows[0]?.count ?? 0),
  };
}

export async function deleteConversation(pool: Pool, id: string): Promise<boolean> {
  // conversation_sources referencia esta fila con ON DELETE CASCADE (ver
  // migración 0001), así que solo hace falta borrar la conversación.
  const result = await pool.query("DELETE FROM conversations WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}
