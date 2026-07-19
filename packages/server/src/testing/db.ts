import { Pool } from "pg";
import { applyMigrations } from "../db/migrations.js";

// Dimensión diminuta a propósito: los vectores de los fixtures se escriben a
// mano y con 1536 componentes no habría forma de leer un test.
export const TEST_DIMENSIONS = 3;

// Los tests de integración necesitan una BD real y NUNCA deben correr contra
// la de desarrollo: exigen su propia variable, así que un `pnpm test` normal
// simplemente se los salta. CI la define (ver .github/workflows/ci.yml) y allí
// sí se ejecutan siempre.
export function testDatabaseUrl(): string | undefined {
  return process.env.TEST_DATABASE_URL;
}

// Cada fichero de test pide su propio esquema. node:test corre los ficheros
// en paralelo, así que compartir tablas significaría que el TRUNCATE de uno
// borra los fixtures que otro acaba de sembrar: una carrera que solo aparece
// de vez en cuando y en CI. `public` se queda en el search_path porque ahí
// vive el tipo `vector` de la extensión, que es de la base de datos entera.
export async function setupTestDb(schema: string): Promise<Pool> {
  const connectionString = testDatabaseUrl();
  if (!connectionString) throw new Error("TEST_DATABASE_URL no definida");

  const setup = new Pool({ connectionString });
  try {
    await setup.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await setup.query(`CREATE SCHEMA ${schema}`);
  } finally {
    await setup.end();
  }

  const pool = new Pool({ connectionString, options: `-c search_path=${schema},public` });
  await applyMigrations(pool, String(TEST_DIMENSIONS));
  return pool;
}

// Entre tests se vacían las tablas de datos, no el esquema: repetir las
// migraciones en cada test multiplicaría por diez lo que tarda la suite.
export async function truncateAll(pool: Pool): Promise<void> {
  await pool.query("TRUNCATE conversations, conversation_sources, chunks, documents CASCADE");
}

export interface ChunkFixture {
  content: string;
  embedding: number[];
  anchor?: string | null;
}

export async function seedDocument(
  pool: Pool,
  document: { url: string | null; title: string; chunks: ChunkFixture[] },
): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    "INSERT INTO documents (url, title, content_hash) VALUES ($1, $2, $3) RETURNING id",
    [document.url, document.title, `hash-${Math.random()}`],
  );
  const documentId = rows[0]?.id;
  if (!documentId) throw new Error("No se pudo insertar el documento de prueba");

  for (const [index, chunk] of document.chunks.entries()) {
    await pool.query(
      `INSERT INTO chunks (document_id, chunk_index, content, anchor, embedding)
       VALUES ($1, $2, $3, $4, $5)`,
      [documentId, index, chunk.content, chunk.anchor ?? null, JSON.stringify(chunk.embedding)],
    );
  }

  return documentId;
}
