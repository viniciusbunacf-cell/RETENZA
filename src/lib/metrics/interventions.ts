import { sql } from "drizzle-orm";
import { getDb, rowsOf } from "@/db/client";

const DAY = 86_400_000;
/** Dias de acompanhamento após o cliente entrar no grupo prioritário. */
export const FOLLOW_UP_DAYS = 45;
/** Tamanho mínimo de cada grupo para exibir uma estimativa de efeito. */
export const MIN_GROUP_SIZE = 30;

export interface GroupOutcome {
  customers: number;
  churned: number;
  churnRate: number;
  mrrCents: number;
  retainedMrrCents: number;
}

export interface InterventionImpact {
  windowStart: Date;
  windowEnd: Date;
  /** Clientes sinalizados (alto/crítico) que receberam ação concluída. */
  treated: GroupOutcome;
  /** Clientes sinalizados na mesma janela que não receberam nenhuma ação. */
  comparison: GroupOutcome;
  /** Há amostra suficiente nos dois grupos para estimar efeito? */
  enoughData: boolean;
  /** Diferença de taxa de cancelamento (comparação − intervenção), em pontos percentuais. */
  differencePp: number | null;
  /** Receita mensal preservada ESTIMADA: diferença de taxa aplicada à receita do grupo com intervenção. */
  estimatedPreservedMrrCents: number | null;
}

export interface CauseEffectiveness {
  causeGroup: string;
  actions: number;
  customers: number;
  cancelled: number;
  avgScoreBefore: number | null;
  avgScoreAfter: number | null;
  avgHours: number | null;
}

export interface OperationalStats {
  completed90d: number;
  avgResolutionHours: number | null;
  onTimeRate: number | null;
  priorityCustomers: number;
  priorityWithAction: number;
  interventionRate: number | null;
}

const emptyGroup = (): GroupOutcome => ({ customers: 0, churned: 0, churnRate: 0, mrrCents: 0, retainedMrrCents: 0 });

/**
 * Compara clientes sinalizados que receberam intervenção com clientes
 * sinalizados na mesma janela que não receberam nenhuma.
 *
 * É uma comparação OBSERVACIONAL: os grupos não foram sorteados, então a
 * diferença é um indício de efeito, não uma prova. "Cliente que recebeu uma
 * ação e não cancelou" nunca é contado automaticamente como "recuperado".
 */
export async function getInterventionImpact(providerId: string, now: Date = new Date()): Promise<InterventionImpact> {
  const db = await getDb();
  const windowStart = new Date(now.getTime() - 150 * DAY);
  const windowEnd = new Date(now.getTime() - FOLLOW_UP_DAYS * DAY);
  const from = windowStart.toISOString().slice(0, 10);
  const to = windowEnd.toISOString().slice(0, 10);

  const rows = rowsOf<{
    treated: boolean;
    any_action: boolean;
    n: number;
    churned: number;
    fee: number;
    retained_fee: number;
  }>(
    await db.execute(sql`
      with first_flag as (
        select s.customer_id, min(s.snapshot_date) as d0
          from risk_snapshots s
         where s.provider_id = ${providerId}
           and s.band in ('high', 'critical')
           and s.snapshot_date between ${from}::date and ${to}::date
         group by s.customer_id
      ),
      flagged as (
        select f.customer_id, f.d0, c.monthly_fee_cents as fee, c.cancel_type, c.cancelled_at,
               exists (
                 select 1 from action_customers ac join actions a on a.id = ac.action_id
                  where ac.customer_id = f.customer_id and a.status = 'done'
                    and a.created_at >= f.d0 - interval '7 days'
                    and a.created_at < f.d0 + interval '21 days'
               ) as treated,
               exists (
                 select 1 from action_customers ac join actions a on a.id = ac.action_id
                  where ac.customer_id = f.customer_id and a.status <> 'cancelled'
                    and a.created_at >= f.d0 - interval '7 days'
                    and a.created_at < f.d0 + ${FOLLOW_UP_DAYS} * interval '1 day'
               ) as any_action
          from first_flag f
          join customers c on c.id = f.customer_id
      )
      select treated, any_action,
             count(*)::int as n,
             sum(case when cancel_type = 'voluntary' and cancelled_at > d0
                       and cancelled_at <= d0 + ${FOLLOW_UP_DAYS} * interval '1 day' then 1 else 0 end)::int as churned,
             coalesce(sum(fee), 0)::int as fee,
             coalesce(sum(case when cancelled_at is null
                                or cancelled_at > d0 + ${FOLLOW_UP_DAYS} * interval '1 day' then fee else 0 end), 0)::int as retained_fee
        from flagged
       group by treated, any_action
    `),
  );

  const treated = emptyGroup();
  const comparison = emptyGroup();
  for (const r of rows) {
    // Clientes com ação fora do critério (tardia ou não concluída) ficam fora dos dois grupos.
    const target = r.treated ? treated : !r.any_action ? comparison : null;
    if (!target) continue;
    target.customers += Number(r.n);
    target.churned += Number(r.churned);
    target.mrrCents += Number(r.fee);
    target.retainedMrrCents += Number(r.retained_fee);
  }
  for (const grp of [treated, comparison]) grp.churnRate = grp.customers ? grp.churned / grp.customers : 0;

  const enoughData = treated.customers >= MIN_GROUP_SIZE && comparison.customers >= MIN_GROUP_SIZE;
  const diff = comparison.churnRate - treated.churnRate;
  return {
    windowStart,
    windowEnd,
    treated,
    comparison,
    enoughData,
    differencePp: enoughData ? diff * 100 : null,
    estimatedPreservedMrrCents: enoughData ? Math.max(0, Math.round(diff * treated.mrrCents)) : null,
  };
}

