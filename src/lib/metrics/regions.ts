import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb, rowsOf, schema } from "@/db/client";
import { getRiskConfig } from "@/lib/risk/recalculate";
import type { RiskBand } from "@/lib/risk/types";

const DAY = 86_400_000;

export interface RegionStat {
  region: string;
  customers: number;
  mrrCents: number;
  avgScore: number;
  bands: Record<RiskBand, number>;
  /** Clientes em risco alto ou crítico. */
  atRisk: number;
  atRiskMrrCents: number;
  /** Clientes com sinais de qualidade do serviço na janela recente. */
  affected: number;
  affectedShare: number;
  events30d: number;
  techTickets30d: number;
  /** Concentração de problemas segundo os critérios configurados. */
  concentration: boolean;
  openAction: { id: string; number: number; status: string } | null;
  trend: { date: string; avgScore: number; atRisk: number }[];
}

export const UNKNOWN_REGION = "Sem região";

export async function getRegionStats(providerId: string, now: Date = new Date()): Promise<RegionStat[]> {
  const db = await getDb();
  const config = await getRiskConfig(providerId, db);
  const since = new Date(now.getTime() - config.recentDays * DAY);

  const customers = await db
    .select({
      region: schema.customers.region,
      fee: schema.customers.monthlyFeeCents,
      score: schema.customers.riskScore,
      band: schema.customers.riskBand,
      factors: schema.customers.riskFactors,
    })
    .from(schema.customers)
    .where(and(eq(schema.customers.providerId, providerId), eq(schema.customers.status, "active")));

  const map = new Map<string, RegionStat>();
  const get = (region: string | null) => {
    const key = region || UNKNOWN_REGION;
    let stat = map.get(key);
    if (!stat) {
      stat = {
        region: key,
        customers: 0,
        mrrCents: 0,
        avgScore: 0,
        bands: { critical: 0, high: 0, moderate: 0, low: 0 },
        atRisk: 0,
        atRiskMrrCents: 0,
        affected: 0,
        affectedShare: 0,
        events30d: 0,
        techTickets30d: 0,
        concentration: false,
        openAction: null,
        trend: [],
      };
      map.set(key, stat);
    }
    return stat;
  };

  const scoreSum = new Map<string, number>();
  for (const c of customers) {
    const stat = get(c.region);
    stat.customers += 1;
    stat.mrrCents += c.fee;
    scoreSum.set(stat.region, (scoreSum.get(stat.region) ?? 0) + (c.score ?? 0));
    const band = (c.band ?? "low") as RiskBand;
    stat.bands[band] += 1;
    if (band === "critical" || band === "high") {
      stat.atRisk += 1;
      stat.atRiskMrrCents += c.fee;
    }
    if ((c.factors ?? []).some((f) => f.group === "service")) stat.affected += 1;
  }

  const eventRows = rowsOf<{ region: string | null; n: number }>(
    await db.execute(sql`
      select c.region, count(*)::int as n
        from network_events e join customers c on c.id = e.customer_id
       where e.provider_id = ${providerId} and c.status = 'active'
         and e.started_at >= ${since.toISOString()}::timestamptz
       group by c.region
    `),
  );
  for (const r of eventRows) if (map.has(r.region || UNKNOWN_REGION)) get(r.region).events30d = Number(r.n);

  const ticketRows = rowsOf<{ region: string | null; n: number }>(
    await db.execute(sql`
      select c.region, count(*)::int as n
        from tickets t join customers c on c.id = t.customer_id
       where t.provider_id = ${providerId} and c.status = 'active'
         and t.category in ('technical', 'speed')
         and t.opened_at >= ${since.toISOString()}::timestamptz
       group by c.region
    `),
  );
  for (const r of ticketRows) if (map.has(r.region || UNKNOWN_REGION)) get(r.region).techTickets30d = Number(r.n);

  const trendFrom = new Date(now.getTime() - 84 * DAY).toISOString().slice(0, 10);
  const trendRows = rowsOf<{ region: string | null; d: string; avg_score: number; at_risk: number }>(
    await db.execute(sql`
      select c.region, s.snapshot_date::text as d,
             avg(s.score)::float as avg_score,
             sum(case when s.band in ('high', 'critical') then 1 else 0 end)::int as at_risk
        from risk_snapshots s join customers c on c.id = s.customer_id
       where s.provider_id = ${providerId} and s.snapshot_date >= ${trendFrom}::date
       group by c.region, s.snapshot_date
       order by s.snapshot_date
    `),
  );
  for (const r of trendRows) {
    const stat = map.get(r.region || UNKNOWN_REGION);
    if (stat) stat.trend.push({ date: r.d, avgScore: Number(r.avg_score), atRisk: Number(r.at_risk) });
  }

  const openActions = await db
    .select({
      id: schema.actions.id,
      number: schema.actions.number,
      status: schema.actions.status,
      region: schema.actions.region,
    })
    .from(schema.actions)
    .where(
      and(
        eq(schema.actions.providerId, providerId),
        eq(schema.actions.kind, "region"),
        inArray(schema.actions.status, ["pending", "in_progress"]),
      ),
    );
  for (const a of openActions) {
    const stat = a.region ? map.get(a.region) : undefined;
    if (stat) stat.openAction = { id: a.id, number: a.number, status: a.status };
  }

  for (const stat of map.values()) {
    stat.avgScore = stat.customers ? (scoreSum.get(stat.region) ?? 0) / stat.customers : 0;
    stat.affectedShare = stat.customers ? stat.affected / stat.customers : 0;
    stat.concentration =
      stat.region !== UNKNOWN_REGION &&
      stat.affected >= config.cluster.minCustomers &&
      stat.affectedShare * 100 >= config.cluster.minSharePct;
  }

  return [...map.values()].sort(
    (a, b) => Number(b.concentration) - Number(a.concentration) || b.atRisk - a.atRisk || b.avgScore - a.avgScore,
  );
}

export interface CtoStat {
  cto: string;
  customers: number;
  affected: number;
  atRisk: number;
  avgScore: number;
  events30d: number;
}

export async function getCtoStats(providerId: string, region: string, now: Date = new Date()): Promise<CtoStat[]> {
  const db = await getDb();
  const config = await getRiskConfig(providerId, db);
  const since = new Date(now.getTime() - config.recentDays * DAY).toISOString();
  const rows = rowsOf<{
    cto: string | null;
    customers: number;
    affected: number;
    at_risk: number;
    avg_score: number | null;
    events: number;
  }>(
    await db.execute(sql`
      select coalesce(c.cto, 'Não informada') as cto,
             count(*)::int as customers,
             sum(case when exists (
                   select 1 from jsonb_array_elements(coalesce(c.risk_factors, '[]'::jsonb)) f
                    where f->>'group' = 'service') then 1 else 0 end)::int as affected,
             sum(case when c.risk_band in ('high', 'critical') then 1 else 0 end)::int as at_risk,
             avg(c.risk_score)::float as avg_score,
             coalesce(sum((select count(*) from network_events e
                            where e.customer_id = c.id and e.started_at >= ${since}::timestamptz)), 0)::int as events
        from customers c
       where c.provider_id = ${providerId} and c.status = 'active' and c.region = ${region}
       group by 1
       order by affected desc, at_risk desc
    `),
  );
  return rows.map((r) => ({
    cto: r.cto ?? "Não informada",
    customers: Number(r.customers),
    affected: Number(r.affected),
    atRisk: Number(r.at_risk),
    avgScore: Number(r.avg_score ?? 0),
    events30d: Number(r.events),
  }));
}
