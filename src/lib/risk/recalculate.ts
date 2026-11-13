import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
import { getDb, schema, type Db } from "@/db/client";
import { normalizeRiskConfig } from "./config";
import { computeRisk } from "./engine";
import type { CustomerSignals, RiskConfig } from "./types";

const DAY = 86_400_000;

export async function getRiskConfig(providerId: string, db?: Db): Promise<RiskConfig> {
  const conn = db ?? (await getDb());
  const [row] = await conn
    .select({ config: schema.riskConfigs.config })
    .from(schema.riskConfigs)
    .where(eq(schema.riskConfigs.providerId, providerId))
    .limit(1);
  return normalizeRiskConfig(row?.config);
}

export const toSnapshotDate = (d: Date) => d.toISOString().slice(0, 10);

export interface RecalculateOptions {
  /** Datas de referência (padrão: agora). A última atualiza o score atual dos clientes. */
  asOfDates?: Date[];
  db?: Db;
}

export interface RecalculateResult {
  customers: number;
  snapshots: number;
  lastDate: string;
}

/**
 * Recalcula o score de risco de todos os clientes de um provedor e grava a
 * fotografia (snapshot) de cada data de referência.
 */
export async function recalculateProvider(
  providerId: string,
  options: RecalculateOptions = {},
): Promise<RecalculateResult> {
  const db = options.db ?? (await getDb());
  const dates = [...(options.asOfDates ?? [new Date()])].sort((a, b) => a.getTime() - b.getTime());
  const first = dates[0];
  const last = dates[dates.length - 1];
  const config = await getRiskConfig(providerId, db);

  const customers = await db
    .select({
      id: schema.customers.id,
      status: schema.customers.status,
      activatedAt: schema.customers.activatedAt,
      cancelledAt: schema.customers.cancelledAt,
    })
    .from(schema.customers)
    .where(eq(schema.customers.providerId, providerId));

  const signals = new Map<string, CustomerSignals>();
  for (const c of customers) {
    signals.set(c.id, {
      activatedAt: c.activatedAt,
      tickets: [],
      events: [],
      invoices: [],
      retentionActionsCompletedAt: [],
    });
  }

  const ticketRows = await db
    .select({
      customerId: schema.tickets.customerId,
      category: schema.tickets.category,
      openedAt: schema.tickets.openedAt,
      closedAt: schema.tickets.closedAt,
      reopenCount: schema.tickets.reopenCount,
      csat: schema.tickets.csat,
    })
    .from(schema.tickets)
    .where(
      and(eq(schema.tickets.providerId, providerId), gte(schema.tickets.openedAt, new Date(first.getTime() - 185 * DAY))),
    );
  for (const t of ticketRows) signals.get(t.customerId)?.tickets.push(t);

  const eventRows = await db
    .select({
      customerId: schema.networkEvents.customerId,
      type: schema.networkEvents.type,
      startedAt: schema.networkEvents.startedAt,
      durationMinutes: schema.networkEvents.durationMinutes,
    })
    .from(schema.networkEvents)
    .where(
      and(
        eq(schema.networkEvents.providerId, providerId),
        gte(schema.networkEvents.startedAt, new Date(first.getTime() - (config.recentDays + 5) * DAY)),
      ),
    );
  for (const e of eventRows) signals.get(e.customerId)?.events.push(e);

  const invoiceRows = await db
    .select({
      customerId: schema.invoices.customerId,
      dueDate: schema.invoices.dueDate,
      paidAt: schema.invoices.paidAt,
    })
    .from(schema.invoices)
    .where(
      and(eq(schema.invoices.providerId, providerId), gte(schema.invoices.dueDate, new Date(first.getTime() - 200 * DAY))),
    );
  for (const i of invoiceRows) signals.get(i.customerId)?.invoices.push(i);

  const pastActions = await db
    .select({ customerId: schema.actionCustomers.customerId, completedAt: schema.actions.completedAt })
    .from(schema.actionCustomers)
    .innerJoin(schema.actions, eq(schema.actions.id, schema.actionCustomers.actionId))
    .where(
      and(
        eq(schema.actionCustomers.providerId, providerId),
        eq(schema.actions.status, "done"),
        isNotNull(schema.actions.completedAt),
      ),
    );
  for (const a of pastActions) {
    if (a.completedAt) signals.get(a.customerId)?.retentionActionsCompletedAt.push(a.completedAt);
  }

  let snapshots = 0;
  let buffer: (typeof schema.riskSnapshots.$inferInsert)[] = [];
  const flush = async () => {
    if (buffer.length === 0) return;
    await db
      .insert(schema.riskSnapshots)
      .values(buffer)
      .onConflictDoUpdate({
        target: [schema.riskSnapshots.customerId, schema.riskSnapshots.snapshotDate],
        set: {
          score: sql`excluded.score`,
          band: sql`excluded.band`,
          topGroup: sql`excluded.top_group`,
          factors: sql`excluded.factors`,
          notes: sql`excluded.notes`,
        },
      });
    snapshots += buffer.length;
    buffer = [];
  };

  for (const asOf of dates) {
    const isLast = asOf === last;
    const snapshotDate = toSnapshotDate(asOf);
    for (const c of customers) {
      if (c.activatedAt && c.activatedAt.getTime() > asOf.getTime()) continue;
      if (isLast ? c.status === "cancelled" : c.cancelledAt && c.cancelledAt.getTime() <= asOf.getTime()) continue;
      const result = computeRisk(signals.get(c.id)!, asOf, config);
      buffer.push({
        providerId,
        customerId: c.id,
        snapshotDate,
        score: result.score,
        band: result.band,
        topGroup: result.topGroup,
        factors: result.factors,
        notes: result.notes,
      });
      if (buffer.length >= 500) await flush();
    }
    await flush();
  }

  const lastDate = toSnapshotDate(last);
  await db.execute(sql`
    update customers c
       set risk_score = s.score,
           risk_band = s.band,
           risk_top_group = s.top_group,
           risk_factors = s.factors,
           risk_notes = s.notes,
           risk_updated_at = now()
      from risk_snapshots s
     where s.customer_id = c.id
       and s.snapshot_date = ${lastDate}
       and c.provider_id = ${providerId}
  `);

  return { customers: customers.length, snapshots, lastDate };
}
