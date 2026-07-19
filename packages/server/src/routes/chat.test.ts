import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { chatRoute } from "./chat.js";
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

async function post(body: unknown): Promise<Response> {
  return chatRoute.fetch(
    new Request("http://localhost/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    fakeConnEnv(`10.1.0.${Math.floor(Math.random() * 250) + 1}`),
  );
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

// /chat es el contrato JSON estable que consumen el servidor MCP y las
// integraciones propias: su forma no debe cambiar sin querer.
test("devuelve el contrato completo con fuentes", async () => {
  setPool(poolWith());
  setChatAdapter(fakeChatAdapter("Docsera uses the AGPL-3.0 license."));

  const response = await post({ question: "What license?" });
  assert.equal(response.status, 200);

  const body = (await response.json()) as Record<string, unknown>;
  assert.deepEqual(Object.keys(body).sort(), [
    "answer",
    "answered",
    "conversationId",
    "sessionId",
    "sources",
  ]);
  assert.equal(body["answer"], "Docsera uses the AGPL-3.0 license.");
  assert.equal(body["answered"], true);
  assert.deepEqual(body["sources"], [
    { url: "https://docs.example.com/", title: "Docs", anchor: "license" },
  ]);
});

test("una no-respuesta no cita fuentes y queda marcada", async () => {
  setPool(poolWith());
  setChatAdapter(fakeChatAdapter("NO_ANSWER"));

  const body = (await (await post({ question: "Algo fuera de tema" })).json()) as {
    answer: string;
    answered: boolean;
    sources: unknown[];
  };

  assert.equal(body.answer, "I don't know.");
  assert.equal(body.answered, false);
  assert.deepEqual(body.sources, []);
});

test("sin cobertura responde sin llamar al LLM", async () => {
  setPool(poolWith([]));
  setChatAdapter({
    chat: () => Promise.reject(new Error("el LLM no debería llamarse")),
  });

  const body = (await (await post({ question: "Nada coincide" })).json()) as { answered: boolean };
  assert.equal(body.answered, false);
});

test("un fallo del proveedor devuelve 500 sin filtrar el detalle", async () => {
  setPool(poolWith());
  setChatAdapter({ chat: () => Promise.reject(new Error("API key inválida: sk-secreto")) });

  const response = await post({ question: "What license?" });
  assert.equal(response.status, 500);

  const body = (await response.json()) as { error: string };
  assert.doesNotMatch(body.error, /sk-secreto/);
  assert.match(body.error, /Something went wrong/);
});

test("body inválido responde 400 con detalles", async () => {
  setPool(poolWith());

  for (const body of [{}, { question: "" }, { question: "x".repeat(2001) }]) {
    const response = await post(body);
    assert.equal(response.status, 400);
    assert.ok("details" in ((await response.json()) as object));
  }
});

test("respeta la frase de no-respuesta configurada", async () => {
  process.env.CHAT_NO_ANSWER_TEXT = "No lo sé.";
  setPool(poolWith());
  setChatAdapter(fakeChatAdapter("NO_ANSWER"));

  const body = (await (await post({ question: "x" })).json()) as { answer: string };
  assert.equal(body.answer, "No lo sé.");
});
