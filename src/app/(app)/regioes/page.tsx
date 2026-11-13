import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Sparkline } from "@/components/sparkline";
import { ActionStatusBadge, Card, EmptyState, Notice, PageHeader, StatTile } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { formatInt, formatMoneyRound, formatPct } from "@/lib/format";
import { UNKNOWN_REGION, getRegionStats } from "@/lib/metrics/regions";
import { getRiskConfig } from "@/lib/risk/recalculate";

export const metadata: Metadata = { title: "Inteligência geográfica" };

export default async function RegionsPage() {
  const user = await requireUser();
  const [regions, config] = await Promise.all([getRegionStats(user.providerId), getRiskConfig(user.providerId)]);

  if (regions.length === 0) {
    return (
      <>
        <PageHeader title="Inteligência geográfica" />
        <EmptyState
          title="Sem dados de localização"
          description="Importe a base de clientes com a coluna de bairro (e CTO, se disponível) para identificar concentrações de risco por região."
          action={
            <Link href="/integracoes" className="btn-primary">
              Importar dados
            </Link>
          }
        />
      </>
    );
  }

  const concentrated = regions.filter((r) => r.concentration);
  const affectedInClusters = concentrated.reduce((s, r) => s + r.affected, 0);
  const mrrInClusters = concentrated.reduce((s, r) => s + r.atRiskMrrCents, 0);
  const onlyUnknown = regions.length === 1 && regions[0].region === UNKNOWN_REGION;

  return (
    <>
      <PageHeader
        title="Inteligência geográfica"
        description="Quando vários clientes da mesma região apresentam falhas, o problema costuma ser operacional — e não de relacionamento individual. O RETENZA agrupa essas ocorrências para que a causa comum seja tratada."
      />

      {onlyUnknown ? (
        <Notice tone="warning" className="mb-4">
          Os clientes importados não têm bairro/região informado. Inclua a coluna <code>bairro</code> no arquivo de
          clientes para habilitar a análise geográfica.
        </Notice>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          label="Regiões com concentração de falhas"
          value={concentrated.length}
          hint={`Critério: ao menos ${config.cluster.minCustomers} clientes e ${config.cluster.minSharePct}% da base local com falhas em ${config.recentDays} dias`}
          tone={concentrated.length ? "critical" : "default"}
        />
        <StatTile
          label="Clientes afetados nessas regiões"
          value={formatInt(affectedInClusters)}
          hint="Com quedas, instabilidade ou lentidão recorrentes"
          tone={concentrated.length ? "warning" : "default"}
        />
        <StatTile
          label="Receita mensal em risco nessas regiões"
          value={formatMoneyRound(mrrInClusters)}
          hint="Clientes em risco alto ou crítico"
          tone={concentrated.length ? "warning" : "default"}
        />
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse">
            <thead className="border-b border-line bg-page/60">
              <tr>
                <th className="th">Região</th>
                <th className="th text-right">Clientes</th>
                <th className="th text-right">Com falhas recentes</th>
                <th className="th text-right">Eventos</th>
                <th className="th text-right">Chamados téc.</th>
                <th className="th text-right">Risco alto/crítico</th>
                <th className="th">Score médio (12 semanas)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {regions.map((r) => (
                <tr key={r.region} className={r.concentration ? "bg-critical-soft/40" : "hover:bg-page/60"}>
                  <td className="td">
                    <Link
                      href={`/regioes/${encodeURIComponent(r.region)}`}
                      className="font-semibold whitespace-nowrap text-text hover:text-brand-strong hover:underline"
                    >
                      {r.region}
                    </Link>
                    {r.concentration ? (
                      <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold whitespace-nowrap text-critical-ink">
                        <AlertTriangle size={12} aria-hidden="true" /> Concentração de falhas
                      </p>
                    ) : null}
                    {r.openAction ? (
                      <Link
                        href={`/acoes/${r.openAction.id}`}
                        className="mt-1 inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-text-soft hover:underline"
                      >
                        Ação #{r.openAction.number} <ActionStatusBadge status={r.openAction.status} />
                      </Link>
                    ) : null}
                  </td>
                  <td className="td text-right tabular-nums">{formatInt(r.customers)}</td>
                  <td className="td text-right tabular-nums">
                    <span className="font-semibold text-text">{formatInt(r.affected)}</span>
                    <span className="ml-1.5 text-text-muted">{formatPct(r.affectedShare, 0)}</span>
                  </td>
                  <td className="td text-right tabular-nums">{formatInt(r.events30d)}</td>
                  <td className="td text-right tabular-nums">{formatInt(r.techTickets30d)}</td>
                  <td className="td text-right tabular-nums">
                    <span className="font-semibold text-text">{formatInt(r.atRisk)}</span>
                    <span className="ml-1.5 text-text-muted">{formatMoneyRound(r.atRiskMrrCents)}</span>
                  </td>
                  <td className="td">
                    <div className="flex items-center gap-3">
                      <span className="w-9 text-right font-medium text-text tabular-nums">
                        {r.avgScore.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                      </span>
                      <Sparkline
                        values={r.trend.map((t) => t.avgScore)}
                        label={`Evolução do score médio da região ${r.region}`}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-3 text-xs text-text-muted">
        Eventos e chamados consideram os últimos {config.recentDays} dias. A linha fica vermelha quando o score médio da
        região está em alta nas últimas 12 semanas.
      </p>
    </>
  );
}
