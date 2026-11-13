export type SignalGroup = "service" | "support" | "financial" | "dissatisfaction" | "relationship";
export type RiskBand = "critical" | "high" | "moderate" | "low";

export type RuleId =
  | "outages_recurring"
  | "downtime_long"
  | "slow_speed"
  | "tickets_volume"
  | "recurring_complaint"
  | "unresolved_ticket"
  | "overdue_invoice"
  | "late_payments"
  | "low_csat"
  | "cancel_intent"
  | "discount_request"
  | "early_tenure"
  | "previous_retention";

export interface RuleConfig {
  enabled: boolean;
  /** Pontos somados ao score quando a regra dispara. */
  points: number;
  /** Limite que dispara a regra (a unidade depende da regra). */
  threshold: number;
}

export interface RiskConfig {
  version: 1;
  /** Janela de observação principal, em dias. */
  recentDays: number;
  /** Um chamado técnico aberto até N horas após uma falha de rede é tratado como o mesmo incidente. */
  incidentLinkHours: number;
  rules: Record<RuleId, RuleConfig>;
  /** Teto de pontos por grupo de sinais: evita que um único tipo de evidência domine o score. */
  groupCaps: Record<SignalGroup, number>;
  /** Pontuação mínima de cada faixa. */
  bands: { critical: number; high: number; moderate: number };
  /** Critérios para apontar concentração regional de problemas. */
  cluster: { minCustomers: number; minSharePct: number };
}

export interface RiskFactor {
  rule: RuleId;
  group: SignalGroup;
  label: string;
  points: number;
  /** Evidência objetiva que disparou a regra (texto exibido ao usuário). */
  evidence: string;
}

export interface RiskResult {
  score: number;
  band: RiskBand;
  topGroup: SignalGroup | null;
  factors: RiskFactor[];
  /** Pontos por grupo antes e depois do teto. */
  groups: Record<SignalGroup, { raw: number; applied: number }>;
  /** Observações de transparência (ex.: chamados não somados para evitar dupla contagem). */
  notes: string[];
}

export interface TicketSignal {
  category: string;
  openedAt: Date;
  closedAt: Date | null;
  reopenCount: number;
  csat: number | null;
}

export interface NetworkEventSignal {
  type: string;
  startedAt: Date;
  durationMinutes: number;
}

export interface InvoiceSignal {
  dueDate: Date;
  paidAt: Date | null;
}

export interface CustomerSignals {
  activatedAt: Date | null;
  tickets: TicketSignal[];
  events: NetworkEventSignal[];
  invoices: InvoiceSignal[];
  /** Datas de conclusão de ações de retenção anteriores que envolveram o cliente. */
  retentionActionsCompletedAt: Date[];
}
