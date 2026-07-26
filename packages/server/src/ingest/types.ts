export interface ContentBlock {
  type: "heading" | "text";
  anchor?: string;
  text: string;
}

export interface ExtractedDocument {
  title: string;
  blocks: ContentBlock[];
}

interface RawTextDocument {
  url: string | null;
  title: string;
  format: "markdown" | "html";
  rawContent: string;
  /** Título de último recurso si el contenido no trae uno (ej: ruta del archivo). */
  fallbackTitle?: string;
}

interface RawPdfDocument {
  url: string | null;
  title: string;
  format: "pdf";
  rawContent: Uint8Array;
  fallbackTitle?: string;
}

// Discriminado por `format` a propósito: así el compilador obliga a tratar
// los bytes de un PDF distinto del texto de markdown/HTML en vez de confiar
// en que el llamador lo recuerde.
export type RawDocument = RawTextDocument | RawPdfDocument;

export interface FetchError {
  url: string;
  message: string;
}

export interface IngestSourceInput {
  type: "markdown" | "url" | "sitemap" | "github" | "pdf";
  source: string;
  url?: string;
  title?: string;
  /** Solo para type "github": rama (default: la rama por defecto del repo). */
  branch?: string;
  /** Solo para type "github": prefijo de carpeta para acotar (ej: "docs"). */
  path?: string;
  /**
   * Enmascara secretos conocidos (API keys, tokens, claves privadas) y
   * números de tarjeta antes de guardar e indexar. Por petición, no global:
   * decide quien ingesta CADA documento, porque el mismo enmascarado que
   * conviene en una wiki interna rompería un tutorial de pagos con la
   * tarjeta de test oficial de Stripe. Apagado por defecto.
   */
  redactSecrets?: boolean;
}

export interface ResolvedSources {
  documents: RawDocument[];
  errors: FetchError[];
  truncated: boolean;
}
