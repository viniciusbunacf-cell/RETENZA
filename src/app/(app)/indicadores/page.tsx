import type { Metadata } from "next";
import Link from "next/link";
import { rebuildHistoryAction } from "@/app/actions/data";
import { ActionButton } from "@/components/forms";
import { Card, CardHeader, EmptyState, GroupTag, Notice, PageHeader, RiskBadge, StatTile } from "@/components/ui";
import { canManage } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";
import { formatDate, formatInt, formatMoneyRound, formatPct } from "@/lib/format";
import { getPortfolioOverview } from "@/lib/metrics/dashboard";
import {
  FOLLOW_UP_DAYS,
  MIN_GROUP_SIZE,
  getCauseEffectiveness,
  getInterventionImpact,
  getOperationalStats,
} from "@/lib/metrics/interventions";
import { VALIDATION_HORIZON_DAYS, VALIDATION_LOOKBACK_DAYS, getScoreValidation } from "@/lib/metrics/validation";

export const metadata: Metadata = { title: "Indicadores de retenção" };

function hours(value: number | null): string {
  if (value === null) return "—";
  return value < 48 ? `${Math.round(value)} h` : `${(value / 24).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias`;
}

export default async function IndicatorsPage() {
  const user = await requireUser();
  const now = new Date();
  const overview = await getPortfolioOverview(user.providerId, now);

  if (overview.totalCustomers === 0) {
    return (
      <>
        <PageHeader title="Indicadores de retenção" />
        <EmptyState
          title="Sem dados para medir"
          description="Os indicadores aparecem depois que a base de clientes e o histórico são importados."
          action={
            <Link href="/integracoes" className="btn-primary">
              Importar dados
            </Link>
          }
        />
      </>
    );
  }

  const [impact, causes, ops, validation] = await Promise.all([
    getInterventionImpact(user.providerId, now),
    getCauseEffectiveness(user.providerId, now),
    getOperationalStats(user.providerId, now),
    getScoreValidation(user.providerId, now),
  ]);
  const priority = overview.bands.critical.customers + overview.bands.high.customers;

  return (
    <>
      <PageHeader
        title="Indicadores de retenção"
        description="Resultados que fazem sentido financeiramente, separando o que foi observado do que é estimativa."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile
          label="Churn rate (30 dias)"
          value={formatPct(overview.churn30d.voluntaryRate + overview.churn30d.involuntaryRate)}
          hint={`${formatPct(overview.churn30d.voluntaryRate)} voluntário · ${formatPct(overview.churn30d.involuntaryRate)} involuntário`}
        />
        <StatTile
          label="Clientes em risco"
          value={formatInt(priority)}
          hint={`${formatPct(overview.active ? priority / overview.active : 0)} da base em risco alto ou crítico`}
          tone="critical"
        />
        <StatTile
          label="Taxa de intervenção"
          value={ops.interventionRate === null ? "—" : formatPct(ops.interventionRate, 0)}
          hint={`${ops.priorityWithAction} de ${ops.priorityCustomers} clientes em risco têm ação em aberto ou concluída nos últimos 30 dias`}
        />
        <StatTile
          label="Taxa de retenção após intervenção"
          value={impact.treated.customers ? formatPct(1 - impact.treated.churnRate, 0) : "—"}
          hint={
            impact.treated.customers
              ? `${impact.treated.customers - impact.treated.churned} de ${impact.treated.customers} clientes permaneceram ${FOLLOW_UP_DAYS} dias depois`
              : `Requer intervenções com ${FOLLOW_UP_DAYS} dias de acompanhamento`
          }
          tone="good"
        />
        <StatTile
          label="Tempo de resolução"
          value={hours(ops.avgResolutionHours)}
          hint={
            ops.completed90d
              ? `Média entre alerta e solução · ${formatPct(ops.onTimeRate ?? 0, 0)} dentro do prazo (${ops.completed90d} ações em 90 dias)`
              : "Nenhuma ação concluída nos últimos 90 dias"
          }
        />
        <StatTile
          label="Receita mensal preservada (estimativa)"
          value={impact.estimatedPreservedMrrCents === null ? "—" : formatMoneyRound(impact.estimatedPreservedMrrCents)}
          hint={
            impact.estimatedPreservedMrrCents === null
              ? "Amostra ainda insuficiente para estimar"
              : "Estimativa por comparação de grupos; ver detalhes abaixo"
          }
          tone="good"
        />
      </div>

      <Card className="mt-4">
        <CardHeader
          title="As ações de retenção estão funcionando?"
          description={`Clientes que entraram em risco alto ou crítico entre ${formatDate(impact.windowStart)} e ${formatDate(impact.windowEnd)}, acompanhados por ${FOLLOW_UP_DAYS} dias.`}
        />
        <div className="grid grid-cols-1 gap-px bg-line md:grid-cols-2">
          {[
            { title: "Receberam intervenção concluída", grp: impact.treated, accent: "text-keep" },
            { title: "Não receberam nenhuma ação", grp: impact.comparison, accent: "text-text" },
          ].map(({ title, grp, accent }) => (
            <div key={title} className="bg-white px-5 py-5">
              <p className="text-sm font-semibold text-text">{title}</p>
              <p className={`mt-2 font-display text-3xl font-semibold tracking-tight tabular-nums ${accent}`}>
                {grp.customers ? formatPct(grp.churnRate) : "—"}
              </p>
              <p className="text-sm text-text-soft">cancelaram voluntariamente em {FOLLOW_UP_DAYS} dias</p>
              <dl className="mt-4 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-text-soft">Clientes no grupo</dt>
                  <dd className="font-medium text-text tabular-nums">{formatInt(grp.customers)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-soft">Cancelaram</dt>
                  <dd className="font-medium text-text tabular-nums">{formatInt(grp.churned)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-soft">Receita mensal dos que permaneceram</dt>
                  <dd className="font-medium text-text tabular-nums">{formatMoneyRound(grp.retainedMrrCents)}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-px border-t border-line bg-line md:grid-cols-2">
          <div className="bg-white px-5 py-4">
            <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">Resultado observado</p>
            <p className="mt-1 text-xl font-semibold text-text tabular-nums">
              {formatMoneyRound(impact.treated.retainedMrrCents)}
              <span className="text-sm font-normal text-text-soft"> /mês</span>
            </p>
            <p className="mt-1 text-sm text-text-soft">
              Receita recorrente dos clientes que receberam intervenção e permaneceram. É um fato, mas parte desses
              clientes teria ficado de qualquer forma.
            </p>
          </div>
          <div className="bg-white px-5 py-4">
            <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">Estimativa de efeito</p>
            {impact.enoughData ? (
              <>
                <p className="mt-1 text-xl font-semibold text-text tabular-nums">
                  {formatMoneyRound(impact.estimatedPreservedMrrCents ?? 0)}
                  <span className="text-sm font-normal text-text-soft"> /mês</span>
                </p>
                <p className="mt-1 text-sm text-text-soft">
                  Diferença de {(impact.differencePp ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} pontos
                  percentuais na taxa de cancelamento entre os grupos, aplicada à receita do grupo com intervenção.
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-text-soft">
                Ainda não há amostra suficiente: são necessários pelo menos {MIN_GROUP_SIZE} clientes em cada grupo
                com {FOLLOW_UP_DAYS} dias de acompanhamento ({impact.treated.customers} com intervenção e{" "}
                {impact.comparison.customers} sem).
              </p>
            )}
          </div>
        </div>
        <div className="border-t border-line px-5 py-4">
          <Notice>
            <strong className="font-semibold text-text">Como ler esta comparação.</strong> Os grupos não foram sorteados:
            a equipe escolheu quem atender, e isso pode favorecer ou prejudicar o resultado. A diferença é um indício de
            efeito, não uma prova. Para comprovar impacto, defina antes da intervenção um grupo de controle equivalente
            e acompanhe mais de um ciclo de faturamento. Um cliente que recebeu uma ação e não cancelou nunca é contado
            automaticamente como &quot;recuperado&quot;.
          </Notice>
        </div>
      </Card>

      <Card className="mt-4 overflow-hidden">
        <CardHeader
          title="Resultado por tipo de causa tratada"
          description="Ações concluídas há pelo menos 30 dias. Mostra quais intervenções reduzem o risco e quais não estão gerando resultado."
        />
        {causes.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-text-muted">
            Ainda não há ações concluídas há 30 dias ou mais.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead className="border-b border-line bg-page/60">
                <tr>
                  <th className="th">Causa tratada</th>
                  <th className="th text-right">Ações</th>
                  <th className="th text-right">Clientes</th>
                  <th className="th text-right">Tempo médio</th>
                  <th className="th text-right">Score antes → 3 semanas depois</th>
                  <th className="th text-right">Cancelaram em 45 dias</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {causes.map((c) => (
                  <tr key={c.causeGroup}>
                    <td className="td">
                      <GroupTag group={c.causeGroup} />
                    </td>
                    <td className="td text-right tabular-nums">{formatInt(c.actions)}</td>
                    <td className="td text-right tabular-nums">{formatInt(c.customers)}</td>
                    <td className="td text-right tabular-nums">{hours(c.avgHours)}</td>
                    <td className="td text-right font-medium text-text tabular-nums">
                      {c.avgScoreBefore === null || c.avgScoreAfter === null
                        ? "—"
                        : `${Math.round(c.avgScoreBefore)} → ${Math.round(c.avgScoreAfter)}`}
                    </td>
                    <td className="td text-right tabular-nums">
                      {formatInt(c.cancelled)}
                      <span className="ml-1.5 text-text-muted">{formatPct(c.customers ? c.cancelled / c.customers : 0, 0)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mt-4 overflow-hidden" >
        <CardHeader
          title="O score identifica quem realmente cancela?"
          description="Validação do score contra os cancelamentos voluntários que aconteceram."
          right={
            canManage(user.role) ? (
              <ActionButton action={rebuildHistoryAction} pendingLabel="Reconstruindo…">
                Reconstruir histórico de score
              </ActionButton>
            ) : null
          }
        />
        {!validation.available ? (
          <div className="px-5 py-6">
            <Notice tone="warning">
              {validation.reason} Depois de importar 6 a 12 meses de histórico, use &quot;Reconstruir histórico de
              score&quot; para recalcular o score semana a semana no passado e validá-lo de imediato.
            </Notice>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-px bg-line sm:grid-cols-3">
              <div className="bg-white px-5 py-4">
                <p className="text-sm text-text-soft">Cancelamentos antecipados</p>
                <p className="mt-1 font-display text-3xl font-semibold tracking-tight text-text tabular-nums">
                  {formatPct(validation.recall, 0)}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {validation.flaggedBefore} de {validation.cancellations} clientes que cancelaram estavam em risco alto
                  ou crítico nos {VALIDATION_LOOKBACK_DAYS} dias anteriores
                  {validation.medianLeadDays !== null ? ` (antecedência mediana de ${validation.medianLeadDays} dias)` : ""}.
                </p>
              </div>
              <div className="bg-white px-5 py-4">
                <p className="text-sm text-text-soft">Concentração de risco (lift)</p>
                <p className="mt-1 font-display text-3xl font-semibold tracking-tight text-text tabular-nums">
                  {validation.lift === null ? "—" : `${validation.lift.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}×`}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Clientes sinalizados cancelam {formatPct(validation.priorityRate)} em {VALIDATION_HORIZON_DAYS} dias,
                  contra {formatPct(validation.baseRate)} da base em geral.
                </p>
              </div>
              <div className="bg-white px-5 py-4">
                <p className="text-sm text-text-soft">Volume de alertas</p>
                <p className="mt-1 font-display text-3xl font-semibold tracking-tight text-text tabular-nums">
                  {formatPct(validation.priorityShare)}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Parcela média da base no grupo prioritário. Quanto menor, mais administrável para a equipe.
                </p>
              </div>
            </div>
            <div className="overflow-x-auto border-t border-line">
              <table className="w-full min-w-[560px] border-collapse">
                <thead className="border-b border-line bg-page/60">
                  <tr>
                    <th className="th">Faixa na data da fotografia</th>
                    <th className="th text-right">Clientes avaliados</th>
                    <th className="th text-right">Cancelaram em {VALIDATION_HORIZON_DAYS} dias</th>
                    <th className="th text-right">Taxa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {validation.bands.map((b) => (
                    <tr key={b.band}>
                      <td className="td">
                        <RiskBadge band={b.band} />
                      </td>
                      <td className="td text-right tabular-nums">{formatInt(b.observations)}</td>
                      <td className="td text-right tabular-nums">{formatInt(b.cancellations)}</td>
                      <td className="td text-right font-medium text-text tabular-nums">{formatPct(b.rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-line px-5 py-4">
              <Notice>
                Baseado em {validation.snapshotDates.length} fotografias do score sem sobreposição ({validation.historyDays}{" "}
                dias de histórico). Meta experimental do piloto: antecipar ao menos 60% dos cancelamentos voluntários
                com um volume administrável de alertas. É uma meta a testar com dados reais, não uma promessa. Parte dos
                cancelamentos (mudança de endereço, por exemplo) não deixa sinais prévios, e intervenções bem-sucedidas
                reduzem a taxa observada no grupo sinalizado.
              </Notice>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
