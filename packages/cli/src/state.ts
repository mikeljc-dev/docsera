import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseEnvFile } from "./envFile.js";
import type { IngestSource } from "./detect.js";

// docsera.json marca "aquí vive una instalación hecha por la CLI" y guarda lo
// mínimo que no puede vivir en .env (que es contrato del server): la fuente de
// docs elegida en el wizard y si ya se ingirió una vez.
export const STATE_FILE = "docsera.json";

export interface CliState {
  source?: IngestSource;
  ingestedAt?: string;
}

// Busca la instalación en el propio cwd o en ./docsera (donde la crea `init`
// cuando el cwd no está vacío), para que los subcomandos funcionen desde el
// directorio padre sin obligar a hacer cd.
export function resolveProjectDir(cwd: string): string | null {
  for (const dir of [cwd, join(cwd, "docsera")]) {
    if (existsSync(join(dir, STATE_FILE))) return dir;
  }
  return null;
}

export function readState(dir: string): CliState {
  return JSON.parse(readFileSync(join(dir, STATE_FILE), "utf-8")) as CliState;
}

export function writeState(dir: string, state: CliState): void {
  writeFileSync(join(dir, STATE_FILE), JSON.stringify(state, null, 2) + "\n");
}

export function readEnv(dir: string): Record<string, string> {
  const path = join(dir, ".env");
  if (!existsSync(path)) {
    throw new Error(`No .env found in ${dir}. Run \`npx docsera\` to set it up.`);
  }
  return parseEnvFile(readFileSync(path, "utf-8"));
}
