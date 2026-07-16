import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { loadEnv } from "../env.js";

loadEnv();

const MIGRATIONS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "migrations");
const EMBEDDING_DIMENSIONS = process.env.EMBEDDING_DIMENSIONS ?? "1536";

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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
      console.log(`skip  ${file} (ya aplicada)`);
      continue;
    }

    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf-8").replaceAll(
      "__EMBEDDING_DIMENSIONS__",
      EMBEDDING_DIMENSIONS,
    );

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`apply ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  await pool.end();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
