import type { ChatMessage, HistoryTurn } from "./types.js";

// Convierte los turnos que devuelve GET /chat/history en los mensajes que
// pinta el widget: cada turno se abre en dos (pregunta del usuario +
// respuesta del asistente). Pura a proposito para poder testear el manejo
// de nulos/vacios (answer null, sin fuentes, sin feedback) sin montar el
// fetch ni el DOM; el mapeo vive en loadHistory() del widget.
export function mapHistoryToMessages(turns: HistoryTurn[]): ChatMessage[] {
  return turns.flatMap((turn) => [
    { role: "user" as const, content: turn.question },
    {
      role: "assistant" as const,
      content: turn.answer ?? "",
      answered: turn.answered,
      conversationId: turn.conversationId,
      // Un array vacio se colapsa a undefined para que renderMessage no pinte
      // un bloque de fuentes vacio (distingue "sin fuentes" de "aun no hay").
      sources: turn.sources.length > 0 ? turn.sources : undefined,
      feedback: turn.feedback ?? undefined,
    },
  ]);
}
