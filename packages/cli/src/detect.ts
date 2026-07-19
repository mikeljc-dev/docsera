// Clasifica lo que el usuario teclea como "sus docs" en el tipo que espera
// POST /ingest, para no preguntarle también el tipo en el wizard.
export type IngestSource = {
  type: "url" | "sitemap" | "github";
  source: string;
};

// Mismo criterio que parseGithubSource en el server: owner/repo a pelo.
const GITHUB_SHORTHAND = /^[\w.-]+\/[\w.-]+$/;

export function detectSource(input: string): IngestSource | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;

  if (GITHUB_SHORTHAND.test(trimmed)) {
    return { type: "github", source: trimmed };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  if (url.hostname === "github.com" || url.hostname === "www.github.com") {
    return { type: "github", source: trimmed };
  }
  if (url.pathname.endsWith(".xml")) {
    return { type: "sitemap", source: trimmed };
  }
  return { type: "url", source: trimmed };
}
