import type { ContentBlock } from "./types.js";

const MAX_CHUNK_CHARS = 1500;

export interface Chunk {
  index: number;
  anchor: string | null;
  content: string;
}

interface Section {
  anchor: string | null;
  parts: string[];
}

export function chunkBlocks(blocks: ContentBlock[]): Chunk[] {
  const sections: Section[] = [];
  let anchor: string | null = null;
  let parts: string[] = [];

  const closeSection = () => {
    if (parts.length > 0) sections.push({ anchor, parts });
    parts = [];
  };

  for (const block of blocks) {
    if (block.type === "heading") {
      closeSection();
      anchor = block.anchor ?? anchor;
    } else {
      parts.push(block.text);
    }
  }
  closeSection();

  const chunks: Chunk[] = [];
  for (const section of sections) {
    let buffer = "";
    for (const part of section.parts) {
      const candidate = buffer ? `${buffer}\n\n${part}` : part;
      if (candidate.length > MAX_CHUNK_CHARS && buffer) {
        chunks.push({ index: chunks.length, anchor: section.anchor, content: buffer });
        buffer = part;
      } else {
        buffer = candidate;
      }
    }
    if (buffer) {
      chunks.push({ index: chunks.length, anchor: section.anchor, content: buffer });
    }
  }

  return chunks;
}
