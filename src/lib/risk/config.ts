import type { RiskBand, RiskConfig, RuleId, SignalGroup } from "./types";

export const GROUP_LABELS: Record<SignalGroup, string> = {
  service: "Qualidade do serviço",
  support: "Atendimento",
  financial: "Financeiro",
  dissatisfaction: "Insatisfação",
  relationship: "Relacionamento",
};

export const GROUP_ORDER: SignalGroup[] = ["service", "support", "dissatisfaction", "financial", "relationship"];

export const BAND_LABELS: Record<RiskBand, string> = {
  critical: "Crítico",
  high: "Alto",
  moderate: "Moderado",
  low: "Baixo",
};

export const BAND_GUIDANCE: Record<RiskBand, string> = {
  critical: "Intervenção prioritária",
  high: "Ação preventiva recomendada",
  moderate: "Acompanhamento",
  low: "Monitoramento normal",
};

export const BAND_ORDER: RiskBand[] = ["critical", "high", "moderate", "low"];

export interface RuleMeta {
  id: RuleId;
  group: SignalGroup;
  label: string;
  description: string;
  thresholdLabel: string;
}

export const RULES: RuleMeta[] = [
  {
    id: "outages_recurring",
    group: "service",
    label: "Interrupções recorrentes",
    description: "Quedas ou instabilidades de conexão repetidas na janela de observação.",
    thresholdLabel: "Nº mínimo de quedas/instabilidades",
  },
  {
    id: "downtime_long",
    group: "service",
    label: "Tempo fora do ar elevado",
    description: "Soma do tempo de indisponibilidade na janela de observação.",
    thresholdLabel: "Minutos de indisponibilidade",
  },
  {
    id: "slow_speed",
    group: "service",
    label: "Velocidade abaixo do esperado",
    description: "Eventos de lentidão medidos ou reclamações de velocidade (sem contar duas vezes o mesmo incidente).",
    thresholdLabel: "Nº mínimo de ocorrências de lentidão",
  },
  {
    id: "tickets_volume",
    group: "support",
    label: "Volume de chamados",
    description:
      "Chamados abertos na janela, desconsiderando os que pertencem a uma falha de rede já contabilizada.",
    thresholdLabel: "Nº mínimo de chamados",
  },
  {
    id: "recurring_complaint",
    group: "support",
    label: "Reclamação reincidente",
    description: "Chamados reabertos ou reclamações repetidas sobre o mesmo problema.",
    thresholdLabel: "Nº mínimo de reincidências",
  },
  {
    id: "unresolved_ticket",
    group: "support",
    label: "Problema não resolvido",
    description: "Chamado aberto há mais dias do que o limite configurado.",
    thresholdLabel: "Dias em aberto",
  },
  {
    id: "overdue_invoice",
    group: "financial",
    label: "Fatura em atraso",
    description: "Fatura vencida e não paga além da tolerância. Isoladamente não indica intenção de cancelar.",
    thresholdLabel: "Dias de atraso tolerados",
  },
  {
    id: "late_payments",
    group: "financial",
    label: "Pagamentos fora do prazo recorrentes",
    description: "Faturas pagas com atraso nos últimos 90 dias.",
    thresholdLabel: "Nº mínimo de faturas pagas com atraso",
  },
  {
    id: "low_csat",
    group: "dissatisfaction",
    label: "Nota baixa de satisfação",
    description: "Avaliação de atendimento igual ou abaixo do limite nos últimos 60 dias.",
    thresholdLabel: "Nota máxima considerada baixa (1 a 5)",
  },
  {
    id: "cancel_intent",
    group: "dissatisfaction",
    label: "Intenção de cancelamento manifestada",
    description: "O cliente pediu ou mencionou cancelamento nos últimos 60 dias.",
    thresholdLabel: "Nº mínimo de manifestações",
  },
  {
    id: "discount_request",
    group: "dissatisfaction",
    label: "Pedido de desconto",
    description: "Solicitação de desconto ou renegociação de preço nos últimos 60 dias.",
    thresholdLabel: "Nº mínimo de pedidos",
  },
  {
    id: "early_tenure",
    group: "relationship",
    label: "Cliente recente",
    description: "Contrato ainda nos primeiros meses, período em que a relação é menos consolidada.",
    thresholdLabel: "Meses de contrato",
  },
  {
    id: "previous_retention",
    group: "relationship",
    label: "Tentativa anterior de retenção",
    description: "Já houve ação de retenção concluída para o cliente nos últimos 180 dias.",
    thresholdLabel: "Nº mínimo de ações anteriores",
  },
];