/** Resultado observado por tipo de causa tratada (ações concluídas há pelo menos 30 dias). */
export async function getCauseEffectiveness(providerId: string, now: Date = new Date()): Promise<CauseEffectiveness[]> {
  const db = await getDb();
  const cutoff = new Date(now.getTime() - 30 * DAY).toISOString();
  const rows = rowsOf<{
    cause_group: string | null;
    actions: number;
    customers: number;
    cancelled: number;
    avg_before: number | null;
    avg_after: number | null;
    avg_hours: number | null;
  }>(
    await db.execute(sql`
      with done as (
        select a.id, coalesce(a.cause_group, 'relationship') as cause_group, a.created_at, a.completed_at
          from actions a
         where a.provider_id = ${providerId} and a.status = 'done'
           and a.completed_at is not null and a.completed_at <= ${cutoff}::timestamptz
      ),
      members as (
        select d.id, d.cause_group, d.completed_at, ac.customer_id, ac.score_at_creation,
               c.cancel_type, c.cancelled_at,
               (select s.score from risk_snapshots s
                 where s.customer_id = ac.customer_id
                   and s.snapshot_date >= (d.completed_at + interval '21 days')::date
                 order by s.snapshot_date asc limit 1) as score_after
          from done d
          join action_customers ac on ac.action_id = d.id
          join customers c on c.id = ac.customer_id
      )
      select m.cause_group,
             count(distinct m.id)::int as actions,
             count(*)::int as customers,
             sum(case when m.cancel_type = 'voluntary' and m.cancelled_at > m.completed_at
                       and m.cancelled_at <= m.completed_at + interval '45 days' then 1 else 0 end)::int as cancelled,
             avg(m.score_at_creation) filter (where m.score_after is not null)::float as avg_before,
             avg(m.score_after)::float as avg_after,
             (select avg(extract(epoch from (d2.completed_at - d2.created_at)) / 3600)::float
                from done d2 where d2.cause_group = m.cause_group) as avg_hours
        from members m
       group by m.cause_group
       order by customers desc
    `),
  );
  return rows.map((r) => ({
    causeGroup: r.cause_group ?? "relationship",
    actions: Number(r.actions),
    customers: Number(r.customers),
    cancelled: Number(r.cancelled),
    avgScoreBefore: r.avg_before === null ? null : Number(r.avg_before),
    avgScoreAfter: r.avg_after === null ? null : Number(r.avg_after),
    avgHours: r.avg_hours === null ? null : Number(r.avg_hours),
  }));
}

export async function getOperationalStats(providerId: string, now: Date = new Date()): Promise<OperationalStats> {
  const db = await getDb();
  const since90 = new Date(now.getTime() - 90 * DAY).toISOString();
  const since30 = new Date(now.getTime() - 30 * DAY).toISOString();
  const [ops] = rowsOf<{ completed: number; avg_hours: number | null; on_time: number | null }>(
    await db.execute(sql`
      select count(*)::int as completed,
             avg(extract(epoch from (completed_at - created_at)) / 3600)::float as avg_hours,
             avg(case when completed_at <= due_at then 1.0 else 0.0 end)::float as on_time
        from actions
       where provider_id = ${providerId} and status = 'done' and completed_at >= ${since90}::timestamptz
    `),
  );
  const [cov] = rowsOf<{ priority: number; with_action: number }>(
    await db.execute(sql`
      select count(*)::int as priority,
             sum(case when exists (
                   select 1 from action_customers ac join actions a on a.id = ac.action_id
                    where ac.customer_id = c.id
                      and (a.status in ('pending', 'in_progress')
                           or (a.status = 'done' and a.completed_at >= ${since30}::timestamptz))
                 ) then 1 else 0 end)::int as with_action
        from customers c
       where c.provider_id = ${providerId} and c.status = 'active' and c.risk_band in ('high', 'critical')
    `),
  );
  const priority = Number(cov?.priority ?? 0);
  const withAction = Number(cov?.with_action ?? 0);
  return {
    completed90d: Number(ops?.completed ?? 0),
    avgResolutionHours: ops?.avg_hours === null || ops?.avg_hours === undefined ? null : Number(ops.avg_hours),
    onTimeRate: ops?.on_time === null || ops?.on_time === undefined ? null : Number(ops.on_time),
    priorityCustomers: priority,
    priorityWithAction: withAction,
    interventionRate: priority ? withAction / priority : null,
  };
}
