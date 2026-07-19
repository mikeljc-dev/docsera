import { getPool } from "../lib/db.js";
import { getChatAdapter, getEmbeddingsAdapter } from "../llm/index.js";
import type { ChatMessage } from "../llm/types.js";
import { condenseQuestion } from "./condense.js";
import { loadRecentTurns } from "./history.js";
import { buildChatMessages, isNoAnswer, noAnswerText } from "./prompt.js";
import { retrieveRelevantChunks, type RetrievedChunk } from "./retrieve.js";
import { saveConversation } from "./store.js";

export interface ChatInput {
  question: string;
  sessionId: string;
}

export interface Source {
  url: string | null;
  title: string;
  anchor: string | null;
}

export interface ChatResult {
  answer: string;
  sources: Source[];
  sessionId: string;
  conversationId: string;
  answered: boolean;
}

// Todo lo que ocurre antes de generar: historial, reescritura, recuperación
// y montaje del prompt. Sin chunks no hay cobertura y no se llama al LLM;
// el llamador cierra con finishChat() y la frase de no-respuesta.
export interface PreparedChat {
  chunks: RetrievedChunk[];
  messages: ChatMessage[];
}

function dedupeSources(chunks: RetrievedChunk[]): Source[] {
  const seen = new Set<string>();
  const sources: Source[] = [];
  for (const chunk of chunks) {
    const key = `${chunk.url ?? ""}#${chunk.anchor ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push({ url: chunk.url, title: chunk.title, anchor: chunk.anchor });
  }
  return sources;
}

export async function prepareChat(input: ChatInput): Promise<PreparedChat> {
  const pool = getPool();

  // La recuperación usa la pregunta resuelta contra el historial; lo que se
  // guarda y se le muestra al modelo como pregunta sigue siendo la original.
  const turns = await loadRecentTurns(pool, input.sessionId);
  const searchQuery = await condenseQuestion(input.question, turns);

  const [questionEmbedding] = await getEmbeddingsAdapter().embed([searchQuery]);
  if (!questionEmbedding) {
    throw new Error("No se pudo generar el embedding de la pregunta");
  }

  const chunks = await retrieveRelevantChunks(pool, questionEmbedding, searchQuery);
  if (chunks.length === 0) {
    return { chunks, messages: [] };
  }

  return { chunks, messages: buildChatMessages(input.question, chunks, turns) };
}

// El LLM señala la falta de respuesta con un centinela; lo que se guarda y
// se devuelve es siempre la frase configurada para el usuario final.
export async function finishChat(
  input: ChatInput,
  chunks: RetrievedChunk[],
  rawAnswer: string,
): Promise<ChatResult> {
  const answered = !isNoAnswer(rawAnswer);
  const answer = answered ? rawAnswer : noAnswerText();

  const conversationId = await saveConversation(getPool(), {
    sessionId: input.sessionId,
    question: input.question,
    answer,
    answered,
    chunkIds: answered ? chunks.map((chunk) => chunk.id) : [],
  });

  return {
    answer,
    sources: answered ? dedupeSources(chunks) : [],
    sessionId: input.sessionId,
    conversationId,
    answered,
  };
}

export async function runChat(input: ChatInput): Promise<ChatResult> {
  const { chunks, messages } = await prepareChat(input);

  if (chunks.length === 0) {
    return finishChat(input, chunks, noAnswerText());
  }

  return finishChat(input, chunks, await getChatAdapter().chat(messages));
}
