import * as cheerio from "cheerio";

export const MAX_PAGES = 200;
const FETCH_CONCURRENCY = 3;
const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT = "AskDocsBot/0.0.1";

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

  // sitemap
  const xml = await fetchText(input.source);
  const $ = cheerio.load(xml, { xmlMode: true });
  const allUrls = $("loc")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);

  if (allUrls.length === 0) {
    throw new Error("El sitemap no contiene URLs (<loc>) válidas");
  }

  const truncated = allUrls.length > MAX_PAGES;
  const urls = allUrls.slice(0, MAX_PAGES);

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
  const errors: FetchError[] = [];
  for (const outcome of outcomes) {
    if (outcome.ok) {
      documents.push(outcome.doc);
    } else {
      errors.push(outcome.error);
    }
  }

  return { documents, errors, truncated };
}
