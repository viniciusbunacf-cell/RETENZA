/**
 * Aplica as migrações do banco antes da publicação (usado pela Vercel em
 * "vercel-build"). Sem DATABASE_URL não faz nada.
 */
import path from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("DATABASE_URL não definida: migrações não aplicadas.");
    return;
  }
  const needsSsl = /sslmode=require|supabase\.co|neon\.tech/.test(url);
  const pool = new Pool({ connectionString: url, max: 1, ssl: needsSsl ? { rejectUnauthorized: false } : undefined });
  try {
    await migrate(drizzle(pool), { migrationsFolder: path.join(process.cwd(), "drizzle") });
    console.log("Migrações aplicadas.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Falha ao aplicar as migrações:", err instanceof Error ? err.message : err);
  process.exit(1);
});
