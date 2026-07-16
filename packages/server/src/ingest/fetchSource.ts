import * as cheerio from "cheerio";

export const MAX_PAGES = 200;
// Un sitemap índice puede apuntar a otros sitemaps; más de un nivel de
// anidamiento es rarísimo y limitar la profundidad evita ciclos/abusos.
const MAX_SITEMAP_DEPTH = 2;
const FETCH_CONCURRENCY = 3;
const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT = "DocseraBot/0.1.0";

export interface RawDocument {
  url: string | null;
  title: string;
  rawContent: string;
  format: "markdown" | "html";
}

export interface FetchError {
  url: string;
  message: string;
}

export interface IngestSourceInput {
  type: "markdown" | "url" | "sitemap";
  source: string;
  url?: string;
  title?: string;
}

export interface ResolvedSources {
  documents: RawDocument[];
  errors: FetchError[];
  truncated: boolean;
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const current = next++;
      const item = items[current];
      if (item !== undefined) {
        results[current] = await fn(item);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export interface ParsedSitemap {
  pages: string[];
  sitemaps: string[];
}

export function parseSitemap(xml: string): ParsedSitemap {
  const $ = cheerio.load(xml, { xmlMode: true });
  const textOf = (selector: string): string[] =>
    $(selector)
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean);

  const sitemaps = textOf("sitemapindex sitemap loc");
  const pages = textOf("urlset url loc");

  if (sitemaps.length === 0 && pages.length === 0) {
    // Sitemap no estándar: tratar cualquier <loc> como página.
    return { pages: textOf("loc"), sitemaps: [] };
  }

  return { pages, sitemaps };
}

interface CollectedPages {
  pages: string[];
  errors: FetchError[];
  truncated: boolean;
}

async function collectSitemapPages(rootUrl: string): Promise<CollectedPages> {
  const pages: string[] = [];
  const errors: FetchError[] = [];
  const seen = new Set<string>([rootUrl]);
  let truncated = false;

  let queue: string[] = [rootUrl];

  for (let depth = 0; depth <= MAX_SITEMAP_DEPTH && queue.length > 0; depth++) {
    const nextQueue: string[] = [];

    for (const sitemapUrl of queue) {
      if (pages.length >= MAX_PAGES) {
        truncated = true;
        break;
      }

      let parsed: ParsedSitemap;
      try {
        parsed = parseSitemap(await fetchText(sitemapUrl));
      } catch (error) {
        // El sitemap raíz inaccesible es un error de la petición entera;
        // uno anidado que falla solo pierde sus páginas.
        if (sitemapUrl === rootUrl) throw error;
        errors.push({
          url: sitemapUrl,
          message: error instanceof Error ? error.message : String(error),
        });
        continue;
      }

      for (const page of parsed.pages) {
        if (seen.has(page)) continue;
        seen.add(page);
        if (pages.length >= MAX_PAGES) {
          truncated = true;
          break;
        }
        pages.push(page);
      }

      for (const nested of parsed.sitemaps) {
        if (seen.has(nested)) continue;
        seen.add(nested);
        if (depth >= MAX_SITEMAP_DEPTH) {
          truncated = true;
          continue;
        }
        nextQueue.push(nested);
      }
    }

    queue = nextQueue;
  }

  return { pages, errors, truncated };
}

export async function resolveSources(input: IngestSourceInput): Promise<ResolvedSources> {
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

  // sitemap (con soporte de sitemaps índice anidados)
  const collected = await collectSitemapPages(input.source);

  if (collected.pages.length === 0 && collected.errors.length === 0) {
    throw new Error("El sitemap no contiene URLs (<loc>) válidas");
  }

  const { pages: urls, truncated } = collected;

  const outcomes = await mapWithConcurrency(urls, FETCH_CONCURRENCY, async (pageUrl) => {
    try {
      const html = await fetchText(pageUrl);
      return { ok: true as const, doc: { url: pageUrl, title: "", rawContent: html, format: "html" as const } };
    } catch (error) {
      return {
        ok: false as const,
        error: { url: pageUrl, message: error instanceof Error ? error.message : String(error) },
      };
    }
  });

  const documents: RawDocument[] = [];
  const errors: FetchError[] = [...collected.errors];
  for (const outcome of outcomes) {
    if (outcome.ok) {
      documents.push(outcome.doc);
    } else {
      errors.push(outcome.error);
    }
  }

  return { documents, errors, truncated };
}
