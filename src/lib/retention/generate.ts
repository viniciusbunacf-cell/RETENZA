import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb, rowsOf, schema, type Db } from "@/db/client";
import { getRiskConfig } from "@/lib/risk/recalculate";
import { priorityForBand, recommendFor } from "@/lib/risk/recommend";
import type { RiskBand, RiskFactor, SignalGroup } from "@/lib/risk/types";
import { segmentOf } from "@/lib/segments";

const HOUR = 3_600_000;

export async function nextActionNumber(db: Db, providerId: string): Promise<number> {
  const rows = rowsOf<{ next: number }>(
    await db.execute(
      sql`select coalesce(max(number), 1000) + 1 as next from actions where provider_id = ${providerId}`,
    ),
  );
  return Number(rows[0]?.next ?? 1001);
}

export interface GenerateResult {
  regionActions: number;
  customerActions: number;
}

/**
 * Plano de ação automático:
 *  1. concentrações regionais de falhas viram UMA ação para a equipe técnica,
 *     em vez de dezenas de ocorrências isoladas;
 *  2. cada cliente em risco crítico sem ação em aberto recebe uma ação individual
 *     (clientes cobertos por uma ação regional só recebem a individual se já
 *     manifestaram intenção de cancelar).
 * Nunca duplica ações em aberto para a mesma região ou cliente.
 */
export async function generateActions(providerId: string, dbArg?: Db, now: Date = new Date()): Promise<GenerateResult> {
  const db = dbArg ?? (await getDb());
  const config = await getRiskConfig(providerId, db);
  const [company] = await db
    .select({ segment: schema.providers.segment })
    .from(schema.providers)
    .where(eq(schema.providers.id, providerId))
    .limit(1);
  const seg = segmentOf(company?.segment);

  const active = await db
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
    .where(and(eq(schema.customers.providerId, providerId), eq(schema.customers.status, "active")));

  const openActions = await db
    .select({ id: schema.actions.id, kind: schema.actions.kind, region: schema.actions.region })
    .from(schema.actions)
    .where(and(eq(schema.actions.providerId, providerId), inArray(schema.actions.status, ["pending", "in_progress"])));
  const openRegionNames = new Set(openActions.filter((a) => a.kind === "region").map((a) => a.region));
  const openIds = openActions.map((a) => a.id);
  const kindById = new Map(openActions.map((a) => [a.id, a.kind]));
  const inOpenIndividual = new Set<string>();
  const inOpenRegion = new Set<string>();
  if (openIds.length > 0) {
    const links = await db
      .select({ actionId: schema.actionCustomers.actionId, customerId: schema.actionCustomers.customerId })
      .from(schema.actionCustomers)
      .where(inArray(schema.actionCustomers.actionId, openIds));
    for (const l of links) {
      (kindById.get(l.actionId) === "region" ? inOpenRegion : inOpenIndividual).add(l.customerId);
    }
  }

  let number = await nextActionNumber(db, providerId);
  const result: GenerateResult = { regionActions: 0, customerActions: 0 };

  const hasServiceSignal = (factors: RiskFactor[] | null) => (factors ?? []).some((f) => f.group === "service");

  // ---------- 1. Concentrações regionais ----------
  const byRegion = new Map<string, typeof active>();
  for (const c of active) {
    if (!c.region) continue;
    const list = byRegion.get(c.region) ?? [];
    list.push(c);
    byRegion.set(c.region, list);
  }
  for (const [region, list] of byRegion) {
    const affected = list.filter((c) => hasServiceSignal(c.riskFactors));
    const share = (affected.length / list.length) * 100;
    if (affected.length < config.cluster.minCustomers || share < config.cluster.minSharePct) continue;
    if (openRegionNames.has(region)) continue;
    const criticalOrHigh = affected.filter((c) => c.riskBand === "critical" || c.riskBand === "high").length;
    const [action] = await db
      .insert(schema.actions)
      .values({
        providerId,
        number: number++,
        kind: "region",
        causeGroup: "service",
        region,
        title: seg.id === "provedor" ? `Concentração de falhas de conexão — ${region}` : `Concentração de ${seg.incidents} — ${region}`,
        problem: `${affected.length} ${seg.customers} em ${region} (${Math.round(share)}% da base local) tiveram ${seg.incidents} recorrentes nos últimos ${config.recentDays} dias. ${criticalOrHigh} deles já estão em risco alto ou crítico.`,
        recommendation: seg.regionAction,
        priority: criticalOrHigh >= 5 ? "critical" : "high",
        ownerTeam: seg.serviceTeam,
        dueAt: new Date(now.getTime() + 24 * HOUR),
        status: "pending",
        source: "auto",
        createdAt: now,
      })
      .returning({ id: schema.actions.id });
    await db.insert(schema.actionCustomers).values(
      affected.map((c) => ({
        actionId: action.id,
        customerId: c.id,
        providerId,
        scoreAtCreation: c.riskScore,
        bandAtCreation: c.riskBand,
      })),
    );
    await db.insert(schema.actionEvents).values({
      providerId,
      actionId: action.id,
      type: "created",
      userName: "RETENZA",
      note: "Ação gerada automaticamente pela detecção de concentração regional.",
      createdAt: now,
    });
    for (const c of affected) inOpenRegion.add(c.id);
    result.regionActions += 1;
  }

  // ---------- 2. Clientes em risco crítico ----------
  const critical = active
    .filter((c) => c.riskBand === "critical")
    .filter((c) => !inOpenIndividual.has(c.id))
    // Quem já está coberto por uma ação regional em aberto só recebe ação individual
    // se manifestou intenção de cancelar: nesse caso o contato humano não pode esperar.
    .filter((c) => !inOpenRegion.has(c.id) || (c.riskFactors ?? []).some((f) => f.rule === "cancel_intent"))
    .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0));

  for (const c of critical) {
    const band = c.riskBand as RiskBand;
    const rec = recommendFor(c.riskTopGroup as SignalGroup | null, band, seg.id);
    const topFactors = (c.riskFactors ?? [])
      .slice(0, 3)
      .map((f) => f.label.toLowerCase())
      .join(", ");
    const [action] = await db
      .insert(schema.actions)
      .values({
        providerId,
        number: number++,
        kind: "customer",
        causeGroup: c.riskTopGroup,
        region: c.region,
        title: `${rec.title} — ${c.name}`,
        problem: `Cliente com score de risco ${c.riskScore}. Principais fatores: ${topFactors || "ver detalhes do cliente"}.`,
        recommendation: rec.recommendation,
        priority: priorityForBand(band),
        ownerTeam: rec.ownerTeam,
        dueAt: new Date(now.getTime() + rec.slaHours * HOUR),
        status: "pending",
        source: "auto",
        createdAt: now,
      })
      .returning({ id: schema.actions.id });
    await db.insert(schema.actionCustomers).values({
      actionId: action.id,
      customerId: c.id,
      providerId,
      scoreAtCreation: c.riskScore,
      bandAtCreation: c.riskBand,
    });
    await db.insert(schema.actionEvents).values({
      providerId,
      actionId: action.id,
      type: "created",
      userName: "RETENZA",
      note: "Ação gerada automaticamente para cliente em risco crítico.",
      createdAt: now,
    });
    result.customerActions += 1;
  }

  return result;
}
