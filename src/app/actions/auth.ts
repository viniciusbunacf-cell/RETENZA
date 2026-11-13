"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db/client";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { ensureDemoProvider } from "@/lib/demo/seed";
import { DEFAULT_RISK_CONFIG } from "@/lib/risk/config";

export interface FormState {
  error?: string;
  ok?: string;
}

// Limite simples de tentativas de login por e-mail (em memória, por instância).
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60_000;

function tooManyAttempts(email: string): boolean {
  const now = Date.now();
  const entry = attempts.get(email);
  if (!entry || entry.resetAt < now) {
    attempts.set(email, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Informe e-mail e senha." };
  if (tooManyAttempts(email)) return { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." };

  await ensureDemoProvider();
  const db = await getDb();
  const [user] = await db
    .select({
      id: schema.users.id,
      providerId: schema.users.providerId,
      name: schema.users.name,
      passwordHash: schema.users.passwordHash,
      active: schema.users.active,
    })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  const valid = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !valid || !user.active) return { error: "E-mail ou senha incorretos." };

  attempts.delete(email);
  await createSession(user.id);
  await audit({ providerId: user.providerId, id: user.id, name: user.name }, "Login", "Acesso à plataforma");
  redirect("/");
}

const signupSchema = z.object({
  providerName: z.string().trim().min(2, "Informe o nome do provedor.").max(120),
  city: z.string().trim().max(120).optional(),
  erp: z.string().trim().max(60).optional(),
  name: z.string().trim().min(2, "Informe seu nome.").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido.").max(200),
  password: z.string().min(10, "A senha deve ter pelo menos 10 caracteres.").max(200),
});

export async function signupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse({
    providerName: formData.get("providerName") ?? "",
    city: formData.get("city") ?? "",
    erp: formData.get("erp") ?? "",
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    password: formData.get("password") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const data = parsed.data;

  const db = await getDb();
  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, data.email))
    .limit(1);
  if (existing) return { error: "Já existe uma conta com este e-mail." };

  const passwordHash = await hashPassword(data.password);
  const userId = await db.transaction(async (tx) => {
    const [provider] = await tx
      .insert(schema.providers)
      .values({ name: data.providerName, city: data.city || null, erp: data.erp || null })
      .returning({ id: schema.providers.id });
    const [user] = await tx
      .insert(schema.users)
      .values({
        providerId: provider.id,
        name: data.name,
        email: data.email,
        passwordHash,
        role: "owner",
        team: "Diretoria",
      })
      .returning({ id: schema.users.id });
    await tx.insert(schema.riskConfigs).values({ providerId: provider.id, config: DEFAULT_RISK_CONFIG });
    await tx.insert(schema.auditLog).values({
      providerId: provider.id,
      userId: user.id,
      userName: data.name,
      action: "Cadastro do provedor",
      detail: data.providerName,
    });
    return user.id;
  });

  await createSession(userId);
  redirect("/integracoes?bemvindo=1");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
