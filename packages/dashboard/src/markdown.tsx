import type { ComponentChildren, VNode } from "preact";

// Puerto en Preact del mini-renderizador de Markdown del widget
// (packages/widget/src/markdown.ts): mismas reglas — **negrita**,
// `código inline`, bloques ``` con botón de copiar, y listas "-"/"1." — para
// que las respuestas se vean en el dashboard igual que las ve el usuario
// final. Todo el contenido se interpola como texto (JSX escapa por defecto),
// así que es XSS-seguro por construcción, y los enlaces pasan por safeHref.

type Inline = ComponentChildren;

const LINK = String.raw`\[[^\]\n]+\]\((?:[^()\s]|\([^()\s]*\))*\)`;
const INLINE_PATTERN = new RegExp(`(\`[^\`\\n]+\`|\\*\\*[^*\\n]+\\*\\*|${LINK})`, "g");

// Solo http(s) absolutos: un `javascript:` sería ejecutable y un relativo
// ("./LICENSE") apuntaría al dashboard, no a la doc. Idéntica a la del widget.
export function safeHref(url: string): string | null {
  return /^https?:\/\/[^\s<>"]+$/i.test(url) ? url : null;
}

function renderInline(text: string): Inline[] {
  const parts: Inline[] = [];
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(INLINE_PATTERN)) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("`")) {
      parts.push(<code key={key++}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**")) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else {
      const link = /^\[([^\]]+)\]\((.*)\)$/.exec(token);
      const label = link?.[1] ?? token;
      const href = safeHref(link?.[2] ?? "");
      parts.push(
        href ? (
          <a key={key++} href={href} target="_blank" rel="noopener noreferrer">
            {label}
          </a>
        ) : (
          label
        ),
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function copyCode(event: Event, code: string): void {
  const button = event.currentTarget as HTMLButtonElement;
  const original = button.textContent;
  void navigator.clipboard?.writeText(code).then(() => {
    button.textContent = "Copied!";
    setTimeout(() => {
      button.textContent = original;
    }, 1500);
  });
}

function renderProse(text: string, keyBase: string): VNode[] {
  const blocks: VNode[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let n = 0;

  const flushParagraph = () => {
    const joined = paragraph.join(" ").trim();
    if (joined) blocks.push(<p key={`${keyBase}-p${n++}`}>{renderInline(joined)}</p>);
    paragraph = [];
  };
  const flushList = () => {
    if (list.length > 0) {
      blocks.push(
        <ul key={`${keyBase}-ul${n++}`}>
          {list.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>,
      );
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

export function renderMarkdown(text: string): VNode[] {
  const blocks: VNode[] = [];
  const segments = text.split(/```[^\n]*\n?/);

  segments.forEach((segment, i) => {
    if (i % 2 === 1) {
      const code = segment.replace(/\n$/, "");
      if (!code.trim()) return;
      blocks.push(
        <div class="codeblock" key={`code${i}`}>
          <button class="copy" onClick={(e) => copyCode(e, code)}>
            Copy
          </button>
          <pre>
            <code>{code}</code>
          </pre>
        </div>,
      );
    } else if (segment.trim()) {
      blocks.push(...renderProse(segment, `seg${i}`));
    }
  });

  return blocks;
}
