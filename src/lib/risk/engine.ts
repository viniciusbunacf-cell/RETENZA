import { GROUP_ORDER, RULE_META } from "./config";
import type {
  CustomerSignals,
  RiskBand,
  RiskConfig,
  RiskFactor,
  RiskResult,
  RuleId,
  SignalGroup,
} from "./types";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const TECHNICAL_CATEGORIES = new Set(["technical", "speed"]);
/** Categorias que alimentam o grupo "insatisfação" e por isso não entram em "volume de chamados". */
const DISSATISFACTION_CATEGORIES = new Set(["cancel_request", "discount_request"]);

function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

export function bandForScore(score: number, config: RiskConfig): RiskBand {
  if (score >= config.bands.critical) return "critical";
  if (score >= config.bands.high) return "high";
  if (score >= config.bands.moderate) return "moderate";
  return "low";
}

/**
 * Calcula o score de risco de um cliente em uma data de referência.
 *
 * Função pura: só considera fatos conhecidos até `asOf`, o que permite recalcular
 * o score em datas passadas para validar o modelo contra cancelamentos reais.
 *
 * Cuidados contra dupla contagem:
 *  - chamados técnicos abertos logo após uma falha de rede do próprio cliente são
 *    tratados como o mesmo incidente e não somam em "volume de chamados";
 *  - pedidos de cancelamento/desconto contam apenas no grupo "insatisfação";
 *  - cada grupo de sinais tem um teto de pontos.
 */
