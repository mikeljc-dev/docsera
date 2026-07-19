import { Pool } from "pg";

let pool: Pool | undefined;

export function getPool(): Pool {
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL });
  return pool;
}

// Costura para los tests de rutas: sin ella no hay forma de ejercer un
// endpoint sin Postgres delante, y las rutas se quedaban sin cubrir. Nadie
// la llama en producción.
export function setPool(replacement: Pool | undefined): void {
  pool = replacement;
}
