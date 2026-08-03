// Orígenes permitidos para CORS: coma-separados en ALLOWED_ORIGINS. Vacío por
// defecto (bloquea todo) a propósito —privacy-first: no se abre la API a
// cualquier web sin que el que despliega lo diga—, pero eso es justo el
// footgun del widget, de ahí el aviso de abajo.
export function parseAllowedOrigins(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

// Con la lista vacía, el navegador bloquea por CORS el widget embebido en
// cualquier web ajena, sin error del lado del server: un fallo silencioso y
// confuso. Se avisa al arrancar (warning, no fatal: solo MCP / API directa /
// bots es un uso legítimo sin CORS). En inglés, como el resto de lo que ve
// quien autohospeda.
export function allowedOriginsWarning(origins: string[]): string | null {
  if (origins.length > 0) return null;
  return (
    "ALLOWED_ORIGINS is empty: the chat widget embedded on other sites will be " +
    "blocked by CORS. Set it to the origin(s) where you embed the widget " +
    "(e.g. https://docs.example.com). Ignore this if you only use the MCP server, " +
    "the HTTP API, or the Discord/Slack bots."
  );
}
