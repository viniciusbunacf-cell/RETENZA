"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db/client";
import { audit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import { ForbiddenError, requireOwner } from "@/lib/auth/session";
import { ROLE_LABELS, type Role } from "@/lib/auth/roles";
import type { FormState } from "./auth";

const userSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido.").max(200),
  role: z.enum(["owner", "manager", "agent"]),
  team: z.string().trim().max(60).optional(),
  password: z.string().min(10, "A senha inicial deve ter pelo menos 10 caracteres.").max(200),
});

export async function createUserAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const owner = await requireOwner();
    const parsed = userSchema.safeParse({
      name: formData.get("name") ?? "",
      email: formData.get("email") ?? "",
      role: formData.get("role") ?? "agent",
      team: formData.get("team") ?? "",
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
    if (existing) return { error: "Já existe um usuário com este e-mail." };
    await db.insert(schema.users).values({
      providerId: owner.providerId,
      name: data.name,
      email: data.email,
      role: data.role,
      team: data.team || null,
      passwordHash: await hashPassword(data.password),
    });
    await audit(owner, "Usuário criado", `${data.name} (${ROLE_LABELS[data.role as Role]})`);
    revalidatePath("/configuracoes");
    return { ok: `Usuário ${data.name} criado. Compartilhe a senha inicial por um canal seguro.` };
  } catch (err) {
    if (err instanceof ForbiddenError) return { error: err.message };
    throw err;
  }
}

export async function toggleUserAction(formData: FormData): Promise<void> {
  const owner = await requireOwner();
  const userId = String(formData.get("userId") ?? "");
  if (!userId || userId === owner.id) return; // o proprietário não desativa a si mesmo
  const db = await getDb();
  const [target] = await db
    .select({ id: schema.users.id, name: schema.users.name, active: schema.users.active })
    .from(schema.users)
    .where(and(eq(schema.users.id, userId), eq(schema.users.providerId, owner.providerId)))
    .limit(1);
  if (!target) return;
  await db.update(schema.users).set({ active: !target.active }).where(eq(schema.users.id, target.id));
  await audit(owner, target.active ? "Usuário desativado" : "Usuário reativado", target.name);
  revalidatePath("/configuracoes");
}
