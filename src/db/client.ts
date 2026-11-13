import path from "node:path";
import { mkdirSync } from "node:fs";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

/**
 * Tipo comum aos dois drivers suportados:
 *  - PostgreSQL real (Supabase, RDS, etc.) quando DATABASE_URL está definido;
 *  - PGlite (PostgreSQL embarcado, gravado em disco) para desenvolvimento e demonstração.
 * O SQL e o schema são exatamente os mesmos nos dois casos.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

type GlobalWithDb = typeof globalThis & { __retenzaDb?: Promise<Db> };
const g = globalThis as GlobalWithDb;

export function isEmbeddedDb(): boolean {
  return !process.env.DATABASE_URL;
}

async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const needsSsl = /sslmode=require|supabase\.co|neon\.tech/.test(url);
    const pool = new Pool({
      connectionString: url,
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    });
    const db = drizzle(pool, { schema });
    if (process.env.RETENZA_AUTO_MIGRATE !== "false") {
      await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
    }
    return db as unknown as Db;
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dataDir = process.env.RETENZA_DATA_DIR ?? path.join(process.cwd(), ".data", "pglite");
  mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return db as unknown as Db;
}

/** Conexão única por processo (sobrevive ao hot reload em desenvolvimento). */
export function getDb(): Promise<Db> {
  if (!g.__retenzaDb) {
    g.__retenzaDb = createDb().catch((err) => {
      g.__retenzaDb = undefined;
      throw err;
    });
  }
  return g.__retenzaDb;
}

/** Normaliza o retorno de db.execute() entre os drivers. */
export function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const r = result as { rows?: T[] };
  return r.rows ?? [];
}

export { schema };
