import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, gte } from "drizzle-orm";
import { ArrowLeft, ClipboardList, CreditCard, Headset, TriangleAlert, Wifi } from "lucide-react";
import { createCustomerActionAction } from "@/app/actions/retention";
import { getDb, schema } from "@/db/client";
import { ScoreLineChart } from "@/components/charts";
import { SubmitButton } from "@/components/forms";
import { ActionStatusBadge, Card, CardHeader, GroupTag, Notice, RiskBadge, ScoreBar, cn } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { formatDate, formatDateTime, formatMoney, formatShortDate, formatTenure } from "@/lib/format";
import { BAND_GUIDANCE, GROUP_LABELS, GROUP_ORDER } from "@/lib/risk/config";
import { getRiskConfig } from "@/lib/risk/recalculate";
import { recommendFor } from "@/lib/risk/recommend";
import type { RiskBand, SignalGroup } from "@/lib/risk/types";
import { segmentOf } from "@/lib/segments";

export const metadata: Metadata = { title: "Cliente" };

const DAY = 86_400_000;

const TICKET_LABELS: Record<string, string> = {
  technical: "Chamado de suporte",
  speed: "Reclamação de qualidade",
  financial: "Chamado financeiro",
  commercial: "Chamado comercial",
  complaint: "Reclamação",
  discount_request: "Pedido de desconto",
  cancel_request: "Intenção de cancelamento",
  other: "Atendimento",
};

