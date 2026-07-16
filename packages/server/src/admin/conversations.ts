import type { Pool } from "pg";

export interface ConversationRow {
  id: string;
  sessionId: string;
  question: string;
  answer: string | null;
  answered: boolean;
  createdAt: string;
  sourceCount: number;
}

export interface ListConversationsOptions {
  answered?: boolean;
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
  created_at: string;
  source_count: number;
}

export async function listConversations(
  pool: Pool,
  options: ListConversationsOptions,
): Promise<ListConversationsResult> {
  const answeredFilter = options.answered ?? null;

  const [conversationsResult, totalResult] = await Promise.all([
    pool.query<RawConversationRow>(
      `SELECT c.id, c.session_id, c.question, c.answer, c.answered, c.created_at,
              count(cs.chunk_id)::int AS source_count
       FROM conversations c
       LEFT JOIN conversation_sources cs ON cs.conversation_id = c.id
       WHERE $1::boolean IS NULL OR c.answered = $1
       GROUP BY c.id
       ORDER BY c.created_at DESC
       LIMIT $2 OFFSET $3`,
      [answeredFilter, options.limit, options.offset],
    ),
    pool.query<{ count: string }>(
      "SELECT count(*) FROM conversations WHERE $1::boolean IS NULL OR answered = $1",
      [answeredFilter],
    ),
  ]);

  return {
    conversations: conversationsResult.rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      question: row.question,
      answer: row.answer,
      answered: row.answered,
      createdAt: row.created_at,
      sourceCount: row.source_count,
    })),
    total: Number(totalResult.rows[0]?.count ?? 0),
  };
}
