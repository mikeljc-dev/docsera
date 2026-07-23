import { test } from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import { getStats } from "./stats.js";

// Captura los parámetros de cada consulta según a qué SELECT pertenece, para
// comprobar que el rango de días viaja a las cuatro y con qué valor.
function capturingPool(): {
  pool: Pool;
  paramsFor: (fragment: RegExp) => unknown[] | undefined;
} {
  const captured: { text: string; params: unknown[] }[] = [];
  const pool = {
    query: (text: string, params: unknown[]) => {
      captured.push({ text, params });
      if (/count\(\*\) FILTER \(WHERE answered\)/.test(text)) {
        return Promise.resolve({ rows: [{ total: 5, answered: 4, up: 2, down: 1 }] });
      }
      return Promise.resolve({ rows: [] });
    },
  } as unknown as Pool;
  return {
    pool,
    paramsFor: (fragment) => captured.find((q) => fragment.test(q.text))?.params,
  };
}

test("sin rango, las consultas filtradas reciben null y la gráfica usa 30 días", async () => {
  const { pool, paramsFor } = capturingPool();

  const stats = await getStats(pool);

  assert.deepEqual(paramsFor(/count\(\*\) FILTER \(WHERE answered\)/), [null]);
  assert.deepEqual(paramsFor(/generate_series/), [30]);
  assert.equal(stats.chartDays, 30);
});

test("con rango de 7 días, las cuatro consultas lo reciben", async () => {
  const { pool, paramsFor } = capturingPool();

  const stats = await getStats(pool, 7);

  assert.deepEqual(paramsFor(/count\(\*\) FILTER \(WHERE answered\)/), [7]);
  assert.deepEqual(paramsFor(/NOT answered/), [7]);
  assert.deepEqual(paramsFor(/conversation_sources/), [7]);
  assert.deepEqual(paramsFor(/generate_series/), [7]);
  assert.equal(stats.chartDays, 7);
});

test("unanswered se deriva de total menos answered", async () => {
  const { pool } = capturingPool();

  const stats = await getStats(pool);

  assert.equal(stats.totals.total, 5);
  assert.equal(stats.totals.answered, 4);
  assert.equal(stats.totals.unanswered, 1);
});
