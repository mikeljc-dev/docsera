import { LitElement, html, css, type PropertyValues } from "lit";
import { resolveStrings, type WidgetStrings } from "./locales.js";
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

export class DocseraWidget extends LitElement {
  static properties = {
    server: { type: String },
    locale: { type: String },
    heading: { type: String },
    placeholder: { type: String },
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
  `;

  declare server: string;
  declare locale: string;
  declare heading: string;
  declare placeholder: string;
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
  }

  private onInput(event: Event): void {
    this.inputValue = (event.target as HTMLInputElement).value;
  }

  private async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    const question = this.inputValue.trim();
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

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as ChatResponse;
      this.sessionId = data.sessionId;
      this.messages = [...this.messages, { role: "assistant", content: data.answer, sources: data.sources }];
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
            ? html`<p class="empty">${strings.empty}</p>`
            : this.messages.map((message) => this.renderMessage(message))}
          ${this.pending
            ? html`<div class="message assistant pending"><div class="bubble">${strings.typing}</div></div>`
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

  private renderMessage(message: ChatMessage) {
    return html`
      <div class="message ${message.role}">
        <div class="bubble ${message.error ? "error" : ""}">${message.content}</div>
        ${message.sources && message.sources.length > 0
          ? html`
              <div class="sources">
                ${message.sources.map(
                  (source) =>
                    html`<a href=${sourceHref(source)} target="_blank" rel="noopener noreferrer"
                      >${source.title}</a
                    >`,
                )}
              </div>
            `
          : null}
      </div>
    `;
  }
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
