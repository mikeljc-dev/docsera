import type { ChatResult } from "../chat/index.js";

// Límites documentados de Discord: 4096 para la descripción de un embed,
// 1024 para el valor de un field.
const DESCRIPTION_LIMIT = 4096;
const FIELD_VALUE_LIMIT = 1024;

// Mismo índigo que el data-primary de ejemplo del widget.
const EMBED_COLOR = 0x4f46e5;

interface DiscordEmbed {
  description: string;
  color: number;
  fields?: { name: string; value: string }[];
}

export interface DiscordMessage {
  embeds: DiscordEmbed[];
}

function truncate(text: string, limit: number): string {
  return text.length <= limit ? text : text.slice(0, limit - 1) + "…";
}

function sourceLine(source: ChatResult["sources"][number]): string {
  if (source.url === null) return source.title;
  const url = source.anchor !== null ? `${source.url}#${source.anchor}` : source.url;
  return `[${source.title}](${url})`;
}

// La respuesta que edita al mensaje diferido de /ask. Discord renderiza
// Markdown (enlaces incluidos) dentro de los embeds, así que las citas van
// como enlaces reales.
export function buildAnswerMessage(result: ChatResult): DiscordMessage {
  const embed: DiscordEmbed = {
    description: truncate(result.answer, DESCRIPTION_LIMIT),
    color: EMBED_COLOR,
  };

  if (result.answered && result.sources.length > 0) {
    const lines: string[] = [];
    let used = 0;
    for (const source of result.sources) {
      const line = sourceLine(source);
      // +1 por el salto de línea; las fuentes que no caben se omiten en vez
      // de partir un enlace por la mitad.
      if (used + line.length + 1 > FIELD_VALUE_LIMIT) break;
      lines.push(line);
      used += line.length + 1;
    }
    if (lines.length > 0) {
      embed.fields = [{ name: "Sources", value: lines.join("\n") }];
    }
  }

  return { embeds: [embed] };
}
