import { sql } from "drizzle-orm";
import { getDb, rowsOf } from "@/db/client";
import type { RiskBand } from "@/lib/risk/types";

const DAY = 86_400_000;
/** Horizonte de observação: cancelamentos nos N dias seguintes a cada fotografia. */
export const VALIDATION_HORIZON_DAYS = 28;
/** Um cancelamento conta como "antecipado" se o cliente esteve no grupo prioritário nos N dias anteriores. */
export const VALIDATION_LOOKBACK_DAYS = 30;

export interface BandValidation {
  band: RiskBand;
  observations: number;
  cancellations: number;
  rate: number;
}

export interface ScoreValidation {
  available: boolean;
  reason?: string;
  historyDays: number;
  snapshotDates: string[];
  /** Cancelamentos voluntários avaliados e quantos foram sinalizados antes. */
  cancellations: number;
  flaggedBefore: number;
  recall: number;
  medianLeadDays: number | null;
  bands: BandValidation[];
  baseRate: number;
  priorityRate: number;
  lift: number | null;
  /** Parcela média da base que fica no grupo prioritário (volume de alertas). */
  priorityShare: number;
}

const EMPTY: ScoreValidation = {
  available: false,
  historyDays: 0,
  snapshotDates: [],
  cancellations: 0,
  flaggedBefore: 0,
  recall: 0,
  medianLeadDays: null,
  bands: [],
  baseRate: 0,
  priorityRate: 0,
  lift: null,
  priorityShare: 0,
};

/**
 * Confronta o score com os cancelamentos voluntários que realmente aconteceram.
 * Responde a duas perguntas do piloto:
 *  - dos clientes que cancelaram, quantos estavam sinalizados antes? (cobertura)
 *  - quem é sinalizado cancela mais do que a média? (precisão / lift)
 */
export async function getScoreValidation(providerId: string, now: Date = new Date()): Promise<ScoreValidation> {
  const db = await getDb();
  const dateRows = rowsOf<{ d: string }>(
    await db.execute(
      sql`select distinct snapshot_date::text as d from risk_snapshots where provider_id = ${providerId} order by 1`,
    ),
  );
  const allDates = dateRows.map((r) => r.d);
  if (allDates.length === 0) return { ...EMPTY, reason: "Ainda não há histórico de score calculado." };

  const firstMs = Date.parse(allDates[0] + "T00:00:00Z");
  const historyDays = Math.floor((now.getTime() - firstMs) / DAY);
  if (historyDays < VALIDATION_HORIZON_DAYS + 14) {
    return {
      ...EMPTY,
      historyDays,
      reason: `O histórico de score tem ${historyDays} dias. São necessários ao menos ${VALIDATION_HORIZON_DAYS + 14} dias para comparar o score com cancelamentos reais.`,
    };
  }

  // Fotografias sem sobreposição: da mais recente com horizonte completo para trás, a cada 28 dias.
  const limitMs = now.getTime() - VALIDATION_HORIZON_DAYS * DAY;
  const eligible = allDates.filter((d) => Date.parse(d + "T00:00:00Z") <= limitMs);
  const picked: string[] = [];
  let nextMax = Infinity;
  for (let i = eligible.length - 1; i >= 0; i--) {
    const ms = Date.parse(eligible[i] + "T00:00:00Z");
    if (ms <= nextMax) {
      picked.push(eligible[i]);
      nextMax = ms - VALIDATION_HORIZON_DAYS * DAY;
    }
  }
  picked.reverse();
  if (picked.length === 0) return { ...EMPTY, historyDays, reason: "Histórico de score insuficiente." };

  const dateList = sql.join(
    picked.map((d) => sql`${d}::date`),
    sql`, `,
  );
  const bandRows = rowsOf<{ band: RiskBand; n: number; cancels: number }>(
    await db.execute(sql`
      select s.band,
             count(*)::int as n,
             sum(case when c.cancel_type = 'voluntary'
                       and c.cancelled_at > s.snapshot_date
                       and c.cancelled_at <= s.snapshot_date + ${VALIDATION_HORIZON_DAYS} * interval '1 day'
                      then 1 else 0 end)::int as cancels
        from risk_snapshots s
        join customers c on c.id = s.customer_id
       where s.provider_id = ${providerId}
         and s.snapshot_date in (${dateList})
       group by s.band
    `),
  );
  const order: RiskBand[] = ["critical", "high", "moderate", "low"];
  const bands: BandValidation[] = order.map((band) => {
    const row = bandRows.find((r) => r.band === band);
    const observations = Number(row?.n ?? 0);
    const cancellations = Number(row?.cancels ?? 0);
    return { band, observations, cancellations, rate: observations ? cancellations / observations : 0 };
  });
  const totalObs = bands.reduce((s, b) => s + b.observations, 0);
  const totalCancels = bands.reduce((s, b) => s + b.cancellations, 0);
  const priority = bands.filter((b) => b.band === "critical" || b.band === "high");
  const priorityObs = priority.reduce((s, b) => s + b.observations, 0);
  const priorityCancels = priority.reduce((s, b) => s + b.cancellations, 0);
  const baseRate = totalObs ? totalCancels / totalObs : 0;
  const priorityRate = priorityObs ? priorityCancels / priorityObs : 0;

  // Cobertura: cancelamentos voluntários ocorridos desde uma semana após o início do histórico.
  const coverageStart = new Date(firstMs + 7 * DAY);
  const cancelRows = rowsOf<{ cancelled_at: Date | string; first_flag: string | null }>(
    await db.execute(sql`
      select c.cancelled_at,
             (select min(s.snapshot_date)::text
                from risk_snapshots s
               where s.customer_id = c.id
                 and s.band in ('high', 'critical')
                 and s.snapshot_date <= c.cancelled_at::date
                 and s.snapshot_date >= (c.cancelled_at - ${VALIDATION_LOOKBACK_DAYS} * interval '1 day')::date
             ) as first_flag
        from customers c
       where c.provider_id = ${providerId}
         and c.cancel_type = 'voluntary'
         and c.cancelled_at >= ${coverageStart.toISOString()}::timestamptz
    `),
  );
  const leads: number[] = [];
  for (const r of cancelRows) {
    if (!r.first_flag) continue;
    const cancelledMs = new Date(r.cancelled_at).getTime();
    leads.push(Math.max(0, Math.round((cancelledMs - Date.parse(r.first_flag + "T00:00:00Z")) / DAY)));
  }
  leads.sort((a, b) => a - b);
  const cancellations = cancelRows.length;

  if (cancellations < 10) {
    return {
      ...EMPTY,
      historyDays,
      snapshotDates: picked,
      cancellations,
      reason: `Apenas ${cancellations} cancelamentos voluntários no período com histórico de score. São necessários ao menos 10 para uma comparação minimamente confiável.`,
    };
  }

  return {
    available: true,
    historyDays,
    snapshotDates: picked,
    cancellations,
    flaggedBefore: leads.length,
    recall: leads.length / cancellations,
    medianLeadDays: leads.length ? leads[Math.floor(leads.length / 2)] : null,
    bands,
    baseRate,
    priorityRate,
    lift: baseRate > 0 ? priorityRate / baseRate : null,
    priorityShare: totalObs ? priorityObs / totalObs : 0,
  };
}
