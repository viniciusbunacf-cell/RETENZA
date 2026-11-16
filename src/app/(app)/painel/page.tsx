import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { loadDemoDataAction, recalculateAction } from "@/app/actions/data";
import { ChurnChart, RiskTrendChart } from "@/components/charts";
import { ActionButton } from "@/components/forms";
import {
  ActionStatusBadge,
  Card,
  CardHeader,
  EmptyState,
  GroupTag,
  Notice,
  PageHeader,
  RiskBadge,
  StatTile,
  bandDotClass,
  cn,
} from "@/components/ui";
import { canAdminister, canManage } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";
import {
  formatDateTime,
  formatInt,
  formatMoney,
  formatMoneyRound,
  formatMonth,
  formatPct,
  formatRelative,
  formatShortDate,
} from "@/lib/format";
import { getActionCounts, getPortfolioOverview, getRiskTrend, getTopRiskCustomers } from "@/lib/metrics/dashboard";
import { getInterventionImpact } from "@/lib/metrics/interventions";
import { getRegionStats } from "@/lib/metrics/regions";
import { listActions } from "@/lib/retention/queries";
import { BAND_GUIDANCE, BAND_LABELS, BAND_ORDER } from "@/lib/risk/config";
import type { RiskBand } from "@/lib/risk/types";

