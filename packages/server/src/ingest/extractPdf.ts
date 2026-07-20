import { extractText, getDocumentProxy, getMeta } from "unpdf";
import type { ContentBlock, ExtractedDocument } from "./types.js";

// unpdf envuelve pdf.js (el mismo motor que Firefox/Chrome) sin necesitar el
// worker que pdfjs-dist exige fuera del navegador: es lo que la hace viable
// en un server Node sin configuración adicional.
export async function extractFromPdf(bytes: Uint8Array, fallbackTitle: string): Promise<ExtractedDocument> {
  const pdf = await getDocumentProxy(bytes);
  try {
    const [{ text }, meta] = await Promise.all([
      extractText(pdf, { mergePages: false }),
      // Los metadatos son opcionales en un PDF válido; sin /Title cae al
      // fallback igual que markdown/HTML sin <title>.
      getMeta(pdf).catch(() => null),
    ]);

    const metaTitle = typeof meta?.info.Title === "string" ? meta.info.Title.trim() : "";
    const title = metaTitle || fallbackTitle;

    // Una página por sección: no hay estructura de encabezados que extraer
    // de un PDF, pero el número de página sí es una unidad de cita útil, y
    // "#page=N" es la sintaxis que reconocen los visores de PDF (el propio
    // Chrome/Firefox incluidos) para saltar directamente a ella.
    const blocks: ContentBlock[] = [];
    text.forEach((pageText, index) => {
      const trimmed = pageText.replace(/\s+/g, " ").trim();
      if (!trimmed) return;
      blocks.push({ type: "heading", anchor: `page=${index + 1}`, text: `Page ${index + 1}` });
      blocks.push({ type: "text", text: trimmed });
    });

    return { title, blocks };
  } finally {
    // Sin esto, el worker interno (aunque en proceso, pdf.js lo simula con
    // un "fake worker" que serializa mensajes con structuredClone) sigue
    // vivo entre ingestas y puede lanzar un rechazo tardío no relacionado
    // con la petición que lo originó.
    await pdf.destroy();
  }
}
