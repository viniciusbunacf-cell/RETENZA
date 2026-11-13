/**
 * Verificação rápida dos dados de demonstração: cria o provedor fictício no
 * banco configurado e imprime números-chave (base, churn, faixas, validação do score).
 *
 * Uso: npx tsx scripts/demo-check.ts
 */
import { sql } from "drizzle-orm";
import { getDb, rowsOf } from "../src/db/client";
import { ensureDemoProvider } from "../src/lib/demo/seed";
import { getScoreValidation } from "../src/lib/metrics/validation";
import { getCauseEffectiveness, getInterventionImpact, getOperationalStats } from "../src/lib/metrics/interventions";

async function main() {
  const started = Date.now();
  process.env.RETENZA_DEMO = "true";
  await ensureDemoProvider();
  const db = await getDb();
  console.log("seed em", ((Date.now() - started) / 1000).toFixed(1), "s");
  const q = async (label: string, query: ReturnType<typeof sql>) => {
    console.log("\n" + label);
    console.table(rowsOf<Record<string, unknown>>(await db.execute(query)));
  };
  await q("Clientes por status", sql`select status, cancel_type, count(*)::int n from customers group by 1,2 order by 1,2`);
  await q(
    "Volumes",
    sql`select (select count(*) from tickets)::int tickets, (select count(*) from network_events)::int events,
               (select count(*) from invoices)::int invoices, (select count(*) from risk_snapshots)::int snapshots,
               (select count(*) from actions)::int actions`,
  );
  await q(
    "Faixas atuais (ativos)",
    sql`select risk_band, count(*)::int n, round(avg(risk_score))::int avg_score from customers where status='active' group by 1 order by 3 desc`,
  );
  await q("Ações por status/tipo", sql`select status, kind, count(*)::int n from actions group by 1,2 order by 1,2`);
  await q(
    "Cancelamentos voluntários por mês",
    sql`select to_char(date_trunc('month', cancelled_at), 'YYYY-MM') mes, cancel_type, count(*)::int n
          from customers where cancelled_at is not null group by 1,2 order by 1,2`,
  );
  await q(
    "Validação: faixa na fotografia x cancelamento voluntário nos 30 dias seguintes",
    sql`with snaps as (
          select s.customer_id, s.snapshot_date, s.band from risk_snapshots s
           where s.snapshot_date <= (current_date - 30)
        )
        select band, count(*)::int n,
               sum(case when c.cancel_type='voluntary' and c.cancelled_at > s.snapshot_date
                         and c.cancelled_at <= s.snapshot_date + interval '30 days' then 1 else 0 end)::int cancels
          from snaps s join customers c on c.id = s.customer_id group by 1 order by 1`,
  );
  await q(
    "Regiões (ativos, score médio, alto+crítico)",
    sql`select region, count(*)::int n, round(avg(risk_score),1) avg_score,
               sum(case when risk_band in ('high','critical') then 1 else 0 end)::int at_risk
          from customers where status='active' group by 1 order by 3 desc`,
  );
  const [{ id }] = rowsOf<{ id: string }>(await db.execute(sql`select id from providers where is_demo limit 1`));
  console.log("\nValidação do score", await getScoreValidation(id));
  console.log("\nImpacto das intervenções", await getInterventionImpact(id));
  console.log("\nPor causa", await getCauseEffectiveness(id));
  console.log("\nOperação", await getOperationalStats(id));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
