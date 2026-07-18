import type { Pool } from "pg";

export interface AdminStats {
  totals: {
    total: number;
    answered: number;
    unanswered: number;
    feedbackUp: number;
    feedbackDown: number;
  };
  topUnanswered: { question: string; times: number }[];
  topSources: { title: string; url: string | null; anchor: string | null; times: number }[];
  daily: { day: string; total: number; unanswered: number }[];
}

export async function getStats(pool: Pool): Promise<AdminStats> {
  const [totalsResult, unansweredResult, sourcesResult, dailyResult] = await Promise.all([
    pool.query<{ total: number; answered: number; up: number; down: number }>(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE answered)::int AS answered,
              count(*) FILTER (WHERE feedback = 1)::int AS up,
              count(*) FILTER (WHERE feedback = -1)::int AS down
       FROM conversations`,
    ),
    // Agrupa por texto normalizado para juntar repeticiones de la misma
    // pregunta; min(question) elige una variante representativa.
    pool.query<{ question: string; times: number }>(
      `SELECT min(question) AS question, count(*)::int AS times
       FROM conversations
       WHERE NOT answered
       GROUP BY lower(trim(question))
       ORDER BY times DESC, max(created_at) DESC
       LIMIT 10`,
    ),
    pool.query<{ title: string; url: string | null; anchor: string | null; times: number }>(
      `SELECT d.title, d.url, c.anchor, count(*)::int AS times
       FROM conversation_sources cs
       JOIN chunks c ON c.id = cs.chunk_id
       JOIN documents d ON d.id = c.document_id
       GROUP BY d.title, d.url, c.anchor
       ORDER BY times DESC
       LIMIT 10`,
    ),
    pool.query<{ day: string; total: number; unanswered: number }>(
      `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
              count(*)::int AS total,
              count(*) FILTER (WHERE NOT answered)::int AS unanswered
       FROM conversations
       WHERE created_at > now() - interval '14 days'
       GROUP BY 1
       ORDER BY 1`,
    ),
  ]);

  const totals = totalsResult.rows[0] ?? { total: 0, answered: 0, up: 0, down: 0 };

  return {
    totals: {
      total: totals.total,
      answered: totals.answered,
      unanswered: totals.total - totals.answered,
      feedbackUp: totals.up,
      feedbackDown: totals.down,
    },
    topUnanswered: unansweredResult.rows,
    topSources: sourcesResult.rows,
    daily: dailyResult.rows,
  };
}
