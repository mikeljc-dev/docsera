import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import { assertEmbeddingDimensions } from "./migrations.js";
import { setupTestDb, TEST_DIMENSIONS, testDatabaseUrl } from "../testing/db.js";

// Ejerce la guarda contra Postgres real: la dimensión de la columna sale del
// pg_attribute de verdad, que un pool falso no puede reproducir.
const skip = testDatabaseUrl() ? false : "requiere TEST_DATABASE_URL";

let pool: Pool;

before(async () => {
  if (skip) return;
  pool = await setupTestDb("test_migrations_dim");
});

after(async () => {
  if (skip) return;
  await pool.end();
});

test("no lanza cuando EMBEDDING_DIMENSIONS coincide con la columna", { skip }, async () => {
  await assertEmbeddingDimensions(pool, String(TEST_DIMENSIONS));
});

test("lanza un error accionable cuando la dimensión configurada no cuadra", { skip }, async () => {
  await assert.rejects(assertEmbeddingDimensions(pool, "1536"), (error: Error) => {
    assert.match(error.message, new RegExp(`vector\\(${TEST_DIMENSIONS}\\)`));
    assert.match(error.message, /EMBEDDING_DIMENSIONS=1536/);
    // El mensaje dice cómo salir del atasco, no solo que hay uno.
    assert.match(error.message, new RegExp(`set EMBEDDING_DIMENSIONS=${TEST_DIMENSIONS}`));
    return true;
  });
});

test("una dimensión no numérica no bloquea el arranque", { skip }, async () => {
  // Si el env es basura, la migración ya habría fallado antes; aquí no se
  // convierte en un segundo punto de fallo confuso.
  await assertEmbeddingDimensions(pool, "not-a-number");
});
