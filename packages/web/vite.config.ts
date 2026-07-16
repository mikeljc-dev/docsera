import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [preact()],
  // Puerto propio para no chocar con el dashboard (5173) en `pnpm dev`
  server: { port: 5174 },
});
