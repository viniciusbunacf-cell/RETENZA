import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { getDb, schema } from "@/db/client";
import { ScoreLineChart } from "@/components/charts";
import {
  ActionStatusBadge,
  Card,
  CardHeader,
  GroupTag,
  Notice,
  PageHeader,
  RiskBadge,
  StatTile,
} from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { formatInt, formatMoneyRound, formatPct, formatShortDate } from "@/lib/format";
import { UNKNOWN_REGION, getCtoStats, getRegionStats } from "@/lib/metrics/regions";
import type { RiskBand } from "@/lib/risk/types";

export const metadata: Metadata = { title: "Região" };

export default async function RegionPage({ params }: { params: Promise<{ regiao: string }> }) {
  const user = await requireUser();
  const region = decodeURIComponent((await params).regiao);
  const regions = await getRegionStats(user.providerId);
  const stat = regions.find((r) => r.region === region);
  if (!stat) notFound();

  const db = await getDb();
  const isUnknown = region === UNKNOWN_REGION;
  const regionFilter = isUnknown ? isNull(schema.customers.region) : eq(schema.customers.region, region);
  const [ctos, affected] = await Promise.all([
    isUnknown ? Promise.resolve([]) : getCtoStats(user.providerId, region),
    db
      .select({
        id: schema.customers.id,
        name: schema.customers.name,
        cto: schema.customers.cto,
        score: schema.customers.riskScore,
        band: schema.customers.riskBand,
        topGroup: schema.customers.riskTopGroup,
        factors: schema.customers.riskFactors,
      })
      .from(schema.customers)
      .where(
        and(
          eq(schema.customers.providerId, user.providerId),
          eq(schema.customers.status, "active"),
          regionFilter,
          sql`${schema.customers.riskScore} > 0`,
        ),
      )
      .orderBy(desc(schema.customers.riskScore))
      .limit(30),
  ]);

  return (
    <>
      <Link href="/regioes" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-soft hover:text-text">
        <ArrowLeft size={15} aria-hidden="true" /> Inteligência geográfica
      </Link>
      <PageHeader
        title={region}
        description={`${formatInt(stat.customers)} clientes ativos · ${formatMoneyRound(stat.mrrCents)} de receita mensal`}
        actions={
          stat.openAction ? (
            <Link href={`/acoes/${stat.openAction.id}`} className="btn-primary">
              Abrir ação regional #{stat.openAction.number}
            </Link>
          ) : null
        }
      />

      {stat.concentration ? (
        <Notice tone="warning" className="mb-4">
          <strong className="font-semibold">Concentração de falhas detectada.</strong> {stat.affected} clientes (
          {formatPct(stat.affectedShare, 0)} da base local) apresentam problemas de conexão recorrentes. Antes de
          abordar clientes um a um, verifique a infraestrutura que atende a região.
          {stat.openAction ? (
            <>
              {" "}
              A ação regional #{stat.openAction.number} está <ActionStatusBadge status={stat.openAction.status} />.
            </>
          ) : null}
        </Notice>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Clientes com falhas recentes"
          value={formatInt(stat.affected)}
          hint={`${formatPct(stat.affectedShare, 0)} da base da região`}
          tone={stat.concentration ? "critical" : "default"}
        />
        <StatTile label="Eventos de rede (30 dias)" value={formatInt(stat.events30d)} hint="Quedas, instabilidades e lentidão" />
        <StatTile label="Chamados técnicos (30 dias)" value={formatInt(stat.techTickets30d)} />
        <StatTile
          label="Em risco alto ou crítico"
          value={formatInt(stat.atRisk)}
          hint={`${formatMoneyRound(stat.atRiskMrrCents)} de receita mensal`}
          tone={stat.atRisk ? "warning" : "default"}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Evolução do risco da região" description="Score médio dos clientes da região a cada semana." />
          <div className="px-3 py-4">
            {stat.trend.length > 1 ? (
              <ScoreLineChart
                seriesName="Score médio"
                domainMax="auto"
                height={240}
                data={stat.trend.map((t) => ({
                  label: formatShortDate(new Date(t.date + "T12:00:00Z")),
                  value: Math.round(t.avgScore * 10) / 10,
                }))}
              />
            ) : (
              <p className="py-16 text-center text-sm text-text-muted">Histórico ainda insuficiente.</p>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Por CTO" description="Onde, dentro da região, os problemas estão concentrados." />
          {ctos.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-text-muted">CTO não informada para os clientes desta região.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse">
                <thead className="border-b border-line bg-page/60">
                  <tr>
                    <th className="th">CTO</th>
                    <th className="th text-right">Clientes</th>
                    <th className="th text-right">Com falhas</th>
                    <th className="th text-right">Eventos</th>
                    <th className="th text-right">Em risco</th>
                    <th className="th text-right">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {ctos.map((c) => (
                    <tr key={c.cto}>
                      <td className="td font-medium whitespace-nowrap text-text">{c.cto}</td>
                      <td className="td text-right tabular-nums">{c.customers}</td>
                      <td className="td text-right tabular-nums">
                        <span className="font-semibold text-text">{c.affected}</span>
                        <span className="ml-1.5 text-text-muted">
                          {formatPct(c.customers ? c.affected / c.customers : 0, 0)}
                        </span>
                      </td>
                      <td className="td text-right tabular-nums">{c.events30d}</td>
                      <td className="td text-right tabular-nums">{c.atRisk}</td>
                      <td className="td text-right tabular-nums">
                        {c.avgScore.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-4 overflow-hidden">
        <CardHeader
          title="Clientes com maior risco na região"
          description="Lista prioritária para a equipe (até 30 clientes)."
          right={
            <Link href={`/radar?regiao=${encodeURIComponent(region)}`} className="link text-sm">
              Ver todos no radar
            </Link>
          }
        />
        {affected.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-text-muted">Nenhum cliente com sinais de risco nesta região.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead className="border-b border-line bg-page/60">
                <tr>
                  <th className="th">Cliente</th>
                  <th className="th">CTO</th>
                  <th className="th">Risco</th>
                  <th className="th">Causa predominante</th>
                  <th className="th">Principal fator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {affected.map((c) => (
                  <tr key={c.id} className="hover:bg-page/60">
                    <td className="td">
                      <Link href={`/clientes/${c.id}`} className="font-semibold text-text hover:text-brand-strong hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="td text-text-soft">{c.cto ?? "—"}</td>
                    <td className="td">
                      <RiskBadge band={c.band as RiskBand} score={c.score} />
                    </td>
                    <td className="td">
                      <GroupTag group={c.topGroup} />
                    </td>
                    <td className="td text-text-soft">{(c.factors ?? [])[0]?.label ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
