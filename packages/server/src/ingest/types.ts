export interface ContentBlock {
  type: "heading" | "text";
  anchor?: string;
  text: string;
}

export interface ExtractedDocument {
  title: string;
  blocks: ContentBlock[];
}
