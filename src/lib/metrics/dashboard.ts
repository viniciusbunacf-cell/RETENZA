import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, rowsOf, schema } from "@/db/client";
import type { RiskBand } from "@/lib/risk/types";

const DAY = 86_400_000;

export interface ChurnMonth {
  /** Primeiro dia do mês (UTC). */
  month: Date;
  base: number;
  voluntary: number;
  involuntary: number;
  voluntaryRate: number;
  involuntaryRate: number;
  partial: boolean;
}

export interface PortfolioOverview {
  totalCustomers: number;
  active: number;
  mrrCents: number;
  bands: Record<RiskBand, { customers: number; mrrCents: number }>;
  scored: boolean;
  lastScoreAt: Date | null;
  churn30d: { base: number; voluntary: number; involuntary: number; voluntaryRate: number; involuntaryRate: number };
  churnPrev30d: { voluntaryRate: number; involuntaryRate: number };
  months: ChurnMonth[];
  hasCancellationHistory: boolean;
}

/** Visão geral da carteira: base ativa, receita, faixas de risco e churn. */
export async function getPortfolioOverview(providerId: string, now: Date = new Date()): Promise<PortfolioOverview> {
  const db = await getDb();
  const rows = await db
    .select({
      status: schema.customers.status,
      cancelType: schema.customers.cancelType,
      cancelledAt: schema.customers.cancelledAt,
      activatedAt: schema.customers.activatedAt,
      fee: schema.customers.monthlyFeeCents,
      band: schema.customers.riskBand,
      riskUpdatedAt: schema.customers.riskUpdatedAt,
    })
    .from(schema.customers)
    .where(eq(schema.customers.providerId, providerId));

  const bands: PortfolioOverview["bands"] = {
    critical: { customers: 0, mrrCents: 0 },
    high: { customers: 0, mrrCents: 0 },
    moderate: { customers: 0, mrrCents: 0 },
    low: { customers: 0, mrrCents: 0 },
  };
  let active = 0;
  let mrrCents = 0;
  let scored = false;
  let lastScoreAt: Date | null = null;
  let hasCancellationHistory = false;
  for (const r of rows) {
    if (r.cancelledAt) hasCancellationHistory = true;
    if (r.status !== "active") continue;
    active += 1;
    mrrCents += r.fee;
    if (r.band) {
      scored = true;
      bands[r.band as RiskBand].customers += 1;
      bands[r.band as RiskBand].mrrCents += r.fee;
    }
    if (r.riskUpdatedAt && (!lastScoreAt || r.riskUpdatedAt > lastScoreAt)) lastScoreAt = r.riskUpdatedAt;
  }

  // Base no início de um período: clientes já ativados e ainda não cancelados naquele momento.
  const baseAt = (t: number) =>
    rows.reduce((n, r) => {
      const activated = r.activatedAt ? r.activatedAt.getTime() : -Infinity;
      const cancelled = r.cancelledAt ? r.cancelledAt.getTime() : Infinity;
      return activated < t && cancelled >= t ? n + 1 : n;
    }, 0);
  const cancelsIn = (from: number, to: number, type: string) =>
    rows.reduce((n, r) => {
      if (!r.cancelledAt || r.cancelType !== type) return n;
      const t = r.cancelledAt.getTime();
      return t >= from && t < to ? n + 1 : n;
    }, 0);
  const windowStats = (from: number, to: number) => {
    const base = baseAt(from);
    const voluntary = cancelsIn(from, to, "voluntary");
    const involuntary = cancelsIn(from, to, "involuntary");
    return {
      base,
      voluntary,
      involuntary,
      voluntaryRate: base ? voluntary / base : 0,
      involuntaryRate: base ? involuntary / base : 0,
    };
  };

  const nowMs = now.getTime();
  const churn30d = windowStats(nowMs - 30 * DAY, nowMs + 1);
  const prev = windowStats(nowMs - 60 * DAY, nowMs - 30 * DAY);

  const months: ChurnMonth[] = [];
  for (let i = 11; i >= 0; i--) {
    const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1);
    const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1);
    const stats = windowStats(start, end);
    months.push({ month: new Date(start), ...stats, partial: i === 0 });
  }

  return {
    totalCustomers: rows.length,
    active,
    mrrCents,
    bands,
    scored,
    lastScoreAt,
    churn30d,
    churnPrev30d: { voluntaryRate: prev.voluntaryRate, involuntaryRate: prev.involuntaryRate },
    months,
    hasCancellationHistory,
  };
}

export interface ActionCounts {
  pending: number;
  inProgress: number;
  overdue: number;
  done30d: number;
}

export async function getActionCounts(providerId: string, now: Date = new Date()): Promise<ActionCounts> {
  const db = await getDb();
  const since = new Date(now.getTime() - 30 * DAY).toISOString();
  const [row] = rowsOf<{ pending: number; in_progress: number; overdue: number; done30d: number }>(
    await db.execute(sql`
      select sum(case when status = 'pending' then 1 else 0 end)::int as pending,
             sum(case when status = 'in_progress' then 1 else 0 end)::int as in_progress,
             sum(case when status in ('pending', 'in_progress') and due_at < ${now.toISOString()}::timestamptz then 1 else 0 end)::int as overdue,
             sum(case when status = 'done' and completed_at >= ${since}::timestamptz then 1 else 0 end)::int as done30d
        from actions where provider_id = ${providerId}
    `),
  );
  return {
    pending: Number(row?.pending ?? 0),
    inProgress: Number(row?.in_progress ?? 0),
    overdue: Number(row?.overdue ?? 0),
    done30d: Number(row?.done30d ?? 0),
  };
}

export interface RiskTrendPoint {
  date: string;
  critical: number;
  high: number;
}

/** Evolução semanal do número de clientes em risco alto e crítico. */
export async function getRiskTrend(providerId: string, now: Date = new Date()): Promise<RiskTrendPoint[]> {
  const db = await getDb();
  const from = new Date(now.getTime() - 120 * DAY).toISOString().slice(0, 10);
  const rows = rowsOf<{ d: string; critical: number; high: number }>(
    await db.execute(sql`
      select snapshot_date::text as d,
             sum(case when band = 'critical' then 1 else 0 end)::int as critical,
             sum(case when band = 'high' then 1 else 0 end)::int as high
        from risk_snapshots
       where provider_id = ${providerId} and snapshot_date >= ${from}::date
       group by snapshot_date order by snapshot_date
    `),
  );
  return rows.map((r) => ({ date: r.d, critical: Number(r.critical), high: Number(r.high) }));
}

export async function getTopRiskCustomers(providerId: string, limit = 6) {
  const db = await getDb();
  return db
    .select({
      id: schema.customers.id,
      name: schema.customers.name,
      region: schema.customers.region,
      planName: schema.customers.planName,
      fee: schema.customers.monthlyFeeCents,
      score: schema.customers.riskScore,
      band: schema.customers.riskBand,
      topGroup: schema.customers.riskTopGroup,
      factors: schema.customers.riskFactors,
    })
    .from(schema.customers)
    .where(
      and(
        eq(schema.customers.providerId, providerId),
        eq(schema.customers.status, "active"),
        inArray(schema.customers.riskBand, ["critical", "high"]),
      ),
    )
    .orderBy(desc(schema.customers.riskScore), desc(schema.customers.monthlyFeeCents))
    .limit(limit);
}
