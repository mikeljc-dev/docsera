import { html, type TemplateResult } from "lit";

// Mini-renderizador del subconjunto de Markdown que permite el prompt:
// **negrita**, `código inline`, bloques ``` con botón de copiar, y listas
// "-"/"1.". Todo el contenido se interpola como texto vía Lit (nunca
// innerHTML), así que es XSS-seguro por construcción.

type Inline = string | TemplateResult;

// El destino admite un nivel de paréntesis anidados: sin eso, tanto una URL
// legítima —Wikipedia usa "..._(desambiguación)"— como un "javascript:alert(1)"
// se cortan en el primer ")" y dejan basura suelta en la burbuja.
const LINK = String.raw`\[[^\]\n]+\]\((?:[^()\s]|\([^()\s]*\))*\)`;
const INLINE_PATTERN = new RegExp(`(\`[^\`\\n]+\`|\\*\\*[^*\\n]+\\*\\*|${LINK})`, "g");

// Lit interpola el href como texto pero NO valida el esquema: un
// `javascript:` seguiría siendo ejecutable. Y un relativo como "./LICENSE"
// —que el modelo emite a menudo, porque la doc original vive en un repo—
// apuntaría a la web anfitriona, no a la documentación. En ambos casos se
// conserva el texto del enlace y se descarta el destino.
function safeHref(url: string): string | null {
  return /^https?:\/\/[^\s<>"]+$/i.test(url) ? url : null;
}

function renderInline(text: string): Inline[] {
  const parts: Inline[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE_PATTERN)) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("`")) {
      parts.push(html`<code>${token.slice(1, -1)}</code>`);
    } else if (token.startsWith("**")) {
      parts.push(html`<strong>${token.slice(2, -2)}</strong>`);
    } else {
      const link = /^\[([^\]]+)\]\((.*)\)$/.exec(token);
      const label = link?.[1] ?? token;
      const href = safeHref(link?.[2] ?? "");
      parts.push(
        href
          ? html`<a href=${href} target="_blank" rel="noopener noreferrer">${label}</a>`
          : label,
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function copyCode(event: Event, code: string, copiedLabel: string): void {
  const button = event.currentTarget as HTMLButtonElement;
  const original = button.textContent;
  void navigator.clipboard?.writeText(code).then(() => {
    button.textContent = copiedLabel;
    setTimeout(() => {
      button.textContent = original;
    }, 1500);
  });
}

function renderProse(text: string): TemplateResult[] {
  const blocks: TemplateResult[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    const joined = paragraph.join(" ").trim();
    if (joined) blocks.push(html`<p>${renderInline(joined)}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list.length > 0) {
      blocks.push(html`<ul>${list.map((item) => html`<li>${renderInline(item)}</li>`)}</ul>`);
    }
    list = [];
  };

  for (const line of text.split("\n")) {
    const item = /^\s*(?:[-*]|\d+[.)])\s+(.*)$/.exec(line);
    if (item?.[1] !== undefined) {
      flushParagraph();
      list.push(item[1]);
    } else if (line.trim() === "") {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}

export function renderMarkdown(
  text: string,
  labels: { copy: string; copied: string },
): TemplateResult[] {
  const blocks: TemplateResult[] = [];
  const segments = text.split(/```[^\n]*\n?/);

  segments.forEach((segment, i) => {
    if (i % 2 === 1) {
      const code = segment.replace(/\n$/, "");
      if (!code.trim()) return;
      blocks.push(html`
        <div class="codeblock">
          <button class="copy" @click=${(e: Event) => copyCode(e, code, labels.copied)}>
            ${labels.copy}
          </button>
          <pre><code>${code}</code></pre>
        </div>
      `);
    } else if (segment.trim()) {
      blocks.push(...renderProse(segment));
    }
  });

  return blocks;
}
