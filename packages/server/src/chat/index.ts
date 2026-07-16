import { getPool } from "../lib/db.js";
import { getChatAdapter, getEmbeddingsAdapter } from "../llm/index.js";
import { buildChatMessages, isNoAnswer, NO_ANSWER_TEXT } from "./prompt.js";
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

export async function runChat(input: ChatInput): Promise<ChatResult> {
  const pool = getPool();
  const [questionEmbedding] = await getEmbeddingsAdapter().embed([input.question]);
  if (!questionEmbedding) {
    throw new Error("No se pudo generar el embedding de la pregunta");
  }

  const chunks = await retrieveRelevantChunks(pool, questionEmbedding);

  if (chunks.length === 0) {
    await saveConversation(pool, {
      sessionId: input.sessionId,
      question: input.question,
      answer: NO_ANSWER_TEXT,
      answered: false,
      chunkIds: [],
    });
    return { answer: NO_ANSWER_TEXT, sources: [], sessionId: input.sessionId };
  }

  const messages = buildChatMessages(input.question, chunks);
  const answer = await getChatAdapter().chat(messages);
  const answered = !isNoAnswer(answer);

  await saveConversation(pool, {
    sessionId: input.sessionId,
    question: input.question,
    answer,
    answered,
    chunkIds: answered ? chunks.map((chunk) => chunk.id) : [],
  });

  return { answer, sources: answered ? dedupeSources(chunks) : [], sessionId: input.sessionId };
}
