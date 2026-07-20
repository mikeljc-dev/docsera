import * as cheerio from "cheerio";
import { slugify } from "./slugify.js";
import type { ContentBlock, ExtractedDocument } from "./types.js";

const REMOVE_SELECTOR = "script, style, nav, header, footer, noscript, svg, form, iframe";
const CONTENT_SELECTOR = "h1, h2, h3, h4, h5, h6, p, li, pre, blockquote";

export function extractFromHtml(html: string): ExtractedDocument {
  const $ = cheerio.load(html);
  $(REMOVE_SELECTOR).remove();

  const root = $("main").length ? $("main") : $("article").length ? $("article") : $("body");

  const title = $("title").first().text().trim() || $("h1").first().text().trim() || "Untitled";

  const blocks: ContentBlock[] = [];
  root.find(CONTENT_SELECTOR).each((_, el) => {
    const $el = $(el);
    const text = $el.text().replace(/\s+/g, " ").trim();
    if (!text) return;

    const tag = el.tagName?.toLowerCase();
    if (tag && /^h[1-6]$/.test(tag)) {
      const anchor = $el.attr("id") || slugify(text);
      blocks.push({ type: "heading", anchor, text });
    } else {
      blocks.push({ type: "text", text });
    }
  });

  return { title, blocks };
}
