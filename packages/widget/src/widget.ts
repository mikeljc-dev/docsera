import { LitElement, html, css, type PropertyValues } from "lit";
import { resolveStrings, type WidgetStrings } from "./locales.js";
import { renderMarkdown } from "./markdown.js";
import type { ChatMessage, ChatResponse, Source } from "./types.js";

const SESSION_STORAGE_KEY = "docsera-session-id";

function loadSessionId(): string {
  try {
    const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
  } catch {
    // localStorage no disponible (modo privado, storage bloqueado, etc.)
  }
  const id = crypto.randomUUID();
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, id);
  } catch {
    // ignorar: la sesion simplemente no persistira entre recargas
  }
  return id;
}

function sourceHref(source: Source): string {
  if (!source.url) return "";
  return source.anchor ? `${source.url}#${source.anchor}` : source.url;
}

// Varias fuentes suelen compartir documento (mismo título): el anchor
// humanizado ("add-the-widget" → "add the widget") las hace distinguibles.
function sourceLabel(source: Source): string {
  if (!source.anchor) return source.title;
  return `${source.title} § ${source.anchor.replace(/-/g, " ")}`;
}

export class DocseraWidget extends LitElement {
  static properties = {
    server: { type: String },
    locale: { type: String },
    heading: { type: String },
    placeholder: { type: String },
    primary: { type: String },
    position: { type: String, reflect: true },
    suggestions: { type: String },
    contact: { type: String },
    open: { state: true },
    messages: { state: true },
    pending: { state: true },
    inputValue: { state: true },
  };

