import { stripDiacritics } from "../lib/text.js";
import type { ChatMessage } from "../llm/types.js";
import type { RetrievedChunk } from "./retrieve.js";

export const NO_ANSWER_TEXT = "No lo sé.";

const NORMALIZED_NO_ANSWER = "no lo se";

const SYSTEM_PROMPT = `Eres un asistente que responde preguntas basándote ÚNICAMENTE en la
documentación proporcionada como contexto. No inventes información que no
esté en el contexto. Si el contexto no contiene información suficiente para
responder la pregunta, responde exactamente y solo con: "${NO_ANSWER_TEXT}"`;

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
