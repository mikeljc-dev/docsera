import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";

const { version } = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf-8")) as {
  version: string;
};

// La versión se inyecta en build desde el package.json de la raíz: escrita a
// mano en el HTML se quedaba atrás en cada release (pasó con la v0.3.0).
function injectVersion(): Plugin {
  return {
    name: "docsera-version",
    transformIndexHtml: (html) => html.replaceAll("__DOCSERA_VERSION__", version),
  };
}

export default defineConfig({
  // Puerto propio: 5173 dashboard, 5174 web, 5175 docs
  server: { port: 5175 },
  plugins: [injectVersion()],
});
