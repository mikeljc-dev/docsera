import type { Pool } from "pg";

export interface Turn {
  question: string;
  answer: string;
}

// Cuántos turnos previos se arrastran. Suficiente para resolver referencias
// ("¿y eso cómo se configura?") sin inflar el prompt ni el coste.
// Exportadas: chat/publicHistory.ts las reutiliza para que la ventana que ve
// el widget al recargar sea EXACTAMENTE la misma que la que usa el LLM para
// reescribir preguntas — si no coincidieran, el widget mostraría un turno
// que el modelo ya no recuerda (o viceversa).
export const HISTORY_TURNS = 3;

// El widget guarda el sessionId en localStorage y no caduca nunca: sin esta
// ventana, una pregunta de hoy se reescribiría con el contexto de una visita
// de la semana pasada. Un hueco largo se trata como conversación nueva.
export const HISTORY_MAX_AGE_MINUTES = 30;

export async function loadRecentTurns(pool: Pool, sessionId: string): Promise<Turn[]> {
  // Los turnos sin respuesta se saltan (no cortan la conversación): un "no lo
  // sé" no aporta nada sobre la doc y su pregunta contamina la reescritura.
  // Medido el 2026-07-19 con un turno sobre precios sin responder de por
  // medio, "¿cómo lo configuro?" pasaba de "¿Cómo configurar Docsera para que
  // soporte Ollama?" a "¿Cómo se configura la suscripción de Docsera...?".
  const result = await pool.query<{ question: string; answer: string | null }>(
    `SELECT question, answer
     FROM conversations
     WHERE session_id = $1
       AND answered = true
       AND created_at > now() - make_interval(mins => $2)
     ORDER BY created_at DESC
     LIMIT $3`,
    [sessionId, HISTORY_MAX_AGE_MINUTES, HISTORY_TURNS],
  );

  return result.rows
    .filter((row): row is { question: string; answer: string } => row.answer !== null)
    .reverse()
    .map((row) => ({ question: row.question, answer: row.answer }));
}
