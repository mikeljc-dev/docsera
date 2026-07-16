import { Pool } from "pg";

let pool: Pool | undefined;

export function getPool(): Pool {
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL });
  return pool;
}
