import * as cheerio from "cheerio";
import { FETCH_CONCURRENCY, MAX_PAGES, fetchText, mapWithConcurrency } from "./fetchHttp.js";
import type { FetchError, RawDocument, ResolvedSources } from "./types.js";

// Un sitemap índice puede apuntar a otros sitemaps; más de un nivel de
// anidamiento es rarísimo y limitar la profundidad evita ciclos/abusos.
const MAX_SITEMAP_DEPTH = 2;

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

export async function collectSitemapPages(rootUrl: string): Promise<CollectedPages> {
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

export async function resolveSitemap(rootUrl: string): Promise<ResolvedSources> {
  const collected = await collectSitemapPages(rootUrl);

  if (collected.pages.length === 0 && collected.errors.length === 0) {
    throw new Error("The sitemap contains no valid URLs (<loc>)");
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
