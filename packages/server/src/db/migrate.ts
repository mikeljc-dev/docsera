import { Pool } from "pg";
import { loadEnv } from "../env.js";
import { applyMigrations } from "./migrations.js";

loadEnv();

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await applyMigrations(pool, process.env.EMBEDDING_DIMENSIONS ?? "1536", (m) => {
      console.log(m);
    });
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
