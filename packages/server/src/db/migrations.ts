import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool } from "pg";

const MIGRATIONS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "migrations");

// Separado del CLI (migrate.ts) para que los tests de integración puedan
// levantar el esquema real en una BD de usar y tirar, en vez de comprobar el
// SQL solo contra un doble.
// La dimensión de chunks.embedding se fija con __EMBEDDING_DIMENSIONS__ en la
// primera migración y no se puede cambiar sin recrear la tabla. Si más tarde
// EMBEDDING_DIMENSIONS diverge (cambio de modelo de embeddings, o migrar en un
// entorno y arrancar con otra config), los vectores nuevos no cuadran con la
// columna y pgvector falla con un error críptico en la primera pregunta. Esto
// lo detecta al arrancar y falla rápido con un mensaje accionable. En inglés
// como el resto de superficie que ve quien autohospeda (.env.example, README).
export async function assertEmbeddingDimensions(pool: Pool, configured: string): Promise<void> {
  // to_regclass devuelve NULL si la tabla no existe (en vez de lanzar): sin
  // tabla no hay nada que comprobar.
  const { rows } = await pool.query<{ dim: number }>(
    `SELECT atttypmod AS dim FROM pg_attribute
     WHERE attrelid = to_regclass('chunks') AND attname = 'embedding' AND NOT attisdropped`,
  );
  const actual = rows[0]?.dim;
  // Sin columna, o columna vector sin dimensión fija (-1): nada que comprobar.
  if (actual === undefined || actual < 0) return;

  const expected = Number(configured);
  if (Number.isFinite(expected) && expected !== actual) {
    throw new Error(
      `EMBEDDING_DIMENSIONS=${expected} does not match the chunks.embedding column, which is vector(${actual}). ` +
        `The dimension is fixed when the database is first migrated and cannot change without recreating the table. ` +
        `Either set EMBEDDING_DIMENSIONS=${actual} to match, or reset the database (drop its volume) and re-ingest with the new dimension.`,
    );
  }
}

export async function applyMigrations(
  pool: Pool,
  dimensions: string,
  log: (message: string) => void = () => {},
): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const { rows: applied } = await pool.query<{ name: string }>("SELECT name FROM _migrations");
  const appliedNames = new Set(applied.map((row) => row.name));

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (appliedNames.has(file)) {
      log(`skip  ${file} (ya aplicada)`);
      continue;
    }

    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf-8").replaceAll(
      "__EMBEDDING_DIMENSIONS__",
      dimensions,
    );

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      log(`apply ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
