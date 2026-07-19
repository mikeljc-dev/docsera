import { test, after } from "node:test";
import assert from "node:assert/strict";
// El limitador es un singleton perezoso: se construye en la primera petición
// y ya no relee la variable. Por eso vive en su propio fichero, donde
// CHAT_RATE_LIMIT se fija antes de que nadie llame a la ruta (tsx --test da
// un proceso por fichero).
process.env.CHAT_RATE_LIMIT = "2";

const { chatStreamRoute } = await import("./chatStream.js");
const { setPool } = await import("../lib/db.js");
const { setChatAdapter, setEmbeddingsAdapter } = await import("../llm/index.js");
const { fakeChatAdapter, fakeConnEnv, fakeEmbeddingsAdapter, fakePool } = await import(
  "../testing/doubles.js"
);

after(() => {
  setPool(undefined);
  setChatAdapter(undefined);
  setEmbeddingsAdapter(undefined);
  delete process.env.CHAT_RATE_LIMIT;
});

test("pasado el límite por minuto responde 429 sin llegar al LLM", async () => {
  let llamadasAlLlm = 0;
  setPool(
    fakePool([
      { match: /FROM conversations/i, rows: [] },
      {
        match: /FROM chunks/i,
        rows: [
          {
            id: "11111111-1111-1111-1111-111111111111",
            content: "c",
            anchor: null,
            url: null,
            title: "t",
          },
        ],
      },
      {
        match: /INSERT INTO conversations/i,
        rows: [{ id: "22222222-2222-2222-2222-222222222222" }],
      },
    ]),
  );
  setEmbeddingsAdapter(fakeEmbeddingsAdapter());
  const adapter = fakeChatAdapter("x", ["Una respuesta cualquiera lo bastante larga."]);
  setChatAdapter({
    chat: (m) => {
      llamadasAlLlm += 1;
      return adapter.chat(m);
    },
    chatStream: (m) => {
      llamadasAlLlm += 1;
      return adapter.chatStream!(m);
    },
  });

  const env = fakeConnEnv("198.51.100.7");
  const request = () =>
    chatStreamRoute.fetch(
      new Request("http://localhost/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: "What license?" }),
      }),
      env,
    );

  assert.equal((await request()).status, 200);
  assert.equal((await request()).status, 200);

  const limited = await request();
  assert.equal(limited.status, 429);
  assert.match(((await limited.json()) as { error: string }).error, /Too many requests/);
  assert.equal(llamadasAlLlm, 2, "la petición limitada no debe llegar al LLM");
});
