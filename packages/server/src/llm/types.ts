export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatAdapter {
  chat(messages: ChatMessage[]): Promise<string>;
}

export interface EmbeddingsAdapter {
  embed(texts: string[]): Promise<number[][]>;
}
