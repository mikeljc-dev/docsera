import type { AdminStats } from "./api.js";

type Source = AdminStats["topSources"][number];

// Porcentaje redondeado para las tiles. Con denominador 0 devuelve "—" en vez
// de "NaN%" o dividir por cero (ej: tasa de feedback positivo sin votos aún).
export function percent(part: number, whole: number): string {
  if (whole === 0) return "—";
  return `${Math.round((part / whole) * 100)}%`;
}

// Sin el título del documento delante: casi todas las citas de una misma
// instancia vienen del mismo documento, así que el anchor humanizado
// ("add-the-widget" → "add the widget") es lo que las distingue.
export function sourceLabel(source: Source): string {
  if (!source.anchor) return source.title;
  return source.anchor.replace(/-/g, " ");
}

export function sourceHref(source: Source): string | null {
  if (!source.url) return null;
  return source.anchor ? `${source.url}#${source.anchor}` : source.url;
}