  static styles = css`
    :host {
      position: fixed;
      right: 1.5rem;
      bottom: 1.5rem;
      z-index: 2147483000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --docsera-primary: #2563eb;
      --docsera-primary-fg: #ffffff;
      --docsera-bg: #ffffff;
      --docsera-fg: #1f2937;
      --docsera-muted: #6b7280;
      --docsera-border: #e5e7eb;
      --docsera-radius: 14px;
    }

    :host([position="left"]) {
      left: 1.5rem;
      right: auto;
    }

    :host([position="left"]) .panel {
      left: 0;
      right: auto;
    }

    .fab {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      border: none;
      background: var(--docsera-primary);
      color: var(--docsera-primary-fg);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
    }

    .fab:hover {
      filter: brightness(1.1);
    }

    .panel {
      position: absolute;
      right: 0;
      bottom: 68px;
      width: 360px;
      max-width: calc(100vw - 2rem);
      height: 520px;
      max-height: calc(100vh - 6rem);
      background: var(--docsera-bg);
      color: var(--docsera-fg);
      border-radius: var(--docsera-radius);
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border: 1px solid var(--docsera-border);
    }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.85rem 1rem;
      background: var(--docsera-primary);
      color: var(--docsera-primary-fg);
      font-weight: 600;
      font-size: 0.95rem;
    }

    header button {
      background: none;
      border: none;
      color: inherit;
      font-size: 1.1rem;
      line-height: 1;
      cursor: pointer;
      padding: 0.1rem 0.3rem;
    }

    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 0.85rem;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }

    .empty {
      color: var(--docsera-muted);
      font-size: 0.9rem;
      text-align: center;
      margin-top: 2rem;
    }

    .message {
      display: flex;
      flex-direction: column;
      max-width: 85%;
    }

    .message.user {
      align-self: flex-end;
      align-items: flex-end;
    }

    .message.assistant {
      align-self: flex-start;
      align-items: flex-start;
    }

    .bubble {
      padding: 0.55rem 0.75rem;
      border-radius: 10px;
      font-size: 0.9rem;
      line-height: 1.4;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .message.user .bubble {
      background: var(--docsera-primary);
      color: var(--docsera-primary-fg);
    }

    .message.assistant .bubble {
      background: #f3f4f6;
    }

    .message.assistant .bubble.error {
      background: #fee2e2;
      color: #991b1b;
    }

    .bubble.md {
      white-space: normal;
    }

    .bubble.md p {
      margin: 0 0 0.5rem;
    }

    .bubble.md p:last-child,
    .bubble.md ul:last-child,
    .bubble.md .codeblock:last-child {
      margin-bottom: 0;
    }

    .bubble.md ul {
      margin: 0 0 0.5rem;
      padding-left: 1.1rem;
    }

    .bubble.md li {
      margin-bottom: 0.15rem;
    }

    /* Solo el código inline de párrafos y listas lleva "píldora" clara;
       dentro de los bloques oscuros el código va limpio. */
    .bubble.md p code,
    .bubble.md li code {
      background: #e5e7eb;
      border-radius: 4px;
      padding: 0.05em 0.3em;
      font-family: ui-monospace, Menlo, Consolas, monospace;
      font-size: 0.85em;
    }

    .codeblock {
      position: relative;
      margin: 0.4rem 0 0.5rem;
    }

    .codeblock pre {
      background: #0f172a;
      color: #e2e8f0;
      border-radius: 8px;
      padding: 0.55rem 0.7rem;
      padding-right: 3.4rem;
      overflow-x: auto;
      font-family: ui-monospace, Menlo, Consolas, monospace;
      font-size: 0.78rem;
      line-height: 1.55;
    }

    .codeblock pre code {
      font-family: inherit;
      font-size: inherit;
      color: inherit;
    }

    .codeblock .copy {
      position: absolute;
      top: 0.3rem;
      right: 0.35rem;
      background: rgba(255, 255, 255, 0.14);
      color: #cbd5e1;
      border: none;
      border-radius: 5px;
      padding: 0.18rem 0.5rem;
      font-size: 0.68rem;
      font-family: inherit;
      cursor: pointer;
    }

    .codeblock .copy:hover {
      background: rgba(255, 255, 255, 0.22);
    }

    .chips {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      margin-top: 1rem;
      align-items: center;
    }

    .chip {
      background: none;
      border: 1px solid var(--docsera-border);
      border-radius: 999px;
      color: var(--docsera-primary);
      padding: 0.4rem 0.85rem;
      font-size: 0.85rem;
      font-family: inherit;
      cursor: pointer;
      max-width: 100%;
    }

    .chip:hover {
      border-color: var(--docsera-primary);
      background: rgba(37, 99, 235, 0.06);
    }

    .contact {
      margin-top: 0.35rem;
      font-size: 0.8rem;
      color: var(--docsera-primary);
      text-decoration: none;
      font-weight: 500;
    }

    .contact:hover {
      text-decoration: underline;
    }

    .feedback {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      margin-top: 0.3rem;
    }

    .feedback button {
      background: none;
      border: none;
      color: #9ca3af;
      cursor: pointer;
      padding: 0.15rem;
      line-height: 0;
      border-radius: 5px;
    }

    .feedback button:hover {
      color: var(--docsera-fg);
      background: #f3f4f6;
    }

    .feedback button.down svg {
      transform: rotate(180deg);
    }

    .feedback button.active {
      color: var(--docsera-primary);
    }

    .feedback .thanks {
      font-size: 0.72rem;
      color: var(--docsera-muted);
      margin-left: 0.2rem;
    }

    .sources {
      margin-top: 0.3rem;
      font-size: 0.75rem;
      color: var(--docsera-muted);
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    .sources a {
      color: var(--docsera-primary);
      text-decoration: none;
    }

    .sources a:hover {
      text-decoration: underline;
    }

    .pending .bubble {
      background: #f3f4f6;
      color: var(--docsera-muted);
      font-style: italic;
    }

    form {
      display: flex;
      gap: 0.5rem;
      padding: 0.75rem;
      border-top: 1px solid var(--docsera-border);
    }

    input {
      flex: 1;
      border: 1px solid var(--docsera-border);
      border-radius: 8px;
      padding: 0.5rem 0.65rem;
      font-size: 0.9rem;
      font-family: inherit;
      min-width: 0;
    }

    input:focus {
      outline: 2px solid var(--docsera-primary);
      outline-offset: 1px;
    }

    form button {
      background: var(--docsera-primary);
      color: var(--docsera-primary-fg);
      border: none;
      border-radius: 8px;
      padding: 0 0.9rem;
      font-size: 0.9rem;
      cursor: pointer;
    }

    form button:disabled {
      opacity: 0.6;
      cursor: default;
    }

    /* ─── Animaciones ─── */

    @keyframes fab-in {
      from { opacity: 0; transform: scale(0.4); }
      60% { transform: scale(1.08); }
      to { opacity: 1; transform: scale(1); }
    }

    .fab {
      position: relative;
      animation: fab-in 0.45s cubic-bezier(0.22, 0.9, 0.3, 1.15) 0.25s backwards;
      transition: transform 0.18s ease, filter 0.18s ease;
    }

    .fab:hover {
      transform: scale(1.07);
    }

    .fab:active {
      transform: scale(0.95);
    }

    /* Anillo de atención sutil hasta que se abre por primera vez */
    .fab::after {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 2px solid var(--docsera-primary);
      opacity: 0;
      animation: fab-ping 3.4s ease-out 1.4s infinite;
      pointer-events: none;
    }

    :host([opened]) .fab::after {
      display: none;
    }

    @keyframes fab-ping {
      0% { transform: scale(1); opacity: 0.45; }
      55% { transform: scale(1.5); opacity: 0; }
      100% { transform: scale(1.5); opacity: 0; }
    }

    @keyframes icon-in {
      from { transform: rotate(-90deg) scale(0.5); opacity: 0; }
      to { transform: none; opacity: 1; }
    }

    .fab svg {
      animation: icon-in 0.22s ease;
    }

    @keyframes panel-in {
      from { opacity: 0; transform: translateY(14px) scale(0.96); }
      to { opacity: 1; transform: none; }
    }

    .panel {
      animation: panel-in 0.26s cubic-bezier(0.22, 0.9, 0.3, 1.05);
      transform-origin: bottom right;
    }

    :host([position="left"]) .panel {
      transform-origin: bottom left;
    }

    @keyframes rise-in {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: none; }
    }

    .message {
      animation: rise-in 0.28s ease;
    }

    .chip {
      animation: rise-in 0.32s ease backwards;
      transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease;
    }

    .chips .chip:nth-child(2) { animation-delay: 80ms; }
    .chips .chip:nth-child(3) { animation-delay: 160ms; }
    .chips .chip:nth-child(4) { animation-delay: 240ms; }

    .chip:hover {
      transform: translateY(-1px);
    }

    .typing-dots {
      display: inline-flex;
      gap: 4px;
      align-items: center;
      height: 1.1em;
    }

    .typing-dots span {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--docsera-muted);
      animation: dot-bounce 1.15s infinite ease-in-out;
    }

    .typing-dots span:nth-child(2) { animation-delay: 0.15s; }
    .typing-dots span:nth-child(3) { animation-delay: 0.3s; }

    @keyframes dot-bounce {
      0%, 60%, 100% { transform: none; opacity: 0.45; }
      30% { transform: translateY(-4px); opacity: 1; }
    }

    @media (prefers-reduced-motion: reduce) {
      .fab, .fab svg, .panel, .message, .chip {
        animation: none;
        transition: none;
      }
      .fab::after { display: none; }
      .typing-dots span { animation: none; }
      .fab:hover, .chip:hover { transform: none; }
    }
  `;

