import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";

const WIDGET_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../../public/widget.js");

export const widgetRoute = new Hono();

const widgetJs = existsSync(WIDGET_PATH) ? readFileSync(WIDGET_PATH, "utf-8") : null;

widgetRoute.get("/widget.js", (c) => {
  if (!widgetJs) {
    return c.text(
      "widget.js no encontrado. Ejecuta `pnpm --filter @askdocs/widget build` y copia " +
        "dist/widget.js a packages/server/public/widget.js.",
      404,
    );
  }
  return c.body(widgetJs, 200, { "Content-Type": "application/javascript; charset=utf-8" });
});
