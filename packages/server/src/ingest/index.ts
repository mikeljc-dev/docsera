import { getPool } from "../lib/db.js";
import { getEmbeddingsAdapter } from "../llm/index.js";
import { chunkBlocks } from "./chunk.js";
import { extractFromHtml } from "./extractHtml.js";
import { extractFromMarkdown } from "./extractMarkdown.js";
import { extractFromPdf } from "./extractPdf.js";
import { type IngestSourceInput, resolveSources } from "./fetchSource.js";
import { redactSecrets } from "./redactSecrets.js";
import {
  findDocumentByUrl,
  findUrllessDocumentByHash,
  hashContent,
  upsertDocumentWithChunks,
} from "./store.js";

export type { IngestSourceInput } from "./fetchSource.js";

export interface IngestDocumentResult {
  url: string | null;
  title: string;
  status: "created" | "updated" | "unchanged" | "failed";
  chunks: number;
  /** Secretos/tarjetas enmascarados antes de guardar (solo si se pidió `redactSecrets`). */
  redactions?: number;
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
      // Sin url no hay identidad estable: el hash al menos evita duplicar
      // el documento al re-ingerir el mismo markdown tal cual.
      const existing = rawDoc.url
        ? await findDocumentByUrl(pool, rawDoc.url)
        : await findUrllessDocumentByHash(pool, contentHash);

      if (existing && existing.contentHash === contentHash) {
        results.push({
          url: rawDoc.url,
          title: rawDoc.title || rawDoc.url || "",
          status: "unchanged",
          chunks: 0,
        });
        continue;
      }

      const lastResort = rawDoc.fallbackTitle || rawDoc.url || "Untitled";
      const extracted =
        rawDoc.format === "pdf"
          ? await extractFromPdf(rawDoc.rawContent, rawDoc.title || lastResort)
          : rawDoc.format === "markdown"
            ? extractFromMarkdown(rawDoc.rawContent, rawDoc.title || lastResort)
            : extractFromHtml(rawDoc.rawContent);

      const title = rawDoc.title || extracted.title || lastResort;
      let chunks = chunkBlocks(extracted.blocks);

      if (chunks.length === 0) {
        results.push({ url: rawDoc.url, title, status: "failed", chunks: 0, error: "No content extracted" });
        continue;
      }

      // Opt-in por petición, no global: solo quien ingesta un documento
      // concreto sabe si su contenido puede llevar un secreto real
      // filtrado por error (una wiki interna) o si al revés necesita ese
      // dato tal cual (un tutorial de pagos con la tarjeta de test oficial
      // de Stripe, que pasaría Luhn igual que una real). Enmascara ANTES
      // de generar embeddings, para que el valor real nunca llegue a
      // guardarse ni a indexarse. Deliberadamente no toca emails/teléfonos
      // (ver redactSecrets.ts).
      let redactions: number | undefined;
      if (input.redactSecrets === true) {
        redactions = 0;
        chunks = chunks.map((chunk) => {
          const redacted = redactSecrets(chunk.content);
          redactions! += redacted.count;
          return { ...chunk, content: redacted.text };
        });
      }

      const embeddings = await getEmbeddingsAdapter().embed(chunks.map((chunk) => chunk.content));

      const stored = await upsertDocumentWithChunks(
        pool,
        { url: rawDoc.url, title, contentHash },
        chunks,
        embeddings,
      );

      results.push({
        url: rawDoc.url,
        title,
        status: stored.status,
        chunks: stored.chunks,
        ...(redactions !== undefined ? { redactions } : {}),
      });
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