  declare server: string;
  declare locale: string;
  declare heading: string;
  declare placeholder: string;
  declare primary: string;
  declare position: string;
  declare suggestions: string;
  declare contact: string;
  declare open: boolean;
  declare messages: ChatMessage[];
  declare pending: boolean;
  declare inputValue: string;

  private sessionId = "";

  constructor() {
    super();
    this.server = "";
    this.locale = "";
    this.heading = "";
    this.placeholder = "";
    this.primary = "";
    this.position = "";
    this.suggestions = "";
    this.contact = "";
    this.open = false;
    this.messages = [];
    this.pending = false;
    this.inputValue = "";
  }

  // Los atributos heading/placeholder tienen prioridad sobre el idioma
  // resuelto (locale explícito > <html lang> > navegador > inglés).
  private get strings(): WidgetStrings {
    const strings = resolveStrings(this.locale || undefined);
    return {
      ...strings,
      heading: this.heading || strings.heading,
      placeholder: this.placeholder || strings.placeholder,
    };
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.sessionId = loadSessionId();
  }

  protected override updated(changed: PropertyValues): void {
    if (changed.has("primary")) {
      // Color de marca del sitio anfitrion: pisa la variable CSS del host
      if (this.primary) {
        this.style.setProperty("--docsera-primary", this.primary);
      } else {
        this.style.removeProperty("--docsera-primary");
      }
    }
    if (changed.has("messages") || changed.has("pending")) {
      this.scrollToBottom();
    }
  }

  private scrollToBottom(): void {
    const list = this.renderRoot.querySelector(".messages");
    if (list) list.scrollTop = list.scrollHeight;
  }

  private toggleOpen(): void {
    this.open = !this.open;
    if (this.open) this.setAttribute("opened", "");
  }

  private onInput(event: Event): void {
    this.inputValue = (event.target as HTMLInputElement).value;
  }

