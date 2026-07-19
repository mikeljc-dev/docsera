import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { chatStreamRoute } from "./chatStream.js";
import { setPool } from "../lib/db.js";
import { setChatAdapter, setEmbeddingsAdapter } from "../llm/index.js";
import {
  fakeChatAdapter,
  fakeConnEnv,
  fakeEmbeddingsAdapter,
  fakePool,
} from "../testing/doubles.js";

const CHUNK = {
  id: "11111111-1111-1111-1111-111111111111",
  content: "Docsera is licensed under AGPL-3.0.",
  anchor: "license",
  url: "https://docs.example.com/",
  title: "Docs",
};

function poolWithChunks(rows = [CHUNK]) {
  return fakePool([
    { match: /FROM conversations/i, rows: [] },
    { match: /FROM chunks/i, rows },
    { match: /INSERT INTO conversations/i, rows: [{ id: "22222222-2222-2222-2222-222222222222" }] },
  ]);
}

async function post(body: unknown): Promise<Response> {
  return chatStreamRoute.fetch(
    new Request("http://localhost/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    fakeConnEnv(`10.0.0.${Math.floor(Math.random() * 250) + 1}`),
  );
}

// Devuelve los eventos SSE en orden: [{event, data}, ...]
function parseSse(text: string): { event: string; data: string }[] {
  return text
    .split("\n\n")
    .filter(Boolean)
    .map((block) => {
      const event = /^event: (.*)$/m.exec(block)?.[1] ?? "message";
      const data = [...block.matchAll(/^data: ?(.*)$/gm)].map((m) => m[1]).join("\n");
      return { event, data };
    });
}

beforeEach(() => {
  delete process.env.CHAT_NO_ANSWER_TEXT;
  setEmbeddingsAdapter(fakeEmbeddingsAdapter());
});

afterEach(() => {
  setPool(undefined);
  setChatAdapter(undefined);
  setEmbeddingsAdapter(undefined);
});

test("responde SSE y emite los delta antes del done", async () => {
  setPool(poolWithChunks());
  setChatAdapter(fakeChatAdapter("ignorado", ["Docsera uses ", "the AGPL-3.0 license."]));

  const response = await post({ question: "What license?" });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/event-stream/);

  const events = parseSse(await response.text());
  assert.deepEqual(
    events.map((e) => e.event),
    ["delta", "done"],
  );
  // El primer fragmento no llega al umbral de retención, así que salen juntos.
  assert.equal(events[0]?.data, "Docsera uses the AGPL-3.0 license.");
});

test("el done trae fuentes, conversationId y answered", async () => {
  setPool(poolWithChunks());
  setChatAdapter(fakeChatAdapter("x", ["Una respuesta lo bastante larga como para fluir."]));

  const events = parseSse(await (await post({ question: "What license?" })).text());
  const done = JSON.parse(events.at(-1)?.data ?? "{}") as {
    sources: { url: string; anchor: string }[];
    conversationId: string;
    answered: boolean;
    sessionId: string;
  };

  assert.equal(done.answered, true);
  assert.equal(done.conversationId, "22222222-2222-2222-2222-222222222222");
  assert.equal(done.sources[0]?.anchor, "license");
  assert.match(done.sessionId, /^[0-9a-f-]{36}$/);
});

test("el centinela nunca sale por un delta y no se citan fuentes", async () => {
  setPool(poolWithChunks());
  setChatAdapter(fakeChatAdapter("x", ["NO_", "ANSWER"]));

  const events = parseSse(await (await post({ question: "Something off-topic" })).text());
  const deltas = events.filter((e) => e.event === "delta");

  assert.equal(deltas.map((d) => d.data).join(""), "I don't know.");
  assert.ok(!deltas.some((d) => d.data.includes("NO_ANSWER")));

  const done = JSON.parse(events.at(-1)?.data ?? "{}") as {
    answered: boolean;
    sources: unknown[];
  };
  assert.equal(done.answered, false);
  assert.deepEqual(done.sources, []);
});

test("sin cobertura responde la frase de no-respuesta sin llamar al LLM", async () => {
  setPool(poolWithChunks([]));
  setChatAdapter({
    chat: () => Promise.reject(new Error("el LLM no debería llamarse")),
    chatStream: () => {
      throw new Error("el LLM no debería llamarse");
    },
  });

  const events = parseSse(await (await post({ question: "Nothing matches" })).text());
  assert.equal(events[0]?.data, "I don't know.");
  assert.equal(events.at(-1)?.event, "done");
});

test("un proveedor sin streaming sigue funcionando en un único fragmento", async () => {
  setPool(poolWithChunks());
  setChatAdapter(fakeChatAdapter("Respuesta entera de un proveedor sin chatStream."));

  const events = parseSse(await (await post({ question: "What license?" })).text());
  const deltas = events.filter((e) => e.event === "delta");

  assert.equal(deltas.length, 1);
  assert.equal(deltas[0]?.data, "Respuesta entera de un proveedor sin chatStream.");
});

test("un fallo del proveedor viaja como evento error, sin filtrar el detalle", async () => {
  setPool(poolWithChunks());
  setChatAdapter({
    chat: () => Promise.reject(new Error("API key inválida: sk-secreto")),
    chatStream: () => {
      throw new Error("API key inválida: sk-secreto");
    },
  });

  const events = parseSse(await (await post({ question: "What license?" })).text());
  const error = events.find((e) => e.event === "error");

  assert.ok(error, "debería emitirse un evento error");
  assert.doesNotMatch(error.data, /sk-secreto/);
  assert.match(error.data, /Something went wrong/);
});

test("un body inválido es 400 JSON, no un stream", async () => {
  setPool(poolWithChunks());

  for (const body of [{}, { question: "" }, { question: 42 }]) {
    const response = await post(body);
    assert.equal(response.status, 400);
    assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    const json = (await response.json()) as { error: string };
    assert.match(json.error, /inválido/i);
  }
});

test("un sessionId con formato inválido se descarta en vez de romper", async () => {
  setPool(poolWithChunks());
  setChatAdapter(fakeChatAdapter("x", ["Una respuesta cualquiera lo bastante larga."]));

  const events = parseSse(
    await (await post({ question: "What license?", sessionId: "no-es-un-uuid" })).text(),
  );
  const done = JSON.parse(events.at(-1)?.data ?? "{}") as { sessionId: string };

  assert.notEqual(done.sessionId, "no-es-un-uuid");
  assert.match(done.sessionId, /^[0-9a-f-]{36}$/);
});
