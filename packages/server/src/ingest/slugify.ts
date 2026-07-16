import { stripDiacritics } from "../lib/text.js";

export function slugify(text: string): string {
  return stripDiacritics(text.toLowerCase())
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
