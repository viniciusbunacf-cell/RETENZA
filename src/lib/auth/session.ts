import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { canAdminister, canManage, type Role } from "./roles";

const COOKIE = "retenza_session";
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12 horas

export interface SessionUser {
  id: string;
  providerId: string;
  name: string;
  email: string;
  role: Role;
  team: string | null;
  providerName: string;
  providerIsDemo: boolean;
}

let cachedSecret: Uint8Array | null = null;

function getSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret;
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv && fromEnv.length >= 32) {
    cachedSecret = new TextEncoder().encode(fromEnv);
    return cachedSecret;
  }
  if (process.env.DATABASE_URL) {
    // Produção sem SESSION_SECRET: chave derivada da conexão do banco, que já é secreta.
    // Trocar a senha do banco encerra as sessões abertas (todos entram de novo).
    cachedSecret = createHash("sha256").update("retenza-session-v1|" + process.env.DATABASE_URL).digest();
    return cachedSecret;
  }
  // Desenvolvimento/demonstração: segredo gerado e guardado localmente.
  const dir = path.join(process.cwd(), ".data");
  const file = path.join(dir, "session-secret");
  if (!existsSync(file)) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, randomBytes(48).toString("hex"), { mode: 0o600 });
  }
  cachedSecret = new TextEncoder().encode(readFileSync(file, "utf8").trim());
  return cachedSecret;
}

export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(MAX_AGE_SECONDS + "s")
    .sign(getSecret());
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.RETENZA_INSECURE_COOKIES !== "true",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

/** Usuário da sessão atual (verificado no banco a cada requisição) ou null. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  let userId: string | undefined;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    userId = payload.sub;
  } catch {
    return null;
  }
  if (!userId) return null;
  const db = await getDb();
  const [row] = await db
    .select({
      id: schema.users.id,
      providerId: schema.users.providerId,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.users.role,
      team: schema.users.team,
      active: schema.users.active,
      providerName: schema.providers.name,
      providerIsDemo: schema.providers.isDemo,
    })
    .from(schema.users)
    .innerJoin(schema.providers, eq(schema.providers.id, schema.users.providerId))
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!row || !row.active) return null;
  return {
    id: row.id,
    providerId: row.providerId,
    name: row.name,
    email: row.email,
    role: row.role as Role,
    team: row.team,
    providerName: row.providerName,
    providerIsDemo: row.providerIsDemo,
  };
});

/** Exige sessão válida; redireciona para o login caso contrário. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export class ForbiddenError extends Error {
  constructor(message = "Você não tem permissão para executar esta operação.") {
    super(message);
  }
}

export async function requireManager(): Promise<SessionUser> {
  const user = await requireUser();
  if (!canManage(user.role)) throw new ForbiddenError();
  return user;
}

export async function requireOwner(): Promise<SessionUser> {
  const user = await requireUser();
  if (!canAdminister(user.role)) throw new ForbiddenError();
  return user;
}
