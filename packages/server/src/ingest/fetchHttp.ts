import { VERSION } from "../version.js";

export const MAX_PAGES = 200;
export const FETCH_CONCURRENCY = 3;
export const FETCH_TIMEOUT_MS = 15_000;
export const USER_AGENT = `DocseraBot/${VERSION}`;
// Parsear un PDF es mucho más caro en CPU/memoria que texto plano; un límite
// generoso pero finito evita que un PDF de cientos de MB (o un enlace que
// sirve un archivo distinto al anunciado) tumbe la ingesta.
const MAX_PDF_BYTES = 20 * 1024 * 1024;

export async function fetchText(url: string): Promise<string> {
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

export async function fetchPdfBytes(url: string): Promise<Uint8Array> {
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
    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (contentLength > MAX_PDF_BYTES) {
      throw new Error(`PDF too large (${Math.round(contentLength / 1024 / 1024)} MB, 20 MB max)`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    // Content-Length puede faltar o mentir: la comprobación real es sobre lo
    // ya descargado, no solo sobre la cabecera.
    if (bytes.byteLength > MAX_PDF_BYTES) {
      throw new Error(`PDF too large (${Math.round(bytes.byteLength / 1024 / 1024)} MB, 20 MB max)`);
    }
    return bytes;
  } finally {
    clearTimeout(timeout);
  }
}

export async function mapWithConcurrency<T, R>(
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