interface TimelineItem {
  at: Date;
  kind: "ticket" | "event" | "invoice" | "action";
  title: string;
  detail: string;
  alert: boolean;
  href?: string;
}

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const seg = segmentOf(user.segment);
  const EVENT_LABELS: Record<string, string> = seg.incidentTypes;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const db = await getDb();
  const [customer] = await db
    .select()
    .from(schema.customers)
    .where(and(eq(schema.customers.id, id), eq(schema.customers.providerId, user.providerId)))
    .limit(1);
  if (!customer) notFound();

  const now = new Date();
  const since = new Date(now.getTime() - 180 * DAY);
  const [config, tickets, events, invoices, actionLinks, snapshots, usage] = await Promise.all([
    getRiskConfig(user.providerId, db),
    db
      .select()
      .from(schema.tickets)
      .where(and(eq(schema.tickets.customerId, id), gte(schema.tickets.openedAt, since)))
      .orderBy(desc(schema.tickets.openedAt)),
    db
      .select()
      .from(schema.networkEvents)
      .where(and(eq(schema.networkEvents.customerId, id), gte(schema.networkEvents.startedAt, since)))
      .orderBy(desc(schema.networkEvents.startedAt)),
    db
      .select()
      .from(schema.invoices)
      .where(and(eq(schema.invoices.customerId, id), gte(schema.invoices.dueDate, since)))
      .orderBy(desc(schema.invoices.dueDate)),
    db
      .select({
        id: schema.actions.id,
        number: schema.actions.number,
        title: schema.actions.title,
        kind: schema.actions.kind,
        status: schema.actions.status,
        createdAt: schema.actions.createdAt,
        completedAt: schema.actions.completedAt,
      })
      .from(schema.actionCustomers)
      .innerJoin(schema.actions, eq(schema.actions.id, schema.actionCustomers.actionId))
      .where(eq(schema.actionCustomers.customerId, id))
      .orderBy(desc(schema.actions.createdAt)),
    db
      .select({ date: schema.riskSnapshots.snapshotDate, score: schema.riskSnapshots.score })
      .from(schema.riskSnapshots)
      .where(eq(schema.riskSnapshots.customerId, id))
      .orderBy(asc(schema.riskSnapshots.snapshotDate)),
    db
      .select({ day: schema.usageRecords.day, quantity: schema.usageRecords.quantity })
      .from(schema.usageRecords)
      .where(and(eq(schema.usageRecords.customerId, id), gte(schema.usageRecords.day, since.toISOString().slice(0, 10)))),
  ]);

  const band = (customer.riskBand ?? null) as RiskBand | null;
  const factors = customer.riskFactors ?? [];
  const notes = customer.riskNotes ?? [];
  const isActive = customer.status !== "cancelled";
  const rec = recommendFor(customer.riskTopGroup as SignalGroup | null, band ?? "low", seg.id);
  const openAction = actionLinks.find((a) => ["pending", "in_progress"].includes(a.status));
  const openIndividual = actionLinks.find((a) => a.kind === "customer" && ["pending", "in_progress"].includes(a.status));
  const lastInteraction = tickets[0]?.openedAt ?? null;

  const groupTotals = GROUP_ORDER.map((group) => {
    const raw = factors.filter((f) => f.group === group).reduce((s, f) => s + f.points, 0);
    return { group, raw, applied: Math.min(raw, config.groupCaps[group]), cap: config.groupCaps[group] };
  }).filter((g) => g.raw > 0);

  const timeline: TimelineItem[] = [];
  for (const t of tickets) {
    const open = t.closedAt === null;
    const bits = [t.subject ?? "", open ? "em aberto" : `resolvido em ${formatShortDate(t.closedAt)}`];
    if (t.reopenCount > 0) bits.push(`reaberto ${t.reopenCount}x`);
    if (t.csat !== null) bits.push(`nota ${t.csat}/5`);
    timeline.push({
      at: t.openedAt,
      kind: "ticket",
      title: TICKET_LABELS[t.category] ?? "Atendimento",
      detail: bits.filter(Boolean).join(" · "),
      alert: ["complaint", "cancel_request"].includes(t.category) || open || (t.csat !== null && t.csat <= 2),
    });
  }
  for (const e of events) {
    timeline.push({
      at: e.startedAt,
      kind: "event",
      title: EVENT_LABELS[e.type] ?? "Falha no serviço",
      detail: e.durationMinutes ? `Duração de ${e.durationMinutes} min` : "",
      alert: e.type !== "slow_speed",
    });
  }
  for (const i of invoices) {
    const lateDays = i.paidAt ? Math.round((i.paidAt.getTime() - i.dueDate.getTime()) / DAY) : null;
    if (i.paidAt && (lateDays ?? 0) <= 3) continue; // faturas pagas em dia não poluem a linha do tempo
    timeline.push({
      at: i.dueDate,
      kind: "invoice",
      title: i.paidAt ? "Fatura paga com atraso" : "Fatura em aberto",
      detail: i.paidAt
        ? `${formatMoney(i.amountCents)} · paga ${lateDays} dias após o vencimento`
        : `${formatMoney(i.amountCents)} · vencida em ${formatDate(i.dueDate)}`,
      alert: !i.paidAt,
    });
  }
  for (const a of actionLinks) {
    timeline.push({
      at: a.createdAt,
      kind: "action",
      title: `Ação preventiva #${a.number}`,
      detail: `${a.title}${a.completedAt ? ` · concluída em ${formatShortDate(a.completedAt)}` : ""}`,
      alert: false,
      href: `/acoes/${a.id}`,
    });
  }
  timeline.sort((a, b) => b.at.getTime() - a.at.getTime());

  const ICONS = { ticket: Headset, event: seg.id === "provedor" ? Wifi : TriangleAlert, invoice: CreditCard, action: ClipboardList };
  const recent = (d: Date) => d.getTime() >= now.getTime() - config.recentDays * DAY;

  return (
    <>
      <Link href="/radar" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-soft hover:text-text">
        <ArrowLeft size={15} aria-hidden="true" /> Radar de risco
      </Link>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-text">{customer.name}</h1>
          <p className="mt-1 text-sm text-text-soft">
            Cód. {customer.externalId} · {customer.planName ?? "Plano não informado"} · {formatMoney(customer.monthlyFeeCents)}/mês
            {customer.region ? ` · ${customer.region}` : ""}
          </p>
          {!isActive ? (
            <p className="mt-2 inline-flex rounded-md bg-page px-2.5 py-1 text-sm font-medium text-text-soft">
              Contrato cancelado em {formatDate(customer.cancelledAt)} (
              {customer.cancelType === "involuntary" ? "involuntário" : "voluntário"}
              {customer.cancelReason ? ` · ${customer.cancelReason}` : ""})
            </p>
          ) : null}
        </div>
        {band && isActive ? (
          <div className="card w-full shrink-0 px-5 py-4 lg:w-80">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-sm text-text-soft">Score de risco</p>
                <p className="font-display text-4xl font-semibold tracking-tight text-text tabular-nums">{customer.riskScore}</p>
              </div>
              <RiskBadge band={band} />
            </div>
            <div className="mt-3">
              <ScoreBar score={customer.riskScore ?? 0} band={band} />
            </div>
            <p className="mt-2 text-xs text-text-muted">
              {BAND_GUIDANCE[band]} · calculado em {formatDateTime(customer.riskUpdatedAt)}
            </p>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Fatores que elevaram o risco"
              description="Cada fator mostra a evidência objetiva que disparou a regra e quantos pontos ela soma."
            />
            {factors.length === 0 ? (
              <p className="px-5 py-8 text-sm text-text-muted">
                Nenhum sinal de risco ativo na janela de observação de {config.recentDays} dias.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {factors.map((f) => (
                  <li key={f.rule} className="flex items-start gap-4 px-5 py-3.5">
                    <span className="mt-0.5 w-12 shrink-0 rounded-md bg-page py-1 text-center text-sm font-semibold text-text tabular-nums">
                      +{f.points}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-text">
                        {f.label} <GroupTag group={f.group} />
                      </p>
                      <p className="mt-0.5 text-sm text-text-soft">{f.evidence}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {groupTotals.length > 0 ? (
              <div className="border-t border-line px-5 py-4">
                <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">Como o score foi composto</p>
                <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                  {groupTotals.map((g) => (
                    <div key={g.group} className="flex justify-between gap-3">
                      <dt className="text-text-soft">{GROUP_LABELS[g.group]}</dt>
                      <dd className="font-medium text-text tabular-nums">
                        {g.applied} pts
                        {g.raw > g.applied ? <span className="font-normal text-text-muted"> (teto de {g.cap})</span> : null}
                      </dd>
                    </div>
                  ))}
                </dl>
                {notes.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-xs text-text-muted">
                    {notes.map((n) => (
                      <li key={n}>• {n}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </Card>

          {isActive ? (
            <Card>
              <CardHeader title="Ação recomendada" description="Sugestão baseada na causa predominante do risco." />
              <div className="px-5 py-4">
                {band === "low" || !band ? (
                  <p className="text-sm text-text-soft">
                    Cliente em monitoramento normal. Nenhuma ação preventiva é necessária no momento.
                  </p>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-text">{rec.title}</p>
                    <p className="mt-1 text-sm text-text-soft">{rec.recommendation}</p>
                    <p className="mt-2 text-xs text-text-muted">
                      Responsável sugerido: {rec.ownerTeam} · prazo sugerido: {rec.slaHours} horas
                    </p>
                  </>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {openAction ? (
                    <Link href={`/acoes/${openAction.id}`} className="btn-secondary">
                      Abrir ação #{openAction.number} <ActionStatusBadge status={openAction.status} />
                    </Link>
                  ) : null}
                  {!openIndividual && band && band !== "low" ? (
                    <form action={createCustomerActionAction}>
                      <input type="hidden" name="customerId" value={customer.id} />
                      <SubmitButton pendingLabel="Criando…">Criar ação preventiva</SubmitButton>
                    </form>
                  ) : null}
                </div>
              </div>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Linha do tempo" description="Eventos relevantes dos últimos 180 dias." />
            {timeline.length === 0 ? (
              <p className="px-5 py-8 text-sm text-text-muted">Nenhum evento registrado no período.</p>
            ) : (
              <ol className="px-5 py-4">
                {timeline.slice(0, 40).map((item, index) => {
                  const Icon = ICONS[item.kind];
                  return (
                    <li key={index} className="relative flex gap-3 pb-4 last:pb-0">
                      {index < Math.min(timeline.length, 40) - 1 ? (
                        <span className="absolute top-8 bottom-0 left-[15px] w-px bg-line" aria-hidden="true" />
                      ) : null}
                      <span
                        className={cn(
                          "z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                          item.kind === "action"
                            ? "border-brand/40 bg-brand-soft text-brand-strong"
                            : item.alert && recent(item.at)
                              ? "border-critical/30 bg-critical-soft text-critical-ink"
                              : "border-line bg-page text-text-soft",
                        )}
                      >
                        <Icon size={15} aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="text-sm font-medium text-text">
                          {item.href ? (
                            <Link href={item.href} className="hover:underline">
                              {item.title}
                            </Link>
                          ) : (
                            item.title
                          )}
                          <span className="ml-2 text-xs font-normal text-text-muted">{formatDateTime(item.at)}</span>
                        </p>
                        {item.detail ? <p className="text-sm text-text-soft">{item.detail}</p> : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            {timeline.length > 40 ? (
              <p className="border-t border-line px-5 py-3 text-xs text-text-muted">
                Mostrando os 40 eventos mais recentes de {timeline.length}.
              </p>
            ) : null}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Dados do contrato" />
            <dl className="divide-y divide-line text-sm">
              {[
                ["Plano", customer.planName ?? "—"],
                ["Mensalidade", formatMoney(customer.monthlyFeeCents)],
                ["Cliente desde", `${formatDate(customer.activatedAt)} (${formatTenure(customer.activatedAt, customer.cancelledAt ?? now)})`],
                [seg.region.charAt(0).toUpperCase() + seg.region.slice(1), customer.region ?? "—"],
                [seg.unit.charAt(0).toUpperCase() + seg.unit.slice(1), customer.cto ?? "—"],
                ["Cidade", customer.city ?? "—"],
                ["Última interação", lastInteraction ? formatDateTime(lastInteraction) : "Sem chamados em 180 dias"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-5 py-2.5">
                  <dt className="text-text-soft">{k}</dt>
                  <dd className="text-right font-medium text-text">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card>
            <CardHeader title={`Últimos ${config.recentDays} dias`} />
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-b-xl border-t border-line bg-line text-center">
              {[
                ["Uso registrado", usage.filter((u) => recent(new Date(u.day + "T12:00:00Z"))).reduce((s, u) => s + u.quantity, 0)],
                ["Chamados", tickets.filter((t) => recent(t.openedAt)).length],
                ["Falhas no serviço", events.filter((e) => recent(e.startedAt)).length],
                ["Faturas em aberto", invoices.filter((i) => !i.paidAt && i.dueDate.getTime() < now.getTime()).length],
              ].map(([label, value]) => (
                <div key={label} className="bg-white px-2 py-4">
                  <p className="text-2xl font-semibold text-text tabular-nums">{value}</p>
                  <p className="text-xs text-text-muted">{label}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Evolução do risco" description="Score do cliente a cada recálculo semanal." />
            <div className="px-3 py-4">
              {snapshots.length > 1 ? (
                <ScoreLineChart
                  seriesName="Score"
                  data={snapshots.map((s) => ({ label: formatShortDate(new Date(s.date + "T12:00:00Z")), value: s.score }))}
                  thresholds={[
                    { value: config.bands.critical, label: "Crítico" },
                    { value: config.bands.high, label: "Alto" },
                  ]}
                />
              ) : (
                <p className="px-2 py-8 text-center text-sm text-text-muted">
                  O histórico aparece após dois ou mais recálculos de risco.
                </p>
              )}
            </div>
          </Card>

          <Notice>
            O score é um apoio à decisão da equipe e pode ser revisado por uma pessoa a qualquer momento. Ele não deve
            ser usado para bloquear, penalizar ou negar atendimento ao cliente (LGPD, art. 20).
          </Notice>
        </div>
      </div>
    </>
  );
}
