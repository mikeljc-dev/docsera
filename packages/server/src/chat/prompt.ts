import { stripDiacritics } from "../lib/text.js";
import type { ChatMessage } from "../llm/types.js";
import type { RetrievedChunk } from "./retrieve.js";

export const DEFAULT_NO_ANSWER_TEXT = "I don't know.";

// El LLM señala "no hay respuesta" con un centinela ASCII estable en vez de
// una frase localizada: pedirle repetir una frase exacta en el idioma del
// usuario falla con modelos pequeños (responden variantes tipo "No sé" y la
// detección se rompe). El server sustituye el centinela por la frase
// configurada antes de guardarla o devolverla.
const NO_ANSWER_SENTINEL = "NO_ANSWER";

// Frase que ve el usuario final cuando la doc no tiene la respuesta.
// Configurable (CHAT_NO_ANSWER_TEXT) para ponerla en el idioma de sus
// usuarios; isNoAnswer() también la reconoce por si el LLM la repite.
export function noAnswerText(): string {
  return process.env.CHAT_NO_ANSWER_TEXT?.trim() || DEFAULT_NO_ANSWER_TEXT;
}

function buildSystemPrompt(): string {
  return `You are an assistant that answers questions based ONLY on the
documentation provided as context. Never invent information that is not in
the context. Answer in the same language the question is asked in. If the
context does not contain enough information to answer the question, reply
exactly and only with: ${NO_ANSWER_SENTINEL}

The context items are numbered (e.g. [1], [2]) only so you can relate them
internally to their titles; those numbers mean nothing to the reader (the
sources are shown separately, elsewhere in the interface). Never write those
bracketed numbers in your answer, and never name the context or its titles
as if quoting them. Answer naturally, as if you simply knew the answer.

Your answer is rendered in a small chat bubble that supports only simple
Markdown: **bold**, \`inline code\`, fenced code blocks and short "-"
lists. Do not use headers, tables or links. Keep answers short — a few
sentences, plus a code block when it genuinely helps.`;
}

export function buildChatMessages(question: string, chunks: RetrievedChunk[]): ChatMessage[] {
  const context = chunks
    .map((chunk, i) => `[${i + 1}] (${chunk.title})\n${chunk.content}`)
    .join("\n\n");

  return [
    { role: "system", content: buildSystemPrompt() },
    { role: "user", content: `Context:\n\n${context}\n\nQuestion: ${question}` },
  ];
}

function normalize(text: string): string {
  // Recorta tambien guiones, asteriscos, backticks, etc. en los bordes:
  // los modelos pequenos decoran el centinela ("-NO_ANSWER-", "**NO_ANSWER**").
  return stripDiacritics(text.trim().toLowerCase())
    .replace(/[\s"'`*_\-\u2013\u2014.!¡¿?:;]+$/g, "")
    .replace(/^[\s"'`*_\-\u2013\u2014.!¡¿?:;]+/g, "");
}

export function isNoAnswer(answer: string): boolean {
  const normalized = normalize(answer);
  return (
    normalized === NO_ANSWER_SENTINEL.toLowerCase() ||
    normalized === "no answer" ||
    normalized === normalize(noAnswerText())
  );
}
