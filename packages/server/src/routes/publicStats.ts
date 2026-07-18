import { Hono } from "hono";
import { getStats } from "../admin/stats.js";
import { getPool } from "../lib/db.js";

// Estadísticas públicas de solo-agregados, pensadas para demos ("estos
// números son esta instancia, ahora mismo"). Se activa con
// PUBLIC_STATS=true; apagado por defecto. Nunca expone las preguntas de
// los usuarios: solo totales, actividad diaria y secciones más citadas
// (que son contenido propio de la doc, ya público).
export const publicStatsRoute = new Hono();

publicStatsRoute.get("/stats/public", async (c) => {
  if (process.env.PUBLIC_STATS !== "true") {
    return c.json({ error: "Not found" }, 404);
  }

  try {
    const stats = await getStats(getPool());
    return c.json({
      totals: stats.totals,
      daily: stats.daily,
      topSources: stats.topSources.slice(0, 5),
    });
  } catch (error) {
    console.error("Error en /stats/public:", error);
    return c.json({ error: "Something went wrong" }, 500);
  }
});
