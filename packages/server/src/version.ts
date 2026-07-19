import { readFileSync } from "node:fs";

// Única fuente de la versión en el server. Vale igual desde src/ (tsx) que
// desde dist/ (producción): en ambos casos ../package.json es el del paquete.
// Antes vivía suelta en index.ts y copiada a mano en el User-Agent de la
// ingesta y en el nombre del server MCP, que se quedaban atrás en cada release.
export const VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8")) as {
    version: string;
  }
).version;
