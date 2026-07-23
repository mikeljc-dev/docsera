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
  // Ventana (en días) que abarca la gráfica diaria, para que el subtítulo del
  // dashboard no la tenga hardcodeada y quede desincronizada.
  chartDays: number;
}

// Cuántos días muestra la gráfica de actividad cuando el rango es "todo": una
// gráfica sin tope explotaría con meses de barras. Con un rango acotado, la
// gráfica usa ese mismo número de días.
const DEFAULT_CHART_DAYS = 30;

export async function getStats(pool: Pool, sinceDays: number | null = null): Promise<AdminStats> {
  const chartDays = sinceDays ?? DEFAULT_CHART_DAYS;

  const [totalsResult, unansweredResult, sourcesResult, dailyResult] = await Promise.all([
    pool.query<{ total: number; answered: number; up: number; down: number }>(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE answered)::int AS answered,
              count(*) FILTER (WHERE feedback = 1)::int AS up,
              count(*) FILTER (WHERE feedback = -1)::int AS down
       FROM conversations
       WHERE ($1::int IS NULL OR created_at >= now() - make_interval(days => $1))`,
      [sinceDays],
    ),
    // Agrupa por texto normalizado para juntar repeticiones de la misma
    // pregunta; min(question) elige una variante representativa.
    pool.query<{ question: string; times: number }>(
      `SELECT min(question) AS question, count(*)::int AS times
       FROM conversations
       WHERE NOT answered
         AND ($1::int IS NULL OR created_at >= now() - make_interval(days => $1))
       GROUP BY lower(trim(question))
       ORDER BY times DESC, max(created_at) DESC
       LIMIT 10`,
      [sinceDays],
    ),
    pool.query<{ title: string; url: string | null; anchor: string | null; times: number }>(
      `SELECT d.title, d.url, c.anchor, count(*)::int AS times
       FROM conversation_sources cs
       JOIN conversations conv ON conv.id = cs.conversation_id
       JOIN chunks c ON c.id = cs.chunk_id
       JOIN documents d ON d.id = c.document_id
       WHERE ($1::int IS NULL OR conv.created_at >= now() - make_interval(days => $1))
       GROUP BY d.title, d.url, c.anchor
       ORDER BY times DESC
       LIMIT 10`,
      [sinceDays],
    ),
    // generate_series + LEFT JOIN: los días sin actividad salen con total 0 en
    // vez de desaparecer, para que las barras sean equidistantes en el tiempo
    // y la forma de la gráfica no engañe.
    pool.query<{ day: string; total: number; unanswered: number }>(
      `SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
              COALESCE(a.total, 0)::int AS total,
              COALESCE(a.unanswered, 0)::int AS unanswered
       FROM generate_series(
              date_trunc('day', now()) - make_interval(days => $1 - 1),
              date_trunc('day', now()),
              interval '1 day'
            ) AS d(day)
       LEFT JOIN (
         SELECT date_trunc('day', created_at) AS day,
                count(*)::int AS total,
                count(*) FILTER (WHERE NOT answered)::int AS unanswered
         FROM conversations
         WHERE created_at >= date_trunc('day', now()) - make_interval(days => $1 - 1)
         GROUP BY 1
       ) a ON a.day = d.day
       ORDER BY d.day`,
      [chartDays],
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
    chartDays,
  };
}
