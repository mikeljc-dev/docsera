import { fetchPdfBytes, fetchText } from "./fetchHttp.js";
import { resolveGithub } from "./fetchGithub.js";
import { resolveSitemap } from "./fetchSitemap.js";
import type { IngestSourceInput, ResolvedSources } from "./types.js";

// Re-exportado aquí para no cambiar los importadores existentes: routes/ingest.ts
// valida con isValidUrl/parseGithubSource, e index.ts consume IngestSourceInput.
export { isValidUrl } from "./fetchHttp.js";
export { parseGithubSource } from "./fetchGithub.js";
export type { IngestSourceInput } from "./types.js";

// Punto de entrada de la ingesta: elige el resolutor según el tipo de fuente.
// Cada rama vive en su propio módulo (fetchGithub/fetchSitemap) salvo las
// triviales (markdown ya trae el contenido, url/pdf son una sola descarga).
export async function resolveSources(input: IngestSourceInput): Promise<ResolvedSources> {
  if (input.type === "github") {
    return resolveGithub(input);
  }

  if (input.type === "markdown") {
    return {
      documents: [
        {
          url: input.url ?? null,
          title: input.title ?? "",
          rawContent: input.source,
          format: "markdown",
        },
      ],
      errors: [],
      truncated: false,
    };
  }

  if (input.type === "url") {
    try {
      const html = await fetchText(input.source);
      return {
        documents: [{ url: input.source, title: input.title ?? "", rawContent: html, format: "html" }],
        errors: [],
        truncated: false,
      };
    } catch (error) {
      return {
        documents: [],
        errors: [{ url: input.source, message: error instanceof Error ? error.message : String(error) }],
        truncated: false,
      };
    }
  }

  if (input.type === "pdf") {
    try {
      const bytes = await fetchPdfBytes(input.source);
      return {
        documents: [{ url: input.source, title: input.title ?? "", rawContent: bytes, format: "pdf" }],
        errors: [],
        truncated: false,
      };
    } catch (error) {
      return {
        documents: [],
        errors: [{ url: input.source, message: error instanceof Error ? error.message : String(error) }],
        truncated: false,
      };
    }
  }

  // sitemap (con soporte de sitemaps índice anidados)
  return resolveSitemap(input.source);
}
