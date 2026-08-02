import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import type { DocseraWidget } from "./widget.js";
import type { ChatMessage } from "./types.js";

// El widget es un web component de Lit: para ejercer su render y su estado
// hace falta un DOM. jsdom se monta a nivel de módulo, ANTES de importar el
// widget, porque el módulo registra el custom element (customElements.define)
// al cargarse y eso ya necesita los globales del navegador. Node aporta
// fetch/crypto/TextDecoder/ReadableStream; jsdom, el resto del DOM.
const dom = new JSDOM('<!doctype html><html lang="en"><body></body></html>', {
  url: "https://host.example/",
  pretendToBeVisual: true,
});
const { window } = dom;
const g = globalThis as unknown as Record<string, unknown>;
g.window = window;
g.document = window.document;
g.customElements = window.customElements;
g.HTMLElement = window.HTMLElement;
g.Element = window.Element;
g.Node = window.Node;
g.Document = window.Document;
g.DocumentFragment = window.DocumentFragment;
g.ShadowRoot = window.ShadowRoot;
g.CSSStyleSheet = window.CSSStyleSheet;
g.Event = window.Event;
g.CustomEvent = window.CustomEvent;
g.getComputedStyle = window.getComputedStyle.bind(window);
g.localStorage = window.localStorage;
// Node <21 no trae `navigator` global (CI usa Node 20; un Node 21+ ya lo
// expone como accessor de solo lectura que no hay que pisar). Lit lo lee al
// renderizar, así que se aporta desde jsdom solo si falta.
if (!("navigator" in globalThis)) {
  Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
}
// smooth() usa requestAnimationFrame; un setTimeout(0) lo hace determinista
// sin depender del reloj de repintado de jsdom.
g.requestAnimationFrame = (cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 0);
g.cancelAnimationFrame = (id: number) => clearTimeout(id);

// Import por efecto: al cargarse registra el custom element (el `import type`
// de arriba es solo para los tipos y no dispara ese efecto).
await import("./widget.js");

// Los métodos de la lógica (send, checkHealth...) son privados solo a ojos de
// TypeScript, no en runtime. Se alcanzan por aquí a propósito: son justo el
// comportamiento a probar, y conducirlos por eventos del DOM impediría esperar
// a que terminen sus promesas.
interface WidgetInternals {
  send(question: string): Promise<void>;
  checkHealth(): Promise<void>;
  loadHistory(): Promise<void>;
  sendFeedback(message: ChatMessage, rating: "up" | "down"): Promise<void>;
}
const inner = (el: DocseraWidget) => el as unknown as WidgetInternals;

type FetchHandler = (url: string, init?: RequestInit) => Response;
let fetchHandler: FetchHandler = () => jsonResponse({ turns: [] });
const fetchCalls: string[] = [];
g.fetch = ((input: unknown, init?: RequestInit) => {
  const url = String(input);
  fetchCalls.push(url);
  return Promise.resolve(fetchHandler(url, init));
}) as typeof fetch;

function setFetch(handler: FetchHandler): void {
  fetchHandler = handler;
}

function jsonResponse(data: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => data } as unknown as Response;
}

function streamResponse(chunks: string[], status = 200): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return { ok: status >= 200 && status < 300, status, body } as unknown as Response;
}

function sse(event: string, data: string): string {
  return `event: ${event}\ndata: ${data}\n\n`;
}

