import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";

const WIDGET_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../../public/widget.js");

export const widgetRoute = new Hono();

// Perezoso: si el bundle se genera con el server ya arrancado, la siguiente
// petición lo encuentra sin necesidad de reiniciar.
let widgetJs: string | null = null;

widgetRoute.get("/widget.js", (c) => {
  widgetJs ??= existsSync(WIDGET_PATH) ? readFileSync(WIDGET_PATH, "utf-8") : null;
  if (!widgetJs) {
    return c.text(
      "widget.js no encontrado. Ejecuta `pnpm --filter @docsera/widget build` y copia " +
        "dist/widget.js a packages/server/public/widget.js.",
      404,
    );
  }
  return c.body(widgetJs, 200, { "Content-Type": "application/javascript; charset=utf-8" });
});
