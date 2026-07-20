import { test, before, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { slackRoute } from "./slack.js";
import { setPool } from "../lib/db.js";
import { setChatAdapter, setEmbeddingsAdapter } from "../llm/index.js";
import { fakeChatAdapter, fakeEmbeddingsAdapter, fakePool } from "../testing/doubles.js";

const SIGNING_SECRET = "test-signing-secret";
const RESPONSE_URL = "https://hooks.slack.com/commands/T1/1/xyz";

const CHUNK = {
  id: "11111111-1111-1111-1111-111111111111",
  content: "Docsera is AGPL-3.0.",
  anchor: "license",
  url: "https://docs.example.com/",
  title: "Docs",
};

function poolWith(rows = [CHUNK]) {
  return fakePool([
    { match: /FROM conversations/i, rows: [] },
    { match: /FROM chunks/i, rows },
    { match: /INSERT INTO conversations/i, rows: [{ id: "22222222-2222-2222-2222-222222222222" }] },
  ]);
}

function slashCommandBody(text: string, userId = "U-1"): string {
  return new URLSearchParams({
    command: "/ask",
    text,
    user_id: userId,
    response_url: RESPONSE_URL,
    team_id: "T1",
  }).toString();
}

async function post(
  body: string,
  { tamper = false, stale = false }: { tamper?: boolean; stale?: boolean } = {},
): Promise<Response> {
  const timestamp = String(Math.floor(Date.now() / 1000) - (stale ? 6 * 60 : 0));
  const signedBody = tamper ? body + "x" : body;
  const signature =
    "v0=" + createHmac("sha256", SIGNING_SECRET).update(`v0:${timestamp}:${signedBody}`).digest("hex");
  return slackRoute.fetch(
    new Request("http://localhost/slack/commands", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Slack-Signature": signature,
        "X-Slack-Request-Timestamp": timestamp,
      },
      body,
    }),
  );
}

// Captura de la entrega al response_url: llega en un task asíncrono tras el
// ack efímero, así que se espera a que ocurra.
const deliveries: { url: string; body: unknown }[] = [];
const realFetch = globalThis.fetch;

async function waitForDelivery(): Promise<{ url: string; body: unknown }> {
  for (let i = 0; i < 100; i++) {
    const delivery = deliveries[0];
    if (delivery) return delivery;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Slack nunca recibió la entrega al response_url");
}

before(() => {
  // Un solo proceso por archivo de test: el limitador se inicializa aquí con
  // este valor la primera vez que se usa.
  process.env.CHAT_RATE_LIMIT = "1";
});

beforeEach(() => {
  process.env.SLACK_SIGNING_SECRET = SIGNING_SECRET;
  deliveries.length = 0;
  globalThis.fetch = ((url: unknown, init?: RequestInit) => {
    deliveries.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    return Promise.resolve(new Response("ok", { status: 200 }));
  }) as typeof fetch;
  setPool(poolWith());
  setChatAdapter(fakeChatAdapter("Docsera is AGPL-3.0."));
  setEmbeddingsAdapter(fakeEmbeddingsAdapter());
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.SLACK_SIGNING_SECRET;
  setPool(undefined);
  setChatAdapter(undefined);
  setEmbeddingsAdapter(undefined);
});

test("sin SLACK_SIGNING_SECRET el endpoint no existe", async () => {
  delete process.env.SLACK_SIGNING_SECRET;
  const res = await post(slashCommandBody("hola"));
  assert.equal(res.status, 404);
});

test("una firma inválida se rechaza con 401", async () => {
  const res = await post(slashCommandBody("hola"), { tamper: true });
  assert.equal(res.status, 401);
});

test("un timestamp con más de 5 minutos de diferencia se rechaza con 401", async () => {
  const res = await post(slashCommandBody("hola"), { stale: true });
  assert.equal(res.status, 401);
});

test("texto vacío responde el uso, no un error", async () => {
  const res = await post(slashCommandBody("", "user-empty"));
  assert.equal(res.status, 200);
  const body = (await res.json()) as { response_type: string; text: string };
  assert.equal(body.response_type, "ephemeral");
  assert.match(body.text, /Usage/);
});

test("/ask responde un ack efímero y entrega la respuesta con fuentes al response_url", async () => {
  const res = await post(slashCommandBody("Which license?", "user-happy"));
  assert.equal(res.status, 200);
  const ack = (await res.json()) as { response_type: string; text: string };
  assert.equal(ack.response_type, "ephemeral");

  const delivery = await waitForDelivery();
  assert.equal(delivery.url, RESPONSE_URL);
  const message = delivery.body as {
    response_type: string;
    text: string;
    blocks: { type: string; elements?: { text: string }[] }[];
  };
  assert.equal(message.response_type, "in_channel");
  assert.equal(message.text, "Docsera is AGPL-3.0.");
  assert.ok(message.blocks.some((b) => b.type === "context"));
});

test("si el RAG falla, al canal va un mensaje genérico sin detalles internos", async () => {
  setChatAdapter({
    chat: () => Promise.reject(new Error("provider secret detail")),
  });
  await post(slashCommandBody("Which license?", "user-error"));

  const delivery = await waitForDelivery();
  const message = delivery.body as { response_type: string; text: string };
  assert.equal(message.response_type, "ephemeral");
  assert.ok(message.text.includes("Something went wrong"));
  assert.ok(!JSON.stringify(delivery.body).includes("provider secret detail"));
});

test("el rate limit por usuario responde efímero sin llamar al LLM", async () => {
  await post(slashCommandBody("first", "user-limited"));
  const res = await post(slashCommandBody("second", "user-limited"));
  const body = (await res.json()) as { response_type: string; text: string };
  assert.equal(body.response_type, "ephemeral");
  assert.match(body.text, /Too many requests/);
});

test("una pregunta fuera de límites responde el aviso, no un error crudo", async () => {
  const res = await post(slashCommandBody("x".repeat(2001), "user-long"));
  assert.equal(res.status, 200);
  const body = (await res.json()) as { response_type: string; text: string };
  assert.equal(body.response_type, "ephemeral");
  assert.match(body.text, /too long/);
});

test("sin user_id o response_url es 400", async () => {
  const body = new URLSearchParams({ command: "/ask", text: "hola" }).toString();
  const res = await post(body);
  assert.equal(res.status, 400);
});
