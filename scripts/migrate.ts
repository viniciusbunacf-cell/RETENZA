/**
 * Aplica as migrações do banco antes da publicação (usado pela Vercel em
 * "vercel-build"). Sem DATABASE_URL não faz nada.
 *
 * Em caso de falha, explica a causa em português sem exibir a senha.
 */
import path from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

interface UrlInfo {
  host: string;
  port: string;
  user: string;
  database: string;
}

function describeUrl(url: string): UrlInfo | null {
  try {
    const u = new URL(url);
    return { host: u.hostname, port: u.port || "5432", user: decodeURIComponent(u.username), database: u.pathname.slice(1) };
  } catch {
    return null;
  }
}

/** Problemas detectáveis só olhando o endereço (sem conectar). */
export function checkUrl(url: string): string[] {
  const problems: string[] = [];
  if (/YOUR-PASSWORD/i.test(url) || /\[|\]/.test(url)) {
    problems.push("O endereço ainda contém [YOUR-PASSWORD] ou colchetes. Troque esse trecho, colchetes incluídos, pela senha do banco.");
  }
  if (!/^postgres(ql)?:\/\//.test(url)) {
    problems.push('O endereço deve começar com "postgresql://".');
  }
  const info = describeUrl(url);
  if (!info) {
    problems.push(
      "O endereço não pôde ser lido. Se a senha tiver caracteres como @ # / ? %, gere uma senha só com letras e números na Supabase.",
    );
    return problems;
  }
  if (/^db\.[a-z0-9]+\.supabase\.co$/.test(info.host)) {
    problems.push(
      'Este é o endereço de "Direct connection", que não funciona na Vercel. Use o de "Transaction pooler" (host terminado em pooler.supabase.com, porta 6543).',
    );
  }
  if (info.host.endsWith("pooler.supabase.com") && !info.user.includes(".")) {
    problems.push('No pooler da Supabase o usuário tem o formato "postgres.<id-do-projeto>". Copie o endereço de novo pelo botão Connect.');
  }
  return problems;
}

/** Tradução das falhas de conexão mais comuns. */
export function explainError(err: unknown): string {
  const chain: { message?: string; code?: string }[] = [];
  let cur: unknown = err;
  for (let i = 0; i < 5 && cur && typeof cur === "object"; i++) {
    chain.push(cur as { message?: string; code?: string });
    cur = (cur as { cause?: unknown }).cause;
  }
  const root = chain[chain.length - 1] ?? {};
  const message = String(root.message ?? err);
  const code = String(root.code ?? "");
  const hints: [boolean, string][] = [
    [code === "28P01" || /password authentication failed/i.test(message), "Senha incorreta. Confira a senha no DATABASE_URL ou gere uma nova na Supabase."],
    [/tenant or user not found/i.test(message), 'Usuário ou projeto não encontrado no pooler. Copie de novo o endereço do "Transaction pooler" pelo botão Connect.'],
    [code === "ENOTFOUND" || code === "EAI_AGAIN", "O endereço do servidor do banco não existe. Copie de novo o endereço pelo botão Connect."],
    [code === "ENETUNREACH" || code === "EHOSTUNREACH", 'O servidor não é alcançável pela Vercel. Use o endereço de "Transaction pooler".'],
    [code === "ECONNREFUSED" || code === "ETIMEDOUT" || /timeout/i.test(message), "A conexão foi recusada ou demorou demais. Confira host e porta (6543 no Transaction pooler)."],
    [/client password must be a string/i.test(message), "A senha está vazia no endereço."],
  ];
  const hint = hints.find(([match]) => match)?.[1];
  return `${message}${code ? ` (código ${code})` : ""}${hint ? `\n→ ${hint}` : ""}`;
}

async function main() {
  const url = (process.env.DATABASE_URL ?? "").trim();
  if (!url) {
    console.log("DATABASE_URL não definida: migrações não aplicadas.");
    return;
  }
  const info = describeUrl(url);
  if (info) console.log(`Banco: ${info.host}:${info.port}/${info.database} (usuário ${info.user})`);
  const problems = checkUrl(url);
  if (problems.length) {
    for (const p of problems) console.error("Falha ao aplicar as migrações: " + p);
    process.exit(1);
  }

  const needsSsl = /sslmode=require|supabase\.co|neon\.tech/.test(url);
  const pool = new Pool({ connectionString: url, max: 1, ssl: needsSsl ? { rejectUnauthorized: false } : undefined });
  try {
    await migrate(drizzle(pool), { migrationsFolder: path.join(process.cwd(), "drizzle") });
    console.log("Migrações aplicadas.");
  } finally {
    await pool.end().catch(() => undefined);
  }
}

if (process.argv[1] && /migrate\.ts$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error("Falha ao aplicar as migrações: " + explainError(err));
    process.exit(1);
  });
}
