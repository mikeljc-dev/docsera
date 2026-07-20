import type { ChatResult } from "../chat/index.js";

// Límites documentados de Slack Block Kit: 3000 para el texto de una
// sección, 2000 para un elemento de contexto.
const SECTION_TEXT_LIMIT = 3000;
const CONTEXT_TEXT_LIMIT = 2000;

interface SlackBlock {
  type: "section" | "context";
  text?: { type: "mrkdwn"; text: string };
  elements?: { type: "mrkdwn"; text: string }[];
}

export interface SlackMessage {
  response_type: "in_channel" | "ephemeral";
  text: string;
  blocks?: SlackBlock[];
}

function truncate(text: string, limit: number): string {
  return text.length <= limit ? text : text.slice(0, limit - 1) + "…";
}

function sourceLink(source: ChatResult["sources"][number]): string {
  // mrkdwn de Slack: <url|texto>, no [texto](url) como Discord/GitHub.
  if (source.url === null) return source.title;
  const url = source.anchor !== null ? `${source.url}#${source.anchor}` : source.url;
  return `<${url}|${source.title}>`;
}

// La respuesta que se entrega al response_url tras el "Thinking…" efímero.
// response_type "in_channel": visible para todo el canal, igual que el
// embed público del bot de Discord.
export function buildAnswerMessage(result: ChatResult): SlackMessage {
  const blocks: SlackBlock[] = [
    { type: "section", text: { type: "mrkdwn", text: truncate(result.answer, SECTION_TEXT_LIMIT) } },
  ];

  if (result.answered && result.sources.length > 0) {
    const prefix = "*Sources:* ";
    const lines: string[] = [];
    let used = prefix.length;
    for (const source of result.sources) {
      const line = sourceLink(source);
      // +3 por el separador " · "; las fuentes que no caben se omiten
      // enteras, nunca se parte un enlace por la mitad.
      if (used + line.length + 3 > CONTEXT_TEXT_LIMIT) break;
      lines.push(line);
      used += line.length + 3;
    }
    if (lines.length > 0) {
      blocks.push({
        type: "context",
        elements: [{ type: "mrkdwn", text: `${prefix}${lines.join(" · ")}` }],
      });
    }
  }

  // `text` es el fallback plano que muestran las notificaciones y los
  // clientes que no renderizan bloques; `blocks` es la vista rica.
  return { response_type: "in_channel", text: result.answer, blocks };
}
