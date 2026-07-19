// Los tres proveedores mandan la respuesta troceada en líneas (SSE en
// OpenAI y Anthropic, NDJSON en Ollama), y un chunk de red puede cortar
// una línea por la mitad. Este lector reconstruye líneas completas para
// que cada adaptador solo se preocupe de su formato.
export async function* readLines(response: Response): AsyncGenerator<string> {
  const body = response.body;
  if (!body) throw new Error("La respuesta del proveedor no trae cuerpo");

  const decoder = new TextDecoder();
  let buffer = "";

  for await (const chunk of body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      yield buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
    }
  }

  const rest = buffer.trim();
  if (rest) yield rest;
}

// Payloads de las líneas "data:" de un stream SSE, saltándose comentarios,
// líneas en blanco y el centinela [DONE].
export async function* readSseData(response: Response): AsyncGenerator<string> {
  for await (const line of readLines(response)) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    yield data;
  }
}
