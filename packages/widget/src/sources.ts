import type { Source } from "./types.js";

// URL final de una cita: con anchor apunta a la seccion concreta; sin URL
// (una fuente sin enlace) devuelve cadena vacia para que renderMessage la
// muestre como texto plano en vez de un enlace roto.
export function sourceHref(source: Source): string {
  if (!source.url) return "";
  return source.anchor ? `${source.url}#${source.anchor}` : source.url;
}

// Varias fuentes suelen compartir documento (mismo titulo): el anchor
// humanizado ("add-the-widget" -> "add the widget") las hace distinguibles.
export function sourceLabel(source: Source): string {
  if (!source.anchor) return source.title;
  return `${source.title} § ${source.anchor.replace(/-/g, " ")}`;
}
