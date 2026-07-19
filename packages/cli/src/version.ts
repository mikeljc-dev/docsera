import { readFileSync } from "node:fs";

// Mismo patrón que en el server: única fuente de la versión, válida desde
// src/ (tsx) y desde dist/ (paquete publicado): ../package.json es el del
// paquete en ambos casos. La usa también el tag por defecto de la imagen
// Docker que genera `init`, así CLI e imagen se publican emparejadas.
export const VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8")) as {
    version: string;
  }
).version;
