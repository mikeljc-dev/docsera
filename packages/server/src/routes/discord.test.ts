import { test, before, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { discordRoute } from "./discord.js";
import { setPool } from "../lib/db.js";
import { setChatAdapter, setEmbeddingsAdapter } from "../llm/index.js";
import { fakeChatAdapter, fakeEmbeddingsAdapter, fakePool } from "../testing/doubles.js";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const publicKeyHex = (publicKey.export({ format: "der", type: "spki" }) as Buffer)
  .subarray(-32)
  .toString("hex");

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

function askInteraction(question: string, userId = "user-1"): unknown {
  return {
    type: 2,
    application_id: "app-123",
    token: "interaction-token",
    data: { name: "ask", options: [{ name: "question", value: question }] },
    member: { user: { id: userId } },
  };
}

async function post(payload: unknown, tamper = false): Promise<Response> {
  const body = JSON.stringify(payload);
  const timestamp = "1700000000";
  const signature = sign(
    null,
    Buffer.from(timestamp + (tamper ? body + "x" : body), "utf-8"),
    privateKey,
  ).toString("hex");
  return discordRoute.fetch(
    new Request("http://localhost/discord/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Signature-Ed25519": signature,
        "X-Signature-Timestamp": timestamp,
      },
      body,
    }),
  );
}

// Captura del PATCH al webhook de Discord: la respuesta real llega en un
// task asíncrono tras el defer, así que se espera a que ocurra.
const patches: { url: string; body: unknown }[] = [];
const realFetch = globalThis.fetch;

async function waitForPatch(): Promise<{ url: string; body: unknown }> {
  for (let i = 0; i < 100; i++) {
    const patch = patches[0];
    if (patch) return patch;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Discord nunca recibió la edición del mensaje");
}

before(() => {
  // Un solo proceso por archivo de test: el limitador se inicializa aquí con
  // este valor la primera vez que se usa.
  process.env.CHAT_RATE_LIMIT = "1";
});

beforeEach(() => {
  process.env.DISCORD_PUBLIC_KEY = publicKeyHex;
  patches.length = 0;
  globalThis.fetch = ((url: unknown, init?: RequestInit) => {
    patches.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    return Promise.resolve(new Response("{}", { status: 200 }));
  }) as typeof fetch;
  setPool(poolWith());
  setChatAdapter(fakeChatAdapter("Docsera is AGPL-3.0."));
  setEmbeddingsAdapter(fakeEmbeddingsAdapter());
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.DISCORD_PUBLIC_KEY;
  setPool(undefined);
  setChatAdapter(undefined);
  setEmbeddingsAdapter(undefined);
});

test("sin DISCORD_PUBLIC_KEY el endpoint no existe", async () => {
  delete process.env.DISCORD_PUBLIC_KEY;
  const res = await post({ type: 1 });
  assert.equal(res.status, 404);
});

test("una firma inválida se rechaza con 401", async () => {
  const res = await post({ type: 1 }, true);
  assert.equal(res.status, 401);
});

test("PING firmado responde PONG", async () => {
  const res = await post({ type: 1 });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { type: 1 });
});

test("/ask responde defer y entrega la respuesta con fuentes por el webhook", async () => {
  const res = await post(askInteraction("Which license?", "user-happy"));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { type: 5 });

  const patch = await waitForPatch();
  assert.ok(patch.url.includes("/webhooks/app-123/interaction-token/messages/@original"));
  const body = patch.body as { embeds: { description: string; fields?: unknown[] }[] };
  assert.equal(body.embeds[0]?.description, "Docsera is AGPL-3.0.");
  assert.ok(body.embeds[0]?.fields);
});

test("si el RAG falla, al canal va un mensaje genérico sin detalles internos", async () => {
  setChatAdapter({
    chat: () => Promise.reject(new Error("provider secret detail")),
  });
  const res = await post(askInteraction("Which license?", "user-error"));
  assert.deepEqual(await res.json(), { type: 5 });

  const patch = await waitForPatch();
  const body = patch.body as { content?: string };
  assert.ok(body.content?.includes("Something went wrong"));
  assert.ok(!JSON.stringify(patch.body).includes("provider secret detail"));
});

test("el rate limit por usuario responde efímero sin llamar al LLM", async () => {
  await post(askInteraction("first", "user-limited"));
  const res = await post(askInteraction("second", "user-limited"));
  const body = (await res.json()) as { type: number; data: { content: string; flags: number } };
  assert.equal(body.type, 4);
  assert.equal(body.data.flags, 64);
  assert.match(body.data.content, /Too many requests/);
});

test("una pregunta fuera de límites es 400", async () => {
  const res = await post(askInteraction("x".repeat(2001), "user-long"));
  assert.equal(res.status, 400);
});