async function mount(attrs: Record<string, string> = {}): Promise<DocseraWidget> {
  const el = window.document.createElement("docsera-widget") as DocseraWidget;
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  window.document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

beforeEach(() => {
  window.document.body.innerHTML = "";
  window.localStorage.clear();
  fetchCalls.length = 0;
  fetchHandler = () => jsonResponse({ turns: [] });
});

// ─── checkHealth ───

test("checkHealth marca el server online cuando /health responde ok", async () => {
  const el = await mount({ server: "https://api.example" });
  await inner(el).checkHealth();
  assert.equal(el.serverOnline, true);
});

test("checkHealth marca offline si /health falla", async () => {
  const el = await mount({ server: "https://api.example" });
  setFetch(() => jsonResponse({}, 503));
  await inner(el).checkHealth();
  assert.equal(el.serverOnline, false);
});

test("un chequeo de salud viejo no pisa a uno más reciente", async () => {
  const el = await mount({ server: "https://api.example" });
  // Dos chequeos solapados: el primero responde tarde y con otro valor. Solo
  // debe aplicar el más reciente (guarda de secuencia interna).
  const responses = [jsonResponse({}, 503), jsonResponse({}, 200)];
  let i = 0;
  setFetch(() => responses[i++] as Response);
  const first = inner(el).checkHealth();
  const second = inner(el).checkHealth();
  await Promise.all([first, second]);
  assert.equal(el.serverOnline, true);
});

// ─── send: camino feliz y streaming ───

test("send arma la respuesta desde los deltas y aplica el evento done", async () => {
  const el = await mount({ server: "https://api.example" });
  el.serverOnline = true;
  const done = {
    sources: [{ url: "https://d/x", title: "X", anchor: "sec" }],
    sessionId: "s1",
    conversationId: "c1",
    answered: true,
  };
  setFetch((url) =>
    url.includes("/chat/stream")
      ? streamResponse([sse("delta", "Hello "), sse("delta", "world"), sse("done", JSON.stringify(done))])
      : jsonResponse({ turns: [] }),
  );

  await inner(el).send("what is it?");

  assert.equal(el.messages.length, 2);
  assert.deepEqual(el.messages[0], { role: "user", content: "what is it?" });
  const answer = el.messages[1];
  assert.equal(answer?.role, "assistant");
  assert.equal(answer?.content, "Hello world");
  assert.equal(answer?.answered, true);
  assert.equal(answer?.conversationId, "c1");
  assert.deepEqual(answer?.sources, done.sources);
  assert.equal(el.pending, false);
  assert.equal(el.serverOnline, true);
});

test("send reparte un delta largo por frames sin perder texto", async () => {
  const el = await mount({ server: "https://api.example" });
  el.serverOnline = true;
  const long = "abcdefghijklmnopqrstuvwxyz0123456789"; // > 8, dispara el suavizado
  setFetch(() =>
    streamResponse([
      sse("delta", long),
      sse("done", JSON.stringify({ sources: [], sessionId: "s", conversationId: "c", answered: true })),
    ]),
  );

  await inner(el).send("q");

  assert.equal(el.messages[1]?.content, long);
});

test("send responde el aviso de rate limit ante un 429, sin burbuja vacía extra", async () => {
  const el = await mount({ server: "https://api.example" });
  el.serverOnline = true;
  setFetch(() => streamResponse([], 429));

  await inner(el).send("q");

  assert.equal(el.messages.length, 2);
  assert.equal(el.messages[1]?.error, true);
  assert.ok((el.messages[1]?.content ?? "").length > 0);
});

test("send convierte un error del server en una burbuja de error y marca offline", async () => {
  const el = await mount({ server: "https://api.example" });
  el.serverOnline = true;
  setFetch(() => streamResponse([], 500));

  await inner(el).send("q");

  assert.equal(el.messages.length, 2);
  assert.equal(el.messages[1]?.error, true);
  assert.equal(el.serverOnline, false);
});

// ─── send: guardas ───

test("send no hace nada con una pregunta vacía", async () => {
  const el = await mount({ server: "https://api.example" });
  el.serverOnline = true;
  fetchCalls.length = 0;
  await inner(el).send("");
  assert.equal(el.messages.length, 0);
  assert.equal(fetchCalls.some((u) => u.includes("/chat/stream")), false);
});

test("send no hace nada si el server está offline", async () => {
  const el = await mount({ server: "https://api.example" });
  el.serverOnline = false;
  await inner(el).send("hola");
  assert.equal(el.messages.length, 0);
});

test("send no hace nada si ya hay una petición en curso", async () => {
  const el = await mount({ server: "https://api.example" });
  el.serverOnline = true;
  el.pending = true;
  await inner(el).send("hola");
  assert.equal(el.messages.length, 0);
});

// ─── loadHistory ───

test("loadHistory restaura la conversación previa de la sesión", async () => {
  const el = await mount({ server: "https://api.example" });
  const turns = [
    {
      conversationId: "c1",
      question: "hi",
      answer: "hello",
      answered: true,
      feedback: null,
      sources: [{ url: "https://d/a", title: "A", anchor: null }],
    },
  ];
  setFetch(() => jsonResponse({ turns }));

  await inner(el).loadHistory();

  assert.equal(el.messages.length, 2);
  assert.equal(el.messages[0]?.content, "hi");
  assert.equal(el.messages[1]?.content, "hello");
  assert.equal(el.messages[1]?.conversationId, "c1");
});

test("loadHistory no pisa una conversación ya empezada", async () => {
  const el = await mount({ server: "https://api.example" });
  el.messages = [{ role: "user", content: "en curso" }];
  setFetch(() =>
    jsonResponse({
      turns: [{ conversationId: "c1", question: "x", answer: "y", answered: true, feedback: null, sources: [] }],
    }),
  );

  await inner(el).loadHistory();

  assert.equal(el.messages.length, 1);
  assert.equal(el.messages[0]?.content, "en curso");
});

// ─── sendFeedback ───

test("sendFeedback aplica el voto de forma optimista al ir bien", async () => {
  const el = await mount({ server: "https://api.example" });
  el.messages = [{ role: "assistant", content: "a", conversationId: "c1" }];
  setFetch(() => jsonResponse({ ok: true }));

  await inner(el).sendFeedback(el.messages[0] as ChatMessage, "up");

  assert.equal(el.messages[0]?.feedback, "up");
});

test("sendFeedback revierte el voto si la petición falla", async () => {
  const el = await mount({ server: "https://api.example" });
  el.messages = [{ role: "assistant", content: "a", conversationId: "c1" }];
  setFetch(() => jsonResponse({}, 500));

  await inner(el).sendFeedback(el.messages[0] as ChatMessage, "down");

  assert.equal(el.messages[0]?.feedback, undefined);
});

test("sendFeedback no hace nada sin conversationId", async () => {
  const el = await mount({ server: "https://api.example" });
  el.messages = [{ role: "assistant", content: "a" }];
  fetchCalls.length = 0;
  await inner(el).sendFeedback(el.messages[0] as ChatMessage, "up");
  assert.equal(fetchCalls.some((u) => u.includes("/feedback")), false);
});

// ─── render ───

test("el FAB está siempre; el panel solo al abrir", async () => {
  const el = await mount({ server: "https://api.example" });
  assert.ok(el.renderRoot.querySelector(".fab"), "el FAB debería renderizarse");
  assert.equal(el.renderRoot.querySelector(".panel"), null, "el panel no debería estar cerrado");

  el.open = true;
  await el.updateComplete;
  assert.ok(el.renderRoot.querySelector(".panel"), "el panel debería aparecer al abrir");
});

test("las sugerencias se renderizan como chips desde el atributo", async () => {
  const el = await mount({ server: "https://api.example", suggestions: "How do I install?|Does it support Ollama?" });
  el.open = true;
  await el.updateComplete;

  const chips = [...el.renderRoot.querySelectorAll(".chip")];
  assert.equal(chips.length, 2);
  assert.equal(chips[0]?.textContent?.trim(), "How do I install?");
});

test("con el server offline la entrada queda deshabilitada", async () => {
  const el = await mount({ server: "https://api.example" });
  el.serverOnline = false;
  el.open = true;
  await el.updateComplete;

  const input = el.renderRoot.querySelector("input") as HTMLInputElement;
  assert.equal(input.disabled, true);
});

// ─── accesibilidad ───

test("el panel se anuncia como diálogo con nombre accesible", async () => {
  const el = await mount({ server: "https://api.example", heading: "Ask the docs" });
  el.open = true;
  await el.updateComplete;

  const panel = el.renderRoot.querySelector(".panel") as HTMLElement;
  assert.equal(panel.getAttribute("role"), "dialog");
  assert.equal(panel.getAttribute("aria-label"), "Ask the docs");
});

test("la lista de mensajes es una live region para anunciar las respuestas", async () => {
  const el = await mount({ server: "https://api.example" });
  el.open = true;
  await el.updateComplete;

  const messages = el.renderRoot.querySelector(".messages") as HTMLElement;
  assert.equal(messages.getAttribute("role"), "log");
  assert.equal(messages.getAttribute("aria-live"), "polite");
});

test("el FAB refleja su estado: nombre accesible y aria-expanded cambian al abrir", async () => {
  const el = await mount({ server: "https://api.example" });
  const fab = () => el.renderRoot.querySelector(".fab") as HTMLButtonElement;
  assert.equal(fab().getAttribute("aria-expanded"), "false");
  const closedLabel = fab().getAttribute("aria-label");

  el.open = true;
  await el.updateComplete;
  assert.equal(fab().getAttribute("aria-expanded"), "true");
  // El nombre accesible pasa de "abrir" a "cerrar": coincide con su función.
  assert.notEqual(fab().getAttribute("aria-label"), closedLabel);
});

test("al abrir, el foco entra directo en el campo de texto", async () => {
  const el = await mount({ server: "https://api.example" });
  el.open = true;
  await el.updateComplete;

  // renderRoot es el ShadowRoot en runtime (Lit lo tipa más ancho).
  assert.equal((el.renderRoot as ShadowRoot).activeElement, el.renderRoot.querySelector("input"));
});

test("Escape cierra el panel y devuelve el foco al FAB", async () => {
  const el = await mount({ server: "https://api.example" });
  el.open = true;
  await el.updateComplete;

  const panel = el.renderRoot.querySelector(".panel") as HTMLElement;
  panel.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await el.updateComplete;

  assert.equal(el.open, false);
  assert.equal(el.renderRoot.querySelector(".panel"), null);
  assert.equal((el.renderRoot as ShadowRoot).activeElement, el.renderRoot.querySelector(".fab"));
});
