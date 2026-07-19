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
  conversationId?: string;
  answered?: boolean;
  feedback?: "up" | "down";
}

// Evento "done" de /chat/stream: todo lo de la respuesta menos el texto,
// que ya ha llegado troceado en los eventos "delta".
export interface ChatDone {
  sources: Source[];
  sessionId: string;
  conversationId: string;
  answered: boolean;
}
