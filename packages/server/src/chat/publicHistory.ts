import type { Pool } from "pg";
import type { Source } from "./index.js";
import { HISTORY_MAX_AGE_MINUTES, HISTORY_TURNS } from "./history.js";

export interface VisibleTurn {
  conversationId: string;
  question: string;
  answer: string | null;
  answered: boolean;
  feedback: "up" | "down" | null;
  sources: Source[];
}

interface ConversationRow {
  id: string;
  question: string;
  answer: string | null;
  answered: boolean;
  feedback: number | null;
}

interface SourceRow {
  conversation_id: string;
  url: string | null;
  title: string;
  anchor: string | null;
}

// Mismas fuentes que ve el widget al recibirlas de /chat: una por url#anchor,
// en el orden en que se citaron por primera vez (ver dedupeSources en
// chat/index.ts, que aplica el mismo criterio en caliente).
function dedupeSources(rows: SourceRow[]): Source[] {
  const seen = new Set<string>();
  const sources: Source[] = [];
  for (const row of rows) {
    const key = `${row.url ?? ""}#${row.anchor ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push({ url: row.url, title: row.title, anchor: row.anchor });
  }
  return sources;
}

function toFeedback(value: number | null): "up" | "down" | null {
  if (value === 1) return "up";
  if (value === -1) return "down";
  return null;
}

// A diferencia de loadRecentTurns (solo para el LLM, se salta lo sin
// respuesta), aquí van TODOS los turnos de la ventana: el usuario vio ese
// "no lo sé" en pantalla la primera vez y debe reaparecer igual al recargar.
export async function loadVisibleHistory(pool: Pool, sessionId: string): Promise<VisibleTurn[]> {
  const conversationsResult = await pool.query<ConversationRow>(
    `SELECT id, question, answer, answered, feedback
     FROM conversations
     WHERE session_id = $1
       AND created_at > now() - make_interval(mins => $2)
     ORDER BY created_at DESC
     LIMIT $3`,
    [sessionId, HISTORY_MAX_AGE_MINUTES, HISTORY_TURNS],
  );

  const conversations = conversationsResult.rows;
  if (conversations.length === 0) return [];

  const ids = conversations.map((row) => row.id);
  const sourcesResult = await pool.query<SourceRow>(
    `SELECT cs.conversation_id, d.url, d.title, ch.anchor
     FROM conversation_sources cs
     JOIN chunks ch ON ch.id = cs.chunk_id
     JOIN documents d ON d.id = ch.document_id
     WHERE cs.conversation_id = ANY($1::uuid[])`,
    [ids],
  );

  const sourcesByConversation = new Map<string, SourceRow[]>();
  for (const row of sourcesResult.rows) {
    const existing = sourcesByConversation.get(row.conversation_id);
    if (existing) existing.push(row);
    else sourcesByConversation.set(row.conversation_id, [row]);
  }

  return conversations
    .reverse()
    .map((row) => ({
      conversationId: row.id,
      question: row.question,
      answer: row.answer,
      answered: row.answered,
      feedback: toFeedback(row.feedback),
      sources: dedupeSources(sourcesByConversation.get(row.id) ?? []),
    }));
}
