import {
  FETCH_CONCURRENCY,
  FETCH_TIMEOUT_MS,
  MAX_PAGES,
  USER_AGENT,
  fetchText,
  mapWithConcurrency,
} from "./fetchHttp.js";
import type { FetchError, IngestSourceInput, RawDocument, ResolvedSources } from "./types.js";

export function parseGithubSource(source: string): { owner: string; repo: string } | null {
  const match = /^(?:https?:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(
    source.trim(),
  );
  if (!match?.[1] || !match[2]) return null;
  return { owner: match[1], repo: match[2] };
}

export function isMarkdownDocPath(path: string, prefix?: string): boolean {
  if (!/\.(md|mdx)$/i.test(path)) return false;
  if (!prefix) return true;
  const normalized = prefix.replace(/^\/+|\/+$/g, "");
  return normalized === "" || path === normalized || path.startsWith(`${normalized}/`);
}

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    Accept: "application/vnd.github+json",
  };
  // Opcional: sin token, la API publica limita a 60 peticiones/hora por IP
  if (process.env.GITHUB_TOKEN) {
    headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function fetchGithubJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: githubHeaders() });
    if (!response.ok) {
      const hint =
        response.status === 403 || response.status === 429
          ? " (GitHub API rate limit? Set GITHUB_TOKEN)"
          : "";
      throw new Error(`GitHub API HTTP ${response.status}${hint}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

interface GithubTreeEntry {
  path: string;
  type: string;
}

export async function resolveGithub(input: IngestSourceInput): Promise<ResolvedSources> {
  const parsed = parseGithubSource(input.source);
  if (!parsed) {
    throw new Error('source must be "owner/repo" or a github.com URL for type "github"');
  }
  const { owner, repo } = parsed;
  const api = `https://api.github.com/repos/${owner}/${repo}`;

  const branch =
    input.branch ?? (await fetchGithubJson<{ default_branch: string }>(api)).default_branch;

  const tree = await fetchGithubJson<{ tree: GithubTreeEntry[]; truncated: boolean }>(
    `${api}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
  );

  const files = tree.tree
    .filter((entry) => entry.type === "blob" && isMarkdownDocPath(entry.path, input.path))
    .map((entry) => entry.path);

  if (files.length === 0) {
    throw new Error("The repo has no .md/.mdx files at the given path");
  }

  const truncated = tree.truncated || files.length > MAX_PAGES;
  const selected = files.slice(0, MAX_PAGES);

  const outcomes = await mapWithConcurrency(selected, FETCH_CONCURRENCY, async (path) => {
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
    const blobUrl = `https://github.com/${owner}/${repo}/blob/${branch}/${path}`;
    try {
      const content = await fetchText(rawUrl);
      return {
        ok: true as const,
        doc: {
          url: blobUrl,
          title: "",
          rawContent: content,
          format: "markdown" as const,
          fallbackTitle: path,
        },
      };
    } catch (error) {
      return {
        ok: false as const,
        error: { url: blobUrl, message: error instanceof Error ? error.message : String(error) },
      };
    }
  });

  const documents: RawDocument[] = [];
  const errors: FetchError[] = [];
  for (const outcome of outcomes) {
    if (outcome.ok) documents.push(outcome.doc);
    else errors.push(outcome.error);
  }

  return { documents, errors, truncated };
}
