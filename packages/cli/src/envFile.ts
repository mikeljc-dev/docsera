// Lector mínimo de .env (KEY=VALUE, comentarios con #). Suficiente para leer
// lo que la propia CLI escribió con buildEnvFile; no pretende cubrir toda la
// sintaxis de dotenv.
export function parseEnvFile(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      value = JSON.parse(value) as string;
    }
    result[key] = value;
  }
  return result;
}
