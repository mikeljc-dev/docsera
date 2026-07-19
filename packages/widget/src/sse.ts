export interface SseEvent {
  event: string;
  data: string;
}

// Un evento SSE puede traer varias líneas "data:" (el servidor parte ahí los
// saltos de línea del Markdown) y se reensamblan uniéndolas con "\n". Del
// prefijo se quita "data:" y un único espacio opcional, nunca más: recortar
// de más se comería la sangría de los bloques de código y los espacios entre
// fragmentos consecutivos.
function parseEvent(block: string): SseEvent | null {
  let event = "message";
  const data: string[] = [];

  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      const value = line.slice(5);
      data.push(value.startsWith(" ") ? value.slice(1) : value);
    }
  }

  return data.length > 0 ? { event, data: data.join("\n") } : null;
}

// No se usa EventSource porque solo habla GET y la pregunta viaja en el
// cuerpo de un POST.
export async function* readSse(response: Response): AsyncGenerator<SseEvent> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Response without body");

  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let separator = buffer.indexOf("\n\n");
    while (separator !== -1) {
      const parsed = parseEvent(buffer.slice(0, separator));
      buffer = buffer.slice(separator + 2);
      if (parsed) yield parsed;
      separator = buffer.indexOf("\n\n");
    }
  }
}
