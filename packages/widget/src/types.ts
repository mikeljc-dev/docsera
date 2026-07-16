export interface Source {
  url: string | null;
  title: string;
  anchor: string | null;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  error?: boolean;
}

export interface ChatResponse {
  answer: string;
  sources: Source[];
  sessionId: string;
}
