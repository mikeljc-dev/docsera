import { Pool } from "pg";
import { loadEnv } from "../env.js";
import { applyMigrations, assertEmbeddingDimensions } from "./migrations.js";

loadEnv();

async function main(): Promise<void> {
  const dimensions = process.env.EMBEDDING_DIMENSIONS ?? "1536";
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await applyMigrations(pool, dimensions, (m) => {
      console.log(m);
    });
    // Falla rápido si EMBEDDING_DIMENSIONS ya no cuadra con la columna: mejor
    // no arrancar que servir y romper con un error críptico en la 1ª pregunta.
    await assertEmbeddingDimensions(pool, dimensions);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