  private async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    await this.send(this.inputValue.trim());
  }

  private async send(question: string): Promise<void> {
    if (!question || this.pending || !this.server) return;

    this.messages = [...this.messages, { role: "user", content: question }];
    this.inputValue = "";
    this.pending = true;

    try {
      const response = await fetch(`${this.server}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, sessionId: this.sessionId }),
      });

      if (response.status === 429) {
        this.messages = [
          ...this.messages,
          { role: "assistant", content: this.strings.rateLimited, error: true },
        ];
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as ChatResponse;
      this.sessionId = data.sessionId;
      this.messages = [
        ...this.messages,
        {
          role: "assistant",
          content: data.answer,
          sources: data.sources,
          conversationId: data.conversationId,
          answered: data.answered,
        },
      ];
    } catch {
      this.messages = [
        ...this.messages,
        {
          role: "assistant",
          content: this.strings.error,
          error: true,
        },
      ];
    } finally {
      this.pending = false;
    }
  }

  private async sendFeedback(message: ChatMessage, rating: "up" | "down"): Promise<void> {
    if (!message.conversationId || message.feedback === rating) return;
    // Optimista: el voto se refleja al instante; si la petición falla, se
    // revierte sin molestar al usuario con un error por un pulgar.
    const previous = message.feedback;
    this.messages = this.messages.map((m) => (m === message ? { ...m, feedback: rating } : m));
    try {
      const response = await fetch(`${this.server}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: message.conversationId, rating }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch {
      this.messages = this.messages.map((m) =>
        m.conversationId === message.conversationId ? { ...m, feedback: previous } : m,
      );
    }
  }

  protected override render() {
    return html`
      <button class="fab" @click=${this.toggleOpen} aria-label=${this.strings.openChat}>
        ${this.open ? closeIcon() : chatIcon()}
      </button>
      ${this.open ? this.renderPanel() : null}
    `;
  }

  private renderPanel() {
    const strings = this.strings;
    return html`
      <div class="panel">
        <header>
          <span>${strings.heading}</span>
          <button @click=${this.toggleOpen} aria-label=${strings.close}>✕</button>
        </header>
        <div class="messages">
          ${this.messages.length === 0
            ? html`
                <p class="empty">${strings.empty}</p>
                ${this.renderSuggestions()}
              `
            : this.messages.map((message) => this.renderMessage(message))}
          ${this.pending
            ? html`<div class="message assistant pending"><div
                class="bubble"
                role="status"
                aria-label=${strings.typing}
              ><span class="typing-dots"><span></span><span></span><span></span></span></div></div>`
            : null}
        </div>
        <form @submit=${this.onSubmit}>
          <input
            .value=${this.inputValue}
            @input=${this.onInput}
            placeholder=${strings.placeholder}
            ?disabled=${this.pending}
          />
          <button type="submit" ?disabled=${this.pending || !this.inputValue.trim()}>
            ${strings.send}
          </button>
        </form>
      </div>
    `;
  }

  private renderSuggestions() {
    const items = this.suggestions
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length === 0) return null;
    return html`
      <div class="chips">
        ${items.map(
          (question) =>
            html`<button class="chip" @click=${() => this.send(question)}>${question}</button>`,
        )}
      </div>
    `;
  }

  private renderMessage(message: ChatMessage) {
    const strings = this.strings;
    const isMarkdown = message.role === "assistant" && !message.error;
    return html`
      <div class="message ${message.role}">
        <div
          class="bubble ${message.error ? "error" : ""} ${isMarkdown ? "md" : ""}"
        >${isMarkdown
          ? renderMarkdown(message.content, { copy: strings.copy, copied: strings.copied })
          : message.content}</div>
        ${message.sources && message.sources.length > 0
          ? html`
              <div class="sources">
                ${message.sources.map(
                  (source) =>
                    html`<a href=${sourceHref(source)} target="_blank" rel="noopener noreferrer"
                      >${sourceLabel(source)}</a
                    >`,
                )}
              </div>
            `
          : null}
        ${message.answered === false && this.contact
          ? html`<a class="contact" href=${this.contact} target="_blank" rel="noopener noreferrer"
              >${strings.contact} →</a
            >`
          : null}
        ${message.conversationId
          ? html`
              <div class="feedback ${message.feedback ? "voted" : ""}">
                <button
                  class=${message.feedback === "up" ? "active" : ""}
                  aria-label=${strings.helpful}
                  title=${strings.helpful}
                  @click=${() => this.sendFeedback(message, "up")}
                >
                  ${thumbIcon()}
                </button>
                <button
                  class="down ${message.feedback === "down" ? "active" : ""}"
                  aria-label=${strings.notHelpful}
                  title=${strings.notHelpful}
                  @click=${() => this.sendFeedback(message, "down")}
                >
                  ${thumbIcon()}
                </button>
                ${message.feedback ? html`<span class="thanks">${strings.feedbackThanks}</span>` : null}
              </div>
            `
          : null}
      </div>
    `;
  }
}

function thumbIcon() {
  return html`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
  </svg>`;
}

function chatIcon() {
  return html`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path
      d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.35 0-2.62-.32-3.73-.9L3 21l1.9-5.77A8.5 8.5 0 1 1 21 11.5Z"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>`;
}

function closeIcon() {
  return html`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
  </svg>`;
}

customElements.define("docsera-widget", DocseraWidget);
