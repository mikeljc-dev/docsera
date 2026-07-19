import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import { loadRecentTurns } from "./history.js";
import { setupTestDb, testDatabaseUrl, truncateAll } from "../testing/db.js";

const skip = testDatabaseUrl() ? false : "requiere TEST_DATABASE_URL";

let pool: Pool;
const SESSION = "11111111-2222-3333-4444-555555555555";
const OTRA_SESION = "99999999-8888-7777-6666-555555555555";

before(async () => {
  if (skip) return;
  pool = await setupTestDb("test_history");
});

after(async () => {
  if (skip) return;
  await pool.end();
});

beforeEach(async () => {
  if (skip) return;
  await truncateAll(pool);
});

async function insertTurn(turn: {
  sessionId?: string;
  question: string;
  answer: string | null;
  answered: boolean;
  minutesAgo?: number;
}): Promise<void> {
  await pool.query(
    `INSERT INTO conversations (session_id, question, answer, answered, created_at)
     VALUES ($1, $2, $3, $4, now() - make_interval(mins => $5))`,
    [
      turn.sessionId ?? SESSION,
      turn.question,
      turn.answer,
      turn.answered,
      turn.minutesAgo ?? 0,
    ],
  );
}

test("devuelve los turnos de la sesión en orden cronológico", { skip }, async () => {
  await insertTurn({ question: "primera", answer: "A", answered: true, minutesAgo: 5 });
  await insertTurn({ question: "segunda", answer: "B", answered: true, minutesAgo: 2 });

  const turns = await loadRecentTurns(pool, SESSION);

  assert.deepEqual(
    turns.map((t) => t.question),
    ["primera", "segunda"],
  );
});

test("no mezcla sesiones", { skip }, async () => {
  await insertTurn({ question: "mía", answer: "A", answered: true });
  await insertTurn({ sessionId: OTRA_SESION, question: "ajena", answer: "B", answered: true });

  const turns = await loadRecentTurns(pool, SESSION);

  assert.deepEqual(
    turns.map((t) => t.question),
    ["mía"],
  );
});

test("se salta los turnos sin respuesta, sin cortar la conversación", { skip }, async () => {
  await insertTurn({ question: "buena anterior", answer: "A", answered: true, minutesAgo: 6 });
  await insertTurn({ question: "sin respuesta", answer: "I don't know.", answered: false, minutesAgo: 4 });
  await insertTurn({ question: "buena posterior", answer: "C", answered: true, minutesAgo: 2 });

  const turns = await loadRecentTurns(pool, SESSION);

  assert.deepEqual(
    turns.map((t) => t.question),
    ["buena anterior", "buena posterior"],
    "el turno sin respuesta se salta pero los de alrededor siguen",
  );
});

test("olvida lo anterior a la ventana de 30 minutos", { skip }, async () => {
  await insertTurn({ question: "de la semana pasada", answer: "A", answered: true, minutesAgo: 45 });
  await insertTurn({ question: "reciente", answer: "B", answered: true, minutesAgo: 1 });

  const turns = await loadRecentTurns(pool, SESSION);

  assert.deepEqual(
    turns.map((t) => t.question),
    ["reciente"],
  );
});

test("se queda con los 3 últimos turnos, no con toda la sesión", { skip }, async () => {
  for (let i = 1; i <= 5; i++) {
    await insertTurn({ question: `turno ${i}`, answer: "x", answered: true, minutesAgo: 10 - i });
  }

  const turns = await loadRecentTurns(pool, SESSION);

  assert.deepEqual(
    turns.map((t) => t.question),
    ["turno 3", "turno 4", "turno 5"],
  );
});

test("una respuesta NULL no se cuela como turno", { skip }, async () => {
  await insertTurn({ question: "sin answer", answer: null, answered: true });

  assert.deepEqual(await loadRecentTurns(pool, SESSION), []);
});
