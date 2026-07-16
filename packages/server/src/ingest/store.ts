import { createHash } from "node:crypto";
import type { Pool } from "pg";
import type { Chunk } from "./chunk.js";

export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export async function findDocumentByUrl(
  pool: Pool,
  url: string,
): Promise<{ id: string; contentHash: string } | null> {
  const result = await pool.query<{ id: string; content_hash: string }>(
    "SELECT id, content_hash FROM documents WHERE url = $1",
    [url],
  );
  const row = result.rows[0];
  return row ? { id: row.id, contentHash: row.content_hash } : null;
}

export interface DocumentIdentity {
  url: string | null;
  title: string;
  contentHash: string;
}

export async function upsertDocumentWithChunks(
  pool: Pool,
  doc: DocumentIdentity,
  chunks: Chunk[],
  embeddings: number[][],
): Promise<{ status: "created" | "updated"; chunks: number }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = doc.url
      ? await client.query<{ id: string }>("SELECT id FROM documents WHERE url = $1", [doc.url])
      : { rows: [] as { id: string }[] };

    let documentId: string;
    let status: "created" | "updated";

    const existingRow = existing.rows[0];
    if (existingRow) {
      documentId = existingRow.id;
      await client.query(
        "UPDATE documents SET title = $1, content_hash = $2, updated_at = now() WHERE id = $3",
        [doc.title, doc.contentHash, documentId],
      );
      await client.query("DELETE FROM chunks WHERE document_id = $1", [documentId]);
      status = "updated";
    } else {
      const inserted = await client.query<{ id: string }>(
        "INSERT INTO documents (url, title, content_hash) VALUES ($1, $2, $3) RETURNING id",
        [doc.url, doc.title, doc.contentHash],
      );
      const insertedRow = inserted.rows[0];
      if (!insertedRow) {
        throw new Error("No se pudo crear el documento");
      }
      documentId = insertedRow.id;
      status = "created";
    }

    for (const [i, chunk] of chunks.entries()) {
      await client.query(
        "INSERT INTO chunks (document_id, chunk_index, content, anchor, embedding) VALUES ($1, $2, $3, $4, $5)",
        [documentId, chunk.index, chunk.content, chunk.anchor, JSON.stringify(embeddings[i])],
      );
    }

    await client.query("COMMIT");
    return { status, chunks: chunks.length };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
