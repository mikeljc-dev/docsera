export type DateRange = "all" | "today" | "7d" | "30d";

const DAY_MS = 86_400_000;

// Timestamp ISO desde el que filtrar según el rango elegido. `now` es
// inyectable para poder testear la aritmética sin depender del reloj; en la
// vista se llama sin argumento (Date.now()).
export function sinceFor(range: DateRange, now: number = Date.now()): string | undefined {
  if (range === "all") return undefined;
  if (range === "today") {
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    return midnight.toISOString();
  }
  const days = range === "7d" ? 7 : 30;
  return new Date(now - days * DAY_MS).toISOString();
}

// La tabla es para leer, no para renderizar Markdown: quita la sintaxis más
// ruidosa (fences ```, backticks, #, énfasis, sintaxis de enlace) dejando el
// texto legible. No es un parser completo — solo lo justo para que un
// operador no vea "```bash npx docsera```" literal en cada fila.
export function stripMarkdown(text: string): string {
  return text
    .replace(/```[a-z]*\n?/gi, "") // apertura de fence (con lenguaje opcional)
    .replace(/```/g, "") // cierre de fence
    .replace(/`([^`]+)`/g, "$1") // código inline
    .replace(/^#{1,6}\s+/gm, "") // encabezados
    .replace(/\*\*([^*]+)\*\*/g, "$1") // negrita
    .replace(/\*([^*]+)\*/g, "$1") // cursiva
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"); // enlaces → solo el texto
}