export function computeRisk(input: CustomerSignals, asOf: Date, config: RiskConfig): RiskResult {
  const now = asOf.getTime();
  const recentStart = now - config.recentDays * DAY;
  const d60 = now - 60 * DAY;
  const d90 = now - 90 * DAY;
  const d180 = now - 180 * DAY;
  const linkMs = config.incidentLinkHours * HOUR;

  const factors: RiskFactor[] = [];
  const notes: string[] = [];

  const add = (rule: RuleId, evidence: string) => {
    const rc = config.rules[rule];
    if (!rc?.enabled || rc.points <= 0) return;
    const meta = RULE_META[rule];
    factors.push({ rule, group: meta.group, label: meta.label, points: rc.points, evidence });
  };
  const th = (rule: RuleId) => config.rules[rule].threshold;

  // ---------- Fatos conhecidos até a data de referência ----------
  const events = input.events.filter((e) => e.startedAt.getTime() <= now);
  const tickets = input.tickets.filter((t) => t.openedAt.getTime() <= now);
  const invoices = input.invoices.filter((i) => i.dueDate.getTime() <= now);

  const recentEvents = events.filter((e) => e.startedAt.getTime() >= recentStart);
  const recentTickets = tickets.filter((t) => t.openedAt.getTime() >= recentStart);

  // ---------- Qualidade do serviço ----------
  const outages = recentEvents.filter((e) => e.type === "outage" || e.type === "instability");
  if (outages.length >= th("outages_recurring") && outages.length > 0) {
    add(
      "outages_recurring",
      `${plural(outages.length, "queda/instabilidade", "quedas/instabilidades")} de conexão nos últimos ${config.recentDays} dias.`,
    );
  }
  const downtime = outages.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);
  if (downtime >= th("downtime_long") && downtime > 0) {
    const hours = Math.round((downtime / 60) * 10) / 10;
    add(
      "downtime_long",
      `${hours.toLocaleString("pt-BR")} h de indisponibilidade acumulada nos últimos ${config.recentDays} dias.`,
    );
  }

  // Um chamado técnico pertence a um incidente quando foi aberto logo após (ou
  // pouco antes de) uma falha de rede registrada para o mesmo cliente.
  const isLinkedToIncident = (openedAt: number, kinds: (type: string) => boolean) =>
    events.some((e) => {
      if (!kinds(e.type)) return false;
      const start = e.startedAt.getTime();
      return openedAt >= start - 2 * HOUR && openedAt <= start + linkMs;
    });

  const slowEvents = recentEvents.filter((e) => e.type === "slow_speed");
  const speedTickets = recentTickets.filter((t) => t.category === "speed");
  const unlinkedSpeedTickets = speedTickets.filter(
    (t) => !isLinkedToIncident(t.openedAt.getTime(), (type) => type === "slow_speed"),
  );
  const slowCount = slowEvents.length + unlinkedSpeedTickets.length;
  if (slowCount >= th("slow_speed") && slowCount > 0) {
    const parts: string[] = [];
    if (slowEvents.length) parts.push(plural(slowEvents.length, "medição de lentidão", "medições de lentidão"));
    if (unlinkedSpeedTickets.length)
      parts.push(plural(unlinkedSpeedTickets.length, "reclamação de velocidade", "reclamações de velocidade"));
    add("slow_speed", `${parts.join(" e ")} nos últimos ${config.recentDays} dias.`);
  }

  // ---------- Atendimento ----------
  let linkedCount = 0;
  const countable = recentTickets.filter((t) => {
    if (DISSATISFACTION_CATEGORIES.has(t.category)) return false;
    if (TECHNICAL_CATEGORIES.has(t.category) && isLinkedToIncident(t.openedAt.getTime(), () => true)) {
      linkedCount += 1;
      return false;
    }
    return true;
  });
  if (linkedCount > 0) {
    notes.push(
      `${plural(linkedCount, "chamado técnico não foi somado", "chamados técnicos não foram somados")} em "Volume de chamados" por pertencer a falhas de rede já contabilizadas em "Qualidade do serviço".`,
    );
  }
  if (countable.length >= th("tickets_volume") && countable.length > 0) {
    add(
      "tickets_volume",
      `${plural(countable.length, "chamado aberto", "chamados abertos")} nos últimos ${config.recentDays} dias (além dos ligados a falhas de rede).`,
    );
  }

  const reopened = tickets
    .filter((t) => t.openedAt.getTime() >= d60)
    .reduce((sum, t) => sum + (t.reopenCount || 0), 0);
  const complaints = recentTickets.filter((t) => t.category === "complaint").length;
  const recurrences = reopened + Math.max(0, complaints - 1);
  if (recurrences >= th("recurring_complaint") && recurrences > 0) {
    const parts: string[] = [];
    if (reopened) parts.push(plural(reopened, "reabertura de chamado", "reaberturas de chamado"));
    if (complaints > 1) parts.push(`${complaints} reclamações formais`);
    add("recurring_complaint", `${parts.join(" e ")} no período recente.`);
  }

  const openTickets = tickets.filter(
    (t) =>
      !DISSATISFACTION_CATEGORIES.has(t.category) &&
      (t.closedAt === null || t.closedAt.getTime() > now) &&
      t.openedAt.getTime() >= d180,
  );
  const oldestOpen = openTickets.reduce((max, t) => Math.max(max, (now - t.openedAt.getTime()) / DAY), 0);
  if (openTickets.length > 0 && oldestOpen > th("unresolved_ticket")) {
    add(
      "unresolved_ticket",
      `${plural(openTickets.length, "chamado sem solução", "chamados sem solução")}, o mais antigo aberto há ${Math.floor(oldestOpen)} dias.`,
    );
  }

  // ---------- Financeiro ----------
  const unpaid = invoices.filter((i) => i.paidAt === null || i.paidAt.getTime() > now);
  const maxOverdue = unpaid.reduce((max, i) => Math.max(max, (now - i.dueDate.getTime()) / DAY), 0);
  if (unpaid.length > 0 && maxOverdue > th("overdue_invoice")) {
    add(
      "overdue_invoice",
      `${plural(unpaid.length, "fatura vencida", "faturas vencidas")}, a mais antiga com ${Math.floor(maxOverdue)} dias de atraso.`,
    );
  }
  const paidLate = invoices.filter(
    (i) =>
      i.dueDate.getTime() >= d90 &&
      i.paidAt !== null &&
      i.paidAt.getTime() <= now &&
      i.paidAt.getTime() - i.dueDate.getTime() > 3 * DAY,
  );
  if (paidLate.length >= th("late_payments") && paidLate.length > 0) {
    add("late_payments", `${paidLate.length} faturas pagas com atraso nos últimos 90 dias.`);
  }

  // ---------- Insatisfação ----------
  const lowCsat = tickets.filter(
    (t) =>
      t.csat !== null &&
      t.csat <= th("low_csat") &&
      (t.closedAt ?? t.openedAt).getTime() >= d60 &&
      (t.closedAt ?? t.openedAt).getTime() <= now,
  );
  if (lowCsat.length > 0) {
    const worst = Math.min(...lowCsat.map((t) => t.csat as number));
    add(
      "low_csat",
      `${plural(lowCsat.length, "avaliação de atendimento baixa", "avaliações de atendimento baixas")} nos últimos 60 dias (pior nota: ${worst} de 5).`,
    );
  }
  const cancelRequests = tickets.filter((t) => t.category === "cancel_request" && t.openedAt.getTime() >= d60);
  if (cancelRequests.length >= th("cancel_intent") && cancelRequests.length > 0) {
    add(
      "cancel_intent",
      `${plural(cancelRequests.length, "manifestação de intenção de cancelar", "manifestações de intenção de cancelar")} nos últimos 60 dias.`,
    );
  }
  const discountRequests = tickets.filter(
    (t) => t.category === "discount_request" && t.openedAt.getTime() >= d60,
  );
  if (discountRequests.length >= th("discount_request") && discountRequests.length > 0) {
    add(
      "discount_request",
      `${plural(discountRequests.length, "pedido de desconto", "pedidos de desconto")} nos últimos 60 dias.`,
    );
  }

  // ---------- Relacionamento ----------
  if (input.activatedAt && input.activatedAt.getTime() <= now) {
    const months = (now - input.activatedAt.getTime()) / (30.44 * DAY);
    if (months < th("early_tenure")) {
      add("early_tenure", `Cliente há ${Math.max(0, Math.floor(months))} meses (menos de ${th("early_tenure")}).`);
    }
  }
  const pastRetention = input.retentionActionsCompletedAt.filter((d) => d.getTime() >= d180 && d.getTime() <= now);
  if (pastRetention.length >= th("previous_retention") && pastRetention.length > 0) {
    add(
      "previous_retention",
      `${plural(pastRetention.length, "ação de retenção concluída", "ações de retenção concluídas")} nos últimos 180 dias.`,
    );
  }

  // ---------- Consolidação com teto por grupo ----------
  const groups = Object.fromEntries(GROUP_ORDER.map((gName) => [gName, { raw: 0, applied: 0 }])) as Record<
    SignalGroup,
    { raw: number; applied: number }
  >;
  for (const f of factors) groups[f.group].raw += f.points;
  let total = 0;
  let topGroup: SignalGroup | null = null;
  for (const gName of GROUP_ORDER) {
    const grp = groups[gName];
    grp.applied = Math.min(grp.raw, config.groupCaps[gName]);
    total += grp.applied;
    if (grp.applied > 0 && (topGroup === null || grp.applied > groups[topGroup].applied)) topGroup = gName;
    if (grp.raw > grp.applied) {
      notes.push(
        `Os sinais do grupo "${groupLabel(gName)}" somariam ${grp.raw} pontos, mas o grupo é limitado a ${config.groupCaps[gName]} para não dominar o score.`,
      );
    }
  }
  const score = Math.max(0, Math.min(100, Math.round(total)));
  factors.sort((a, b) => b.points - a.points);

  return { score, band: bandForScore(score, config), topGroup, factors, groups, notes };
}

function groupLabel(group: SignalGroup): string {
  switch (group) {
    case "service":
      return "Qualidade do serviço";
    case "support":
      return "Atendimento";
    case "financial":
      return "Financeiro";
    case "dissatisfaction":
      return "Insatisfação";
    default:
      return "Relacionamento";
  }
}
