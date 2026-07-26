import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSessionId } from "./session.js";

function fakeStorage(initial: Record<string, string> = {}): Storage & { store: Record<string, string> } {
  const store = { ...initial };
  return {
    store,
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
    key: () => null,
    length: 0,
  };
}

test("devuelve el sessionId ya guardado sin generar otro", () => {
  const storage = fakeStorage({ "docsera-session-id": "existing-id" });
  assert.equal(loadSessionId(storage), "existing-id");
});

test("sin id previo genera un UUID y lo persiste", () => {
  const storage = fakeStorage();
  const id = loadSessionId(storage);
  assert.match(id, /^[0-9a-f-]{36}$/);
  assert.equal(storage.store["docsera-session-id"], id, "queda persistido para la proxima carga");
});

test("dos cargas seguidas sobre el mismo storage dan el mismo id", () => {
  const storage = fakeStorage();
  assert.equal(loadSessionId(storage), loadSessionId(storage));
});

test("si el storage lanza al leer, aun devuelve un id valido (modo privado)", () => {
  const rota = {
    getItem: () => {
      throw new Error("storage bloqueado");
    },
    setItem: () => {
      throw new Error("storage bloqueado");
    },
  };
  const id = loadSessionId(rota);
  assert.match(id, /^[0-9a-f-]{36}$/);
});

test("sin storage disponible (undefined) genera un id sin romper", () => {
  const id = loadSessionId(undefined);
  assert.match(id, /^[0-9a-f-]{36}$/);
});
