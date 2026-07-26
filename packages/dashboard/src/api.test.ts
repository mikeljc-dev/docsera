import { test } from "node:test";
import assert from "node:assert/strict";
import { buildConversationsQuery } from "./api.js";

test("siempre incluye limit y offset", () => {
  const q = new URLSearchParams(buildConversationsQuery({ limit: 25, offset: 50 }));
  assert.equal(q.get("limit"), "25");
  assert.equal(q.get("offset"), "50");
});

test("omite los filtros ausentes", () => {
  const q = new URLSearchParams(buildConversationsQuery({ limit: 25, offset: 0 }));
  assert.equal(q.has("answered"), false);
  assert.equal(q.has("search"), false);
  assert.equal(q.has("since"), false);
  assert.equal(q.has("sortBy"), false);
});

test("answered=false es un filtro válido y sí viaja (no se confunde con ausente)", () => {
  const q = new URLSearchParams(buildConversationsQuery({ answered: false, limit: 25, offset: 0 }));
  assert.equal(q.get("answered"), "false");
});

test("answered=true viaja como 'true'", () => {
  const q = new URLSearchParams(buildConversationsQuery({ answered: true, limit: 25, offset: 0 }));
  assert.equal(q.get("answered"), "true");
});

test("un search vacío se omite; uno con texto viaja", () => {
  const vacio = new URLSearchParams(buildConversationsQuery({ search: "", limit: 25, offset: 0 }));
  assert.equal(vacio.has("search"), false);
  const lleno = new URLSearchParams(buildConversationsQuery({ search: "ollama", limit: 25, offset: 0 }));
  assert.equal(lleno.get("search"), "ollama");
});

test("pasa sessionId, since, sortBy y sortDir cuando están presentes", () => {
  const q = new URLSearchParams(
    buildConversationsQuery({
      sessionId: "sess-1",
      since: "2026-07-20T00:00:00.000Z",
      sortBy: "feedback",
      sortDir: "asc",
      limit: 10,
      offset: 0,
    }),
  );
  assert.equal(q.get("sessionId"), "sess-1");
  assert.equal(q.get("since"), "2026-07-20T00:00:00.000Z");
  assert.equal(q.get("sortBy"), "feedback");
  assert.equal(q.get("sortDir"), "asc");
});
