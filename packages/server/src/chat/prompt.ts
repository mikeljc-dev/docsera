import { stripDiacritics } from "../lib/text.js";
import type { ChatMessage } from "../llm/types.js";
import type { RetrievedChunk } from "./retrieve.js";

export const NO_ANSWER_TEXT = "No lo sé.";

const NORMALIZED_NO_ANSWER = "no lo se";

const SYSTEM_PROMPT = `Eres un asistente que responde preguntas basándote ÚNICAMENTE en la
documentación proporcionada como contexto. No inventes información que no
esté en el contexto. Si el contexto no contiene información suficiente para
responder la pregunta, responde exactamente y solo con: "${NO_ANSWER_TEXT}"

El contexto viene numerado (ej: [1], [2]) solo para que tú lo relaciones
internamente con su título; esos números no significan nada para quien lee
tu respuesta (las fuentes se muestran aparte, en otra parte de la interfaz).
No los menciones ni los copies en tu respuesta. Responde de forma natural,
como si simplemente supieras la respuesta.`;

export function buildChatMessages(question: string, chunks: RetrievedChunk[]): ChatMessage[] {
  const context = chunks
    .map((chunk, i) => `[${i + 1}] (${chunk.title})\n${chunk.content}`)
    .join("\n\n");

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `Contexto:\n\n${context}\n\nPregunta: ${question}` },
  ];
}

export function isNoAnswer(answer: string): boolean {
  const normalized = stripDiacritics(answer.trim().toLowerCase())
    .replace(/["'.!¡¿?]+$/g, "")
    .replace(/^["'.!¡¿?]+/g, "");
  return normalized === NORMALIZED_NO_ANSWER;
}
