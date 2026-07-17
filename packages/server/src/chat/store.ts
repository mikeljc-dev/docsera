import type { Pool } from "pg";

export interface ConversationInput {
  sessionId: string;
  question: string;
  answer: string;
  answered: boolean;
  chunkIds: string[];
}

export async function saveConversation(pool: Pool, input: ConversationInput): Promise<string> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const inserted = await client.query<{ id: string }>(
      "INSERT INTO conversations (session_id, question, answer, answered) VALUES ($1, $2, $3, $4) RETURNING id",
      [input.sessionId, input.question, input.answer, input.answered],
    );
    const conversationId = inserted.rows[0]?.id;
    if (!conversationId) {
      throw new Error("No se pudo crear la conversación");
    }

    for (const chunkId of input.chunkIds) {
      await client.query(
        "INSERT INTO conversation_sources (conversation_id, chunk_id) VALUES ($1, $2)",
        [conversationId, chunkId],
      );
    }

    await client.query("COMMIT");
    return conversationId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
