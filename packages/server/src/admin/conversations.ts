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

export interface ListConversationsOptions {
  answered?: boolean;
  search?: string;
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

  const [conversationsResult, totalResult] = await Promise.all([
    pool.query<RawConversationRow>(
      `SELECT c.id, c.session_id, c.question, c.answer, c.answered, c.feedback, c.created_at,
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
       GROUP BY c.id
       ORDER BY c.created_at DESC
       LIMIT $2 OFFSET $3`,
      [answeredFilter, options.limit, options.offset, searchFilter],
    ),
    pool.query<{ count: string }>(
      `SELECT count(*) FROM conversations
       WHERE ($1::boolean IS NULL OR answered = $1)
         AND ($2::text IS NULL OR question ILIKE '%' || $2 || '%')`,
      [answeredFilter, searchFilter],
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
