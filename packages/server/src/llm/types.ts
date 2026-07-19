export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatAdapter {
  chat(messages: ChatMessage[]): Promise<string>;
  // Opcional: un proveedor sin streaming sigue siendo válido, el llamador
  // cae a chat() y emite la respuesta entera como un único fragmento.
  chatStream?(messages: ChatMessage[]): AsyncIterable<string>;
}

export interface EmbeddingsAdapter {
  embed(texts: string[]): Promise<number[][]>;
}
