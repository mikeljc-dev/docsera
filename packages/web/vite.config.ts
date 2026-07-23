import { readFileSync } from "node:fs";
import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

const { version } = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf-8")) as {
  version: string;
};

export default defineConfig({
  plugins: [preact()],
  // Puerto propio para no chocar con el dashboard (5173) en `pnpm dev`
  server: { port: 5174 },
  // Mismo patrón que packages/docs: la versión del badge del hero sale del
  // package.json raíz, no a mano, para que no se quede atrás en cada release.
  define: {
    __DOCSERA_VERSION__: JSON.stringify(version),
  },
});
