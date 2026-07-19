import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool } from "pg";

const MIGRATIONS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "migrations");

// Separado del CLI (migrate.ts) para que los tests de integración puedan
// levantar el esquema real en una BD de usar y tirar, en vez de comprobar el
// SQL solo contra un doble.
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
