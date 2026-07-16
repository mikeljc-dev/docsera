import { slugify } from "./slugify.js";
import type { ContentBlock, ExtractedDocument } from "./types.js";

const HEADING_PATTERN = /^(#{1,6})\s+(.*)$/;
const CODE_FENCE_PATTERN = /^```/;

export function extractFromMarkdown(markdown: string, fallbackTitle: string): ExtractedDocument {
  const lines = markdown.split(/\r?\n/);
  const blocks: ContentBlock[] = [];

  let title = fallbackTitle;
  let firstH1Found = false;
  let inCodeBlock = false;
  let paragraphLines: string[] = [];
  let codeLines: string[] = [];

  const flushParagraph = () => {
    const text = paragraphLines.join(" ").trim();
    if (text) blocks.push({ type: "text", text });
    paragraphLines = [];
  };

  const flushCodeBlock = () => {
    const text = codeLines.join("\n").trim();
    if (text) blocks.push({ type: "text", text });
    codeLines = [];
  };

  for (const line of lines) {
    if (CODE_FENCE_PATTERN.test(line.trim())) {
      if (inCodeBlock) {
        codeLines.push(line);
        flushCodeBlock();
      } else {
        flushParagraph();
        codeLines.push(line);
      }
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    const headingMatch = HEADING_PATTERN.exec(line);
    if (headingMatch) {
      flushParagraph();
      const level = headingMatch[1]?.length ?? 1;
      const text = (headingMatch[2] ?? "").trim();
      blocks.push({ type: "heading", anchor: slugify(text), text });
      if (level === 1 && !firstH1Found) {
        title = text;
        firstH1Found = true;
      }
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      continue;
    }

    paragraphLines.push(line);
  }
  flushParagraph();
  flushCodeBlock();

  return { title, blocks };
}
