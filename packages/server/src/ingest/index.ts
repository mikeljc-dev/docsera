import { getPool } from "../lib/db.js";
import { chunkBlocks } from "./chunk.js";
import { embedTexts } from "./embeddings.js";
import { extractFromHtml } from "./extractHtml.js";
import { extractFromMarkdown } from "./extractMarkdown.js";
import { type IngestSourceInput, resolveSources } from "./fetchSource.js";
import { findDocumentByUrl, hashContent, upsertDocumentWithChunks } from "./store.js";

export type { IngestSourceInput } from "./fetchSource.js";

export interface IngestDocumentResult {
  url: string | null;
  title: string;
  status: "created" | "updated" | "unchanged" | "failed";
  chunks: number;
  error?: string;
}

export interface IngestResult {
  documents: IngestDocumentResult[];
  truncated: boolean;
}

export async function runIngest(input: IngestSourceInput): Promise<IngestResult> {
  const { documents: rawDocuments, errors, truncated } = await resolveSources(input);
  const pool = getPool();

  const results: IngestDocumentResult[] = errors.map((error) => ({
    url: error.url,
    title: "",
    status: "failed",
    chunks: 0,
    error: error.message,
  }));

  for (const rawDoc of rawDocuments) {
    try {
      const contentHash = hashContent(rawDoc.rawContent);
      const existing = rawDoc.url ? await findDocumentByUrl(pool, rawDoc.url) : null;

      if (existing && existing.contentHash === contentHash) {
        results.push({
          url: rawDoc.url,
          title: rawDoc.title || rawDoc.url || "",
          status: "unchanged",
          chunks: 0,
        });
        continue;
      }

      const extracted =
        rawDoc.format === "markdown"
          ? extractFromMarkdown(rawDoc.rawContent, rawDoc.title || rawDoc.url || "Sin título")
          : extractFromHtml(rawDoc.rawContent);

      const title = rawDoc.title || extracted.title || rawDoc.url || "Sin título";
      const chunks = chunkBlocks(extracted.blocks);

      if (chunks.length === 0) {
        results.push({ url: rawDoc.url, title, status: "failed", chunks: 0, error: "No se extrajo contenido" });
        continue;
      }

      const embeddings = await embedTexts(chunks.map((chunk) => chunk.content));

      const stored = await upsertDocumentWithChunks(
        pool,
        { url: rawDoc.url, title, contentHash },
        chunks,
        embeddings,
      );

      results.push({ url: rawDoc.url, title, status: stored.status, chunks: stored.chunks });
    } catch (error) {
      results.push({
        url: rawDoc.url,
        title: rawDoc.title,
        status: "failed",
        chunks: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { documents: results, truncated };
}