export const RULE_META: Record<RuleId, RuleMeta> = Object.fromEntries(RULES.map((r) => [r.id, r])) as Record<
  RuleId,
  RuleMeta
>;

/**
 * Configuração inicial. Os pesos são um ponto de partida ilustrativo e devem ser
 * calibrados com o histórico real de cancelamentos de cada provedor.
 *
 * Propriedades garantidas pelos tetos de grupo:
 *  - sinais financeiros isolados nunca passam da faixa "baixo";
 *  - a faixa "alto" exige ao menos dois grupos de sinais;
 *  - a faixa "crítico" exige a convergência de ao menos três grupos.
 */
export const DEFAULT_RISK_CONFIG: RiskConfig = {
  version: 1,
  recentDays: 30,
  incidentLinkHours: 48,
  rules: {
    outages_recurring: { enabled: true, points: 25, threshold: 2 },
    downtime_long: { enabled: true, points: 10, threshold: 240 },
    slow_speed: { enabled: true, points: 10, threshold: 2 },
    tickets_volume: { enabled: true, points: 20, threshold: 3 },
    recurring_complaint: { enabled: true, points: 20, threshold: 1 },
    unresolved_ticket: { enabled: true, points: 25, threshold: 5 },
    overdue_invoice: { enabled: true, points: 10, threshold: 5 },
    late_payments: { enabled: true, points: 8, threshold: 2 },
    low_csat: { enabled: true, points: 20, threshold: 2 },
    cancel_intent: { enabled: true, points: 35, threshold: 1 },
    discount_request: { enabled: true, points: 10, threshold: 1 },
    early_tenure: { enabled: true, points: 5, threshold: 6 },
    previous_retention: { enabled: true, points: 10, threshold: 1 },
  },
  groupCaps: { service: 35, support: 30, financial: 15, dissatisfaction: 40, relationship: 10 },
  bands: { critical: 80, high: 60, moderate: 30 },
  cluster: { minCustomers: 5, minSharePct: 12 },
};

/** Mescla uma configuração salva com os padrões (tolerante a versões antigas/incompletas). */
export function normalizeRiskConfig(input: unknown): RiskConfig {
  const base = structuredClone(DEFAULT_RISK_CONFIG);
  if (!input || typeof input !== "object") return base;
  const src = input as Partial<RiskConfig>;
  const num = (v: unknown, fallback: number, min: number, max: number) => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  base.recentDays = num(src.recentDays, base.recentDays, 7, 90);
  base.incidentLinkHours = num(src.incidentLinkHours, base.incidentLinkHours, 0, 168);
  for (const rule of RULES) {
    const r = src.rules?.[rule.id];
    if (!r) continue;
    base.rules[rule.id] = {
      enabled: r.enabled !== false,
      points: num(r.points, base.rules[rule.id].points, 0, 100),
      threshold: num(r.threshold, base.rules[rule.id].threshold, 0, 100000),
    };
  }
  for (const group of GROUP_ORDER) {
    base.groupCaps[group] = num(src.groupCaps?.[group], base.groupCaps[group], 0, 100);
  }
  const critical = num(src.bands?.critical, base.bands.critical, 3, 100);
  const high = num(src.bands?.high, base.bands.high, 2, critical - 1);
  const moderate = num(src.bands?.moderate, base.bands.moderate, 1, high - 1);
  base.bands = { critical, high, moderate };
  base.cluster = {
    minCustomers: num(src.cluster?.minCustomers, base.cluster.minCustomers, 2, 10000),
    minSharePct: num(src.cluster?.minSharePct, base.cluster.minSharePct, 1, 100),
  };
  return base;
}