export default async function DashboardPage() {
  const user = await requireUser();
  const now = new Date();
  const overview = await getPortfolioOverview(user.providerId, now);

  if (overview.totalCustomers === 0) {
    return (
      <>
        <PageHeader title="Dashboard executivo" description={`Bem-vindo ao RETENZA, ${user.name.split(" ")[0]}.`} />
        <EmptyState
          title="Ainda não há dados do provedor"
          description="Importe a base de assinantes e o histórico de chamados, eventos de rede, faturas e cancelamentos para o RETENZA começar a identificar clientes em risco. Se preferir conhecer a plataforma antes, carregue uma base fictícia."
          action={
            <>
              <Link href="/integracoes" className="btn-primary">
                Importar dados
              </Link>
              {canAdminister(user.role) ? (
                <ActionButton action={loadDemoDataAction} pendingLabel="Carregando dados fictícios…">
                  Carregar dados de demonstração
                </ActionButton>
              ) : null}
            </>
          }
        />
      </>
    );
  }

  const [counts, trend, top, regions, impact, urgent] = await Promise.all([
    getActionCounts(user.providerId, now),
    getRiskTrend(user.providerId, now),
    getTopRiskCustomers(user.providerId, 6),
    getRegionStats(user.providerId, now),
    getInterventionImpact(user.providerId, now),
    listActions(user.providerId, { statuses: ["pending", "in_progress"], limit: 5, order: "due" }),
  ]);

  const priorityCustomers = overview.bands.critical.customers + overview.bands.high.customers;
  const priorityMrr = overview.bands.critical.mrrCents + overview.bands.high.mrrCents;
  const concentrated = regions.filter((r) => r.concentration);
  const voluntaryDelta = overview.churn30d.voluntaryRate - overview.churnPrev30d.voluntaryRate;
  const maxBand = Math.max(1, ...BAND_ORDER.map((b) => overview.bands[b].customers));

  return (
    <>
      <PageHeader
        title="Dashboard executivo"
        description={
          <>
            Situação da carteira de {user.providerName}.{" "}
            {overview.lastScoreAt ? `Risco calculado em ${formatDateTime(overview.lastScoreAt)}.` : "Risco ainda não calculado."}
          </>
        }
        actions={
          canManage(user.role) ? (
            <ActionButton action={recalculateAction} pendingLabel="Recalculando…">
              Recalcular risco
            </ActionButton>
          ) : null
        }
      />

      {!overview.hasCancellationHistory ? (
        <Notice tone="warning" className="mb-4">
          Nenhum cancelamento foi importado. Sem o histórico de cancelamentos dos últimos 6 a 12 meses o RETENZA
          detecta eventos problemáticos, mas não é possível medir o churn nem validar a precisão do score.
        </Notice>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Assinantes ativos"
          value={formatInt(overview.active)}
          hint={`${formatMoneyRound(overview.mrrCents)} de receita mensal`}
        />
        <StatTile
          label="Churn voluntário (30 dias)"
          value={formatPct(overview.churn30d.voluntaryRate)}
          hint={`${overview.churn30d.voluntary} cancelamentos · ${voluntaryDelta >= 0 ? "+" : "−"}${formatPct(Math.abs(voluntaryDelta))} vs. 30 dias anteriores`}
        />
        <StatTile
          label="Churn involuntário (30 dias)"
          value={formatPct(overview.churn30d.involuntaryRate)}
          hint={`${overview.churn30d.involuntary} cancelamentos por inadimplência`}
        />
        <StatTile
          label="Clientes em risco alto ou crítico"
          value={formatInt(priorityCustomers)}
          hint={`${formatPct(overview.active ? priorityCustomers / overview.active : 0)} da base ativa`}
          tone="critical"
          href="/radar?faixa=prioritario"
        />
        <StatTile
          label="Receita mensal em risco"
          value={formatMoneyRound(priorityMrr)}
          hint="Mensalidades dos clientes em risco alto ou crítico"
          tone="critical"
          href="/radar?faixa=prioritario"
        />
        <StatTile
          label="Problemas técnicos recorrentes"
          value={`${concentrated.length} ${concentrated.length === 1 ? "região" : "regiões"}`}
          hint={
            concentrated.length
              ? `${formatInt(concentrated.reduce((s, r) => s + r.affected, 0))} clientes afetados por falhas concentradas`
              : "Nenhuma concentração regional de falhas"
          }
          tone={concentrated.length ? "warning" : "default"}
          href="/regioes"
        />
        <StatTile
          label="Ações preventivas pendentes"
          value={formatInt(counts.pending + counts.inProgress)}
          hint={`${counts.inProgress} em andamento · ${counts.overdue} com prazo vencido`}
          tone={counts.overdue ? "warning" : "default"}
          href="/acoes"
        />
        <StatTile
          label="Resultado das ações"
          value={impact.treated.customers ? formatPct(1 - impact.treated.churnRate, 0) : "—"}
          hint={
            impact.treated.customers
              ? `dos ${impact.treated.customers} clientes com intervenção permaneceram após 45 dias${impact.enoughData ? ` (${formatPct(1 - impact.comparison.churnRate, 0)} sem intervenção)` : ""}`
              : "Ainda sem intervenções concluídas com 45 dias de acompanhamento"
          }
          tone="good"
          href="/indicadores"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Churn mensal"
            description="Cancelamentos do mês sobre a base ativa no início do mês."
          />
          <div className="px-3 py-4 sm:px-5">
            <ChurnChart
              data={overview.months.map((m) => ({
                label: formatMonth(m.month),
                voluntaryRate: Math.round(m.voluntaryRate * 1000) / 10,
                involuntaryRate: Math.round(m.involuntaryRate * 1000) / 10,
                voluntary: m.voluntary,
                involuntary: m.involuntary,
                base: m.base,
                partial: m.partial,
              }))}
            />
          </div>
        </Card>
        <Card>
          <CardHeader
            title="Evolução dos clientes em risco"
            description="Quantidade de clientes em risco alto e crítico a cada semana."
          />
          <div className="px-3 py-4 sm:px-5">
            {trend.length > 1 ? (
              <RiskTrendChart
                data={trend.map((t) => ({
                  label: formatShortDate(new Date(t.date + "T12:00:00Z")),
                  critical: t.critical,
                  high: t.high,
                }))}
              />
            ) : (
              <p className="py-16 text-center text-sm text-text-muted">
                O histórico aparece aqui conforme o risco é recalculado ao longo das semanas.
              </p>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Classificação de risco da base" description="Clientes ativos e receita mensal por faixa." />
          <ul className="divide-y divide-line">
            {BAND_ORDER.map((band: RiskBand) => {
              const b = overview.bands[band];
              return (
                <li key={band}>
                  <Link
                    href={`/radar?faixa=${band}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-5 py-3 hover:bg-page"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-semibold text-text">
                        <span className={cn("h-2.5 w-2.5 rounded-full", bandDotClass(band))} aria-hidden="true" />
                        Risco {BAND_LABELS[band].toLowerCase()}
                        <span className="hidden font-normal text-text-muted sm:inline">· {BAND_GUIDANCE[band]}</span>
                      </p>
                    </div>
                    <p className="text-right text-sm font-semibold text-text tabular-nums">
                      {formatInt(b.customers)}
                      <span className="ml-2 font-normal text-text-muted">{formatMoneyRound(b.mrrCents)}/mês</span>
                    </p>
                    <div className="col-span-2 h-2 overflow-hidden rounded-full bg-page">
                      <div
                        className={cn("h-full rounded-full", bandDotClass(band))}
                        style={{ width: `${Math.max(b.customers ? 1.5 : 0, (b.customers / maxBand) * 100)}%` }}
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Regiões que pedem atenção"
            description="Onde os problemas de conexão estão concentrados."
            right={
              <Link href="/regioes" className="link text-sm">
                Ver todas
              </Link>
            }
          />
          {regions.filter((r) => r.concentration || r.atRisk > 0).length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-text-muted">Nenhuma região com concentração de risco.</p>
          ) : (
            <ul className="divide-y divide-line">
              {regions
                .filter((r) => r.concentration || r.atRisk > 0)
                .slice(0, 5)
                .map((r) => (
                  <li key={r.region}>
                    <Link
                      href={`/regioes/${encodeURIComponent(r.region)}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-page"
                    >
                      <MapPin size={18} className={r.concentration ? "text-critical" : "text-text-muted"} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-text">
                          {r.region}
                          {r.concentration ? (
                            <span className="ml-2 rounded-md bg-critical-soft px-1.5 py-0.5 text-xs font-semibold text-critical-ink">
                              Concentração de falhas
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-text-muted">
                          {r.affected} de {r.customers} clientes com falhas recentes · {r.events30d} eventos de rede
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-text tabular-nums">{r.atRisk}</p>
                        <p className="text-xs text-text-muted">em risco</p>
                      </div>
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Clientes prioritários"
            description="Maiores scores de risco entre os clientes ativos."
            right={
              <Link href="/radar?faixa=prioritario" className="link text-sm">
                Abrir radar
              </Link>
            }
          />
          {top.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-text-muted">Nenhum cliente em risco alto ou crítico.</p>
          ) : (
            <ul className="divide-y divide-line">
              {top.map((c) => (
                <li key={c.id}>
                  <Link href={`/clientes/${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-page">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-text">{c.name}</p>
                      <p className="truncate text-xs text-text-muted">
                        {c.region ?? "Sem região"} · {formatMoney(c.fee)}/mês · {(c.factors ?? [])[0]?.label ?? "—"}
                      </p>
                    </div>
                    <GroupTag group={c.topGroup} />
                    <RiskBadge band={c.band as RiskBand} score={c.score} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Próximas ações preventivas"
            description="Ações em aberto ordenadas por prazo."
            right={
              <Link href="/acoes" className="link text-sm">
                Central de ações
              </Link>
            }
          />
          {urgent.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-text-muted">Nenhuma ação em aberto.</p>
          ) : (
            <ul className="divide-y divide-line">
              {urgent.map((a) => {
                const overdue = a.dueAt.getTime() < now.getTime();
                return (
                  <li key={a.id}>
                    <Link href={`/acoes/${a.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-page">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-text">
                          <span className="mr-1.5 text-text-muted">#{a.number}</span>
                          {a.title}
                        </p>
                        <p className={cn("text-xs", overdue ? "font-semibold text-critical-ink" : "text-text-muted")}>
                          {a.ownerTeam} · {a.impacted} {a.impacted === 1 ? "cliente" : "clientes"} · prazo{" "}
                          {overdue ? "vencido " : ""}
                          {formatRelative(a.dueAt, now)}
                        </p>
                      </div>
                      <ActionStatusBadge status={a.status} />
                      <ArrowRight size={16} className="text-text-muted" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
