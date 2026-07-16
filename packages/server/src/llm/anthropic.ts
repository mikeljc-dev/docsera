import type { ChatAdapter, ChatMessage } from "./types.js";

const CHAT_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-5";
const DEFAULT_MAX_TOKENS = 1024;

interface AnthropicResponse {
  content: { type: string; text?: string }[];
}

export class AnthropicChatAdapter implements ChatAdapter {
  async chat(messages: ChatMessage[]): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY no configurada");
    }

    const model = process.env.LLM_MODEL ?? DEFAULT_MODEL;
    const system = messages.find((message) => message.role === "system")?.content;
    const conversation = messages
      .filter((message) => message.role !== "system")
      .map((message) => ({ role: message.role, content: message.content }));

    const response = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: DEFAULT_MAX_TOKENS,
        ...(system ? { system } : {}),
        messages: conversation,
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error (${response.status}): ${await response.text()}`);
    }

    const data = (await response.json()) as AnthropicResponse;
    const text = data.content.find((block) => block.type === "text")?.text;
    if (!text) {
      throw new Error("Anthropic no devolvió texto en la respuesta");
    }
    return text;
  }
}
