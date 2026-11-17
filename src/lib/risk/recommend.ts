import { segmentOf } from "@/lib/segments";
import type { RiskBand, SignalGroup } from "./types";

export interface Recommendation {
  title: string;
  recommendation: string;
  ownerTeam: string;
  /** Prazo sugerido em horas. */
  slaHours: number;
}

/**
 * Plano de ação sugerido conforme a causa predominante do risco.
 * A recomendação orienta a equipe; a decisão e a execução são sempre humanas.
 */
export function recommendFor(topGroup: SignalGroup | null, band: RiskBand, segment?: string | null): Recommendation {
  const urgent = band === "critical";
  const seg = segmentOf(segment);
  switch (topGroup) {
    case "service":
      return {
        title: seg.id === "provedor" ? "Verificação técnica prioritária" : "Correção prioritária do serviço",
        recommendation: seg.serviceAction,
        ownerTeam: seg.serviceTeam,
        slaHours: urgent ? 24 : 48,
      };
    case "engagement":
      return {
        title: "Contato de reengajamento",
        recommendation: `Entrar em contato para entender por que ${seg.theCustomer} reduziu o uso, ajudar a retomar (orientação, ajuste de plano ou de horário) e registrar o motivo relatado.`,
        ownerTeam: "Relacionamento",
        slaHours: urgent ? 24 : 72,
      };
    case "support":
      return {
        title: "Resolver pendência de atendimento",
        recommendation:
          "Atribuir os chamados em aberto a um atendente sênior, resolver a causa do problema repetido e retornar ao cliente confirmando a solução.",
        ownerTeam: "Atendimento",
        slaHours: urgent ? 24 : 48,
      };
    case "dissatisfaction":
      return {
        title: "Contato humano de retenção",
        recommendation:
          "Ligar para o cliente, ouvir o motivo da insatisfação e tratar a causa antes de oferecer qualquer desconto. Registrar o que o cliente relatou.",
        ownerTeam: "Retenção",
        slaHours: 24,
      };
    case "financial":
      return {
        title: "Contato financeiro consultivo",
        recommendation:
          "Entrar em contato para entender o atraso e oferecer alternativas de pagamento. Não bloquear nem penalizar o cliente com base no score.",
        ownerTeam: "Financeiro",
        slaHours: 72,
      };
    default:
      return {
        title: "Acompanhamento de relacionamento",
        recommendation:
          "Fazer um contato de acompanhamento para confirmar que o serviço está funcionando bem e registrar a percepção do cliente.",
        ownerTeam: "Atendimento",
        slaHours: 72,
      };
  }
}

export function priorityForBand(band: RiskBand): "critical" | "high" | "medium" {
  if (band === "critical") return "critical";
  if (band === "high") return "high";
  return "medium";
}
