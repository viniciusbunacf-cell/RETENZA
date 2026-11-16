"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { audit } from "@/lib/audit";
import { requireUser, type SessionUser } from "@/lib/auth/session";
import { nextActionNumber } from "@/lib/retention/generate";
import { priorityForBand, recommendFor } from "@/lib/risk/recommend";
import type { RiskBand, SignalGroup } from "@/lib/risk/types";
import type { FormState } from "./auth";

const HOUR = 3_600_000;

/** Carrega a ação garantindo que pertence ao provedor do usuário (isolamento entre tenants). */
async function loadAction(user: SessionUser, actionId: string) {
  const db = await getDb();
  const [action] = await db
    .select({ id: schema.actions.id, number: schema.actions.number, status: schema.actions.status })
    .from(schema.actions)
    .where(and(eq(schema.actions.id, actionId), eq(schema.actions.providerId, user.providerId)))
    .limit(1);
  return action ?? null;
}

async function logEvent(user: SessionUser, actionId: string, type: string, note?: string | null) {
  const db = await getDb();
  await db.insert(schema.actionEvents).values({
    providerId: user.providerId,
    actionId,
    userId: user.id,
    userName: user.name,
    type,
    note: note || null,
  });
}

function refresh(actionId: string) {
  revalidatePath("/acoes");
  revalidatePath(`/acoes/${actionId}`);
  revalidatePath("/painel");
}

export async function startActionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const actionId = String(formData.get("actionId") ?? "");
  const action = await loadAction(user, actionId);
  if (!action || action.status !== "pending") return;
  const db = await getDb();
  await db
    .update(schema.actions)
    .set({ status: "in_progress", startedAt: new Date(), assigneeId: user.id })
    .where(eq(schema.actions.id, action.id));
  await logEvent(user, action.id, "started");
  await audit(user, "Ação iniciada", `#${action.number}`);
  refresh(action.id);
}

export async function completeActionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const actionId = String(formData.get("actionId") ?? "");
  const resolution = String(formData.get("resolution") ?? "").trim();
  const outcome = String(formData.get("outcome") ?? "");
  if (resolution.length < 10) return { error: "Descreva o que foi feito (mínimo de 10 caracteres)." };
  if (!["resolved", "partial", "not_resolved"].includes(outcome)) return { error: "Selecione o resultado da intervenção." };
  const action = await loadAction(user, actionId);
  if (!action || !["pending", "in_progress"].includes(action.status)) return { error: "Esta ação não está em aberto." };
  const db = await getDb();
  await db
    .update(schema.actions)
    .set({ status: "done", completedAt: new Date(), resolution: resolution.slice(0, 2000), outcome })
    .where(eq(schema.actions.id, action.id));
  await logEvent(user, action.id, "completed", resolution.slice(0, 2000));
  await audit(user, "Ação concluída", `#${action.number}`);
  refresh(action.id);
  return { ok: "Intervenção registrada. O RETENZA vai acompanhar a evolução do risco destes clientes." };
}

export async function cancelActionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const actionId = String(formData.get("actionId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 5) return { error: "Informe o motivo do cancelamento da ação." };
  const action = await loadAction(user, actionId);
  if (!action || !["pending", "in_progress"].includes(action.status)) return { error: "Esta ação não está em aberto." };
  const db = await getDb();
  await db.update(schema.actions).set({ status: "cancelled" }).where(eq(schema.actions.id, action.id));
  await logEvent(user, action.id, "cancelled", reason.slice(0, 1000));
  await audit(user, "Ação cancelada", `#${action.number}`);
  refresh(action.id);
  return { ok: "Ação cancelada." };
}

export async function addNoteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const actionId = String(formData.get("actionId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (note.length < 3) return { error: "Escreva a anotação." };
  const action = await loadAction(user, actionId);
  if (!action) return { error: "Ação não encontrada." };
  await logEvent(user, action.id, "note", note.slice(0, 2000));
  refresh(action.id);
  return { ok: "Anotação registrada." };
}

export async function assignActionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const actionId = String(formData.get("actionId") ?? "");
  const assigneeId = String(formData.get("assigneeId") ?? "");
  const action = await loadAction(user, actionId);
  if (!action) return;
  const db = await getDb();
  let assignee: { id: string; name: string } | null = null;
  if (assigneeId) {
    const [row] = await db
      .select({ id: schema.users.id, name: schema.users.name })
      .from(schema.users)
      .where(and(eq(schema.users.id, assigneeId), eq(schema.users.providerId, user.providerId)))
      .limit(1);
    if (!row) return;
    assignee = row;
  }
  await db.update(schema.actions).set({ assigneeId: assignee?.id ?? null }).where(eq(schema.actions.id, action.id));
  await logEvent(user, action.id, "assigned", assignee ? `Responsável: ${assignee.name}` : "Responsável removido");
  refresh(action.id);
}

/** Cria manualmente uma ação preventiva para um cliente, usando a recomendação do motor. */
export async function createCustomerActionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const customerId = String(formData.get("customerId") ?? "");
  const db = await getDb();
  const [customer] = await db
    .select({
      id: schema.customers.id,
      name: schema.customers.name,
      region: schema.customers.region,
      riskScore: schema.customers.riskScore,
      riskBand: schema.customers.riskBand,
      riskTopGroup: schema.customers.riskTopGroup,
      riskFactors: schema.customers.riskFactors,
    })
    .from(schema.customers)
    .where(and(eq(schema.customers.id, customerId), eq(schema.customers.providerId, user.providerId)))
    .limit(1);
  if (!customer) return;

  // Não duplica: se já existe ação individual em aberto para o cliente, abre a existente.
  const existing = await db
    .select({ id: schema.actions.id })
    .from(schema.actionCustomers)
    .innerJoin(schema.actions, eq(schema.actions.id, schema.actionCustomers.actionId))
    .where(
      and(
        eq(schema.actionCustomers.customerId, customer.id),
        eq(schema.actions.kind, "customer"),
        inArray(schema.actions.status, ["pending", "in_progress"]),
      ),
    )
    .limit(1);
  if (existing[0]) redirect(`/acoes/${existing[0].id}`);

  const band = (customer.riskBand ?? "low") as RiskBand;
  const rec = recommendFor(customer.riskTopGroup as SignalGroup | null, band);
  const topFactors = (customer.riskFactors ?? [])
    .slice(0, 3)
    .map((f) => f.label.toLowerCase())
    .join(", ");
  const number = await nextActionNumber(db, user.providerId);
  const [action] = await db
    .insert(schema.actions)
    .values({
      providerId: user.providerId,
      number,
      kind: "customer",
      causeGroup: customer.riskTopGroup,
      region: customer.region,
      title: `${rec.title} — ${customer.name}`,
      problem: `Cliente com score de risco ${customer.riskScore ?? 0}. Principais fatores: ${topFactors || "sem fatores ativos no momento"}.`,
      recommendation: rec.recommendation,
      priority: priorityForBand(band),
      ownerTeam: rec.ownerTeam,
      dueAt: new Date(Date.now() + rec.slaHours * HOUR),
      status: "pending",
      source: "manual",
    })
    .returning({ id: schema.actions.id });
  await db.insert(schema.actionCustomers).values({
    actionId: action.id,
    customerId: customer.id,
    providerId: user.providerId,
    scoreAtCreation: customer.riskScore,
    bandAtCreation: customer.riskBand,
  });
  await logEvent(user, action.id, "created", "Ação criada manualmente a partir da ficha do cliente.");
  await audit(user, "Ação criada", `#${number} — ${customer.name}`);
  revalidatePath("/acoes");
  redirect(`/acoes/${action.id}`);
}
