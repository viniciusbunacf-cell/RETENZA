import { randomUUID } from "node:crypto";

/**
 * Gerador de dados FICTÍCIOS para demonstração.
 *
 * Simula 56 semanas de operação de um provedor regional: falhas de rede
 * individuais e regionais, chamados, pesquisas de satisfação, faturas,
 * intervenções de retenção e cancelamentos. A probabilidade de cancelamento
 * depende de uma "frustração" latente alimentada pelos mesmos eventos que o
 * motor de risco observa — assim o score tem algo real para detectar, sem que
 * o resultado esteja embutido diretamente nos dados.
 */

const DAY = 86_400_000;
const HOUR = 3_600_000;
const WEEKS = 56;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_NAMES = [
  "Ana", "Bruno", "Carla", "Daniel", "Eduarda", "Felipe", "Gabriela", "Henrique", "Isabela", "João",
  "Karina", "Lucas", "Mariana", "Nelson", "Olívia", "Paulo", "Queila", "Rafael", "Sabrina", "Tiago",
  "Úrsula", "Vinícius", "Wesley", "Yasmin", "Zélia", "André", "Beatriz", "Caio", "Débora", "Elias",
  "Fernanda", "Gustavo", "Helena", "Igor", "Juliana", "Leandro", "Márcia", "Natália", "Otávio", "Patrícia",
  "Renato", "Simone", "Thaís", "Valter", "Aline", "Cristiano", "Denise", "Fábio", "Giovana", "Marcelo",
];
const LAST_NAMES = [
  "Almeida", "Barbosa", "Cardoso", "Dias", "Esteves", "Ferreira", "Gomes", "Lima", "Machado", "Nogueira",
  "Oliveira", "Pereira", "Queiroz", "Ribeiro", "Santos", "Teixeira", "Vieira", "Xavier", "Araújo", "Batista",
  "Campos", "Duarte", "Freitas", "Guimarães", "Lopes", "Martins", "Moraes", "Pinto", "Rocha", "Silva",
  "Souza", "Tavares", "Carvalho", "Correia", "Moreira", "Nunes", "Rezende", "Sales", "Borges", "Farias",
];

const REGIONS = [
  { name: "Centro", code: "CEN", weight: 16, ctos: 4 },
  { name: "Jardim América", code: "JAM", weight: 14, ctos: 3 },
  { name: "Vila Nova", code: "VNO", weight: 12, ctos: 3 },
  { name: "São José", code: "SJO", weight: 11, ctos: 3 },
  { name: "Santa Luzia", code: "SLZ", weight: 10, ctos: 2 },
  { name: "Boa Vista", code: "BVT", weight: 9, ctos: 2 },
  { name: "Parque das Flores", code: "PFL", weight: 9, ctos: 2 },
  { name: "Alto da Colina", code: "ACO", weight: 7, ctos: 2 },
  { name: "Distrito Industrial", code: "DIN", weight: 6, ctos: 2 },
  { name: "Zona Rural Norte", code: "ZRN", weight: 6, ctos: 2 },
];

const PLANS = [
  { name: "Fibra 200 Mega", feeCents: 7990, weight: 30 },
  { name: "Fibra 400 Mega", feeCents: 9990, weight: 38 },
  { name: "Fibra 600 Mega", feeCents: 11990, weight: 22 },
  { name: "Fibra 1 Giga", feeCents: 14990, weight: 10 },
];

/** Falhas regionais: há quantos dias ocorreram e quais CTOs foram afetadas. */
const REGIONAL_INCIDENTS: { daysAgo: number; ctos: string[]; type: "outage" | "instability" }[] = [
  // Vila Nova: sequência de falhas há ~5 meses, corrigida por uma ação regional.
  ...[152, 146, 139, 133].map((daysAgo) => ({
    daysAgo,
    ctos: ["CTO-VNO-01", "CTO-VNO-02"],
    type: "outage" as const,
  })),
  // Centro: problema em andamento (concentração atual).
  ...[33, 22, 12, 5].map((daysAgo) => ({
    daysAgo,
    ctos: ["CTO-CEN-01", "CTO-CEN-02"],
    type: "outage" as const,
  })),
  // Zona Rural Norte: instabilidade recente em uma CTO.
  ...[23, 15, 6].map((daysAgo) => ({ daysAgo, ctos: ["CTO-ZRN-01"], type: "instability" as const })),
  // Sequências menores, já superadas, em outras regiões ao longo do ano.
  ...[262, 255, 249].map((daysAgo) => ({ daysAgo, ctos: ["CTO-SJO-02"], type: "outage" as const })),
  ...[214, 206, 199].map((daysAgo) => ({ daysAgo, ctos: ["CTO-JAM-01"], type: "outage" as const })),
  ...[104, 97, 90].map((daysAgo) => ({ daysAgo, ctos: ["CTO-BVT-01"], type: "instability" as const })),
  ...[74, 66, 59].map((daysAgo) => ({ daysAgo, ctos: ["CTO-PFL-02"], type: "outage" as const })),
];

/** Correção regional histórica (vira uma ação regional concluída). */
const REGIONAL_FIX = { region: "Vila Nova", createdDaysAgo: 131, completedDaysAgo: 124 };

export interface DemoCustomer {
  id: string;
  externalId: string;
  name: string;
  planName: string;
  monthlyFeeCents: number;
  status: "active" | "cancelled";
  activatedAt: Date;
  cancelledAt: Date | null;
  cancelType: "voluntary" | "involuntary" | null;
  cancelReason: string | null;
  city: string;
  region: string;
  cto: string;
}
export interface DemoTicket {
  id: string;
  customerId: string;
  externalId: string;
  category: string;
  subject: string;
  openedAt: Date;
  closedAt: Date | null;
  reopenCount: number;
  csat: number | null;
}
export interface DemoEvent {
  id: string;
  customerId: string;
  externalId: string;
  type: string;
  startedAt: Date;
  durationMinutes: number;
}
export interface DemoInvoice {
  id: string;
  customerId: string;
  externalId: string;
  dueDate: Date;
  paidAt: Date | null;
  amountCents: number;
}
export interface DemoIntervention {
  customerId: string;
  customerName: string;
  region: string;
  cause: "service" | "support" | "dissatisfaction";
  createdAt: Date;
  completedAt: Date;
}
export interface DemoData {
  city: string;
  customers: DemoCustomer[];
  tickets: DemoTicket[];
  events: DemoEvent[];
  invoices: DemoInvoice[];
  interventions: DemoIntervention[];
  regionalFix: { region: string; createdAt: Date; completedAt: Date; customerIds: string[] };
}

const SUBJECTS: Record<string, string[]> = {
  technical: ["Sem conexão", "Conexão caindo", "Sinal instável", "Roteador reiniciando"],
  speed: ["Internet lenta", "Velocidade abaixo do contratado", "Lentidão à noite"],
  financial: ["Segunda via de boleto", "Dúvida sobre fatura", "Alteração de vencimento"],
  commercial: ["Mudança de plano", "Mudança de endereço", "Informações sobre upgrade"],
  other: ["Troca de senha do Wi-Fi", "Dúvida sobre equipamento", "Atualização cadastral"],
  complaint: ["Reclamação: problema recorrente", "Reclamação sobre atendimento", "Reclamação: promessa não cumprida"],
  discount_request: ["Pedido de desconto", "Solicitação de renegociação de valor"],
  cancel_request: ["Solicitação de cancelamento", "Cliente informou intenção de cancelar"],
};

export function generateDemoData(now: Date = new Date(), customerCount = 1800, seed = 20260115): DemoData {
  const rnd = mulberry32(seed);
  const pick = <T,>(items: T[]) => items[Math.floor(rnd() * items.length)];
  const weighted = <T extends { weight: number }>(items: T[]): T => {
    const total = items.reduce((s, i) => s + i.weight, 0);
    let r = rnd() * total;
    for (const item of items) {
      r -= item.weight;
      if (r <= 0) return item;
    }
    return items[items.length - 1];
  };

  const nowMs = now.getTime();
  const simStart = nowMs - WEEKS * 7 * DAY;
  const fixMs = nowMs - REGIONAL_FIX.completedDaysAgo * DAY;

  const customers: DemoCustomer[] = [];
  const tickets: DemoTicket[] = [];
  const events: DemoEvent[] = [];
  const invoices: DemoInvoice[] = [];
  const interventions: DemoIntervention[] = [];
  const fixCustomerIds: string[] = [];
  let ticketSeq = 50_000;
  let eventSeq = 1;
  let invoiceSeq = 700_000;

  const addTicket = (
    customerId: string,
    category: string,
    openedMs: number,
    durationMs: number,
    reopenCount: number,
    csat: number | null,
  ) => {
    if (openedMs > nowMs) return;
    const closedMs = openedMs + durationMs;
    const closed = closedMs <= nowMs;
    tickets.push({
      id: randomUUID(),
      customerId,
      externalId: "CH-" + ticketSeq++,
      category,
      subject: pick(SUBJECTS[category] ?? SUBJECTS.other),
      openedAt: new Date(openedMs),
      closedAt: closed ? new Date(closedMs) : null,
      reopenCount,
      csat: closed ? csat : null,
    });
  };

  for (let i = 0; i < customerCount; i++) {
    const id = randomUUID();
    const region = weighted(REGIONS);
    const cto = "CTO-" + region.code + "-" + String(1 + Math.floor(rnd() * region.ctos)).padStart(2, "0");
    const plan = weighted(PLANS);
    const name = pick(FIRST_NAMES) + " " + pick(LAST_NAMES) + " " + pick(LAST_NAMES);

    // 72% já eram clientes no início da simulação; o restante entrou durante o período.
    const activatedMs =
      rnd() < 0.72 ? simStart - rnd() * 5 * 365 * DAY - 20 * DAY : simStart + rnd() * (WEEKS * 7 - 10) * DAY;

    const payRoll = rnd();
    const pay =
      payRoll < 0.75
        ? { late: 0.03, defaultProb: 0.012 }
        : payRoll < 0.93
          ? { late: 0.25, defaultProb: 0.08 }
          : { late: 0.6, defaultProb: 0.35 };
    const lineRoll = rnd();
    const techRate = lineRoll < 0.8 ? 0.006 : lineRoll < 0.94 ? 0.035 : 0.12;
    const dueDay = pick([5, 10, 15, 20]);

    // Inadimplência definitiva (gera cancelamento involuntário ~65 dias depois).
    const defaults = rnd() < pay.defaultProb;
    const stopPayingMs = defaults ? Math.max(activatedMs + 40 * DAY, simStart + rnd() * WEEKS * 7 * DAY) : null;
    const involuntaryAtMs = stopPayingMs !== null ? stopPayingMs + (60 + rnd() * 15) * DAY : null;

    let frustration = 0;
    let intentUntilWeek = -1;
    let intentSinceWeek = -1;
    let lastTreatedWeek = -99;
    let hadLongTicket = false;
    let hitByFixedIncident = false;
    let fixApplied = false;
    let cancelledAtMs: number | null = null;
    let cancelType: "voluntary" | "involuntary" | null = null;
    let cancelReason: string | null = null;
    const frustrationByWeek: number[] = [];

    for (let w = 0; w < WEEKS; w++) {
      const weekStart = simStart + w * 7 * DAY;
      const weekEnd = weekStart + 7 * DAY;
      frustrationByWeek[w] = frustration;
      if (activatedMs >= weekEnd) continue;
      if (involuntaryAtMs !== null && involuntaryAtMs < weekEnd && involuntaryAtMs <= nowMs) {
        cancelledAtMs = involuntaryAtMs;
        cancelType = "involuntary";
        cancelReason = "Inadimplência";
        break;
      }
      frustration *= 0.88;

      // Correção regional histórica reduz a frustração de quem foi afetado.
      if (!fixApplied && fixMs >= weekStart && fixMs < weekEnd && region.name === REGIONAL_FIX.region) {
        fixApplied = true;
        if (hitByFixedIncident) {
          frustration *= 0.4;
          fixCustomerIds.push(id);
        }
      }

      // ---- Falhas de rede da semana ----
      const weekEvents: { type: string; at: number; duration: number }[] = [];
      for (const inc of REGIONAL_INCIDENTS) {
        const at = nowMs - inc.daysAgo * DAY + (rnd() - 0.5) * 2 * HOUR;
        if (at < weekStart || at >= weekEnd || !inc.ctos.includes(cto)) continue;
        if (rnd() < 0.85) {
          weekEvents.push({ type: inc.type, at, duration: Math.round(60 + rnd() * 300) });
          if (region.name === REGIONAL_FIX.region && inc.daysAgo > REGIONAL_FIX.completedDaysAgo) {
            hitByFixedIncident = true;
          }
        }
      }
      if (rnd() < techRate) {
        const roll = rnd();
        const type = roll < 0.4 ? "outage" : roll < 0.75 ? "instability" : "slow_speed";
        weekEvents.push({
          type,
          at: weekStart + rnd() * 7 * DAY,
          duration: type === "slow_speed" ? 0 : Math.round(20 + rnd() * 240),
        });
      }
      for (const ev of weekEvents) {
        if (ev.at > nowMs || ev.at < activatedMs) continue;
        events.push({
          id: randomUUID(),
          customerId: id,
          externalId: "EV-" + eventSeq++,
          type: ev.type,
          startedAt: new Date(ev.at),
          durationMinutes: ev.duration,
        });
        frustration += ev.type === "outage" ? 1 : ev.type === "instability" ? 0.7 : 0.6;
        if (rnd() < 0.55) {
          const long = rnd() < 0.12;
          const reopened = rnd() < 0.15;
          if (long) {
            frustration += 1.4;
            hadLongTicket = true;
          }
          if (reopened) frustration += 0.8;
          let csat: number | null = null;
          if (rnd() < 0.35) {
            csat = frustration > 3 ? 1 + Math.floor(rnd() * 2) : frustration > 1.5 ? 2 + Math.floor(rnd() * 2) : 4 + Math.floor(rnd() * 2);
          }
          addTicket(
            id,
            ev.type === "slow_speed" ? "speed" : "technical",
            ev.at + rnd() * 30 * HOUR,
            long ? (7 + rnd() * 18) * DAY : (2 + rnd() * 46) * HOUR,
            reopened ? 1 : 0,
            csat,
          );
        }
      }

      // ---- Outros contatos ----
      if (rnd() < 0.012) {
        addTicket(
          id,
          pick(["financial", "commercial", "other"]),
          weekStart + rnd() * 7 * DAY,
          (1 + rnd() * 20) * HOUR,
          0,
          rnd() < 0.3 ? 4 + Math.floor(rnd() * 2) : null,
        );
      }
      if (frustration > 2.5 && rnd() < 0.25) {
        frustration += 0.3;
        addTicket(
          id,
          "complaint",
          weekStart + rnd() * 7 * DAY,
          (4 + rnd() * 60) * HOUR,
          0,
          rnd() < 0.4 ? 1 + Math.floor(rnd() * 2) : null,
        );
      }
      if ((frustration > 2 && rnd() < 0.07) || rnd() < 0.0015) {
        addTicket(id, "discount_request", weekStart + rnd() * 7 * DAY, (2 + rnd() * 30) * HOUR, 0, null);
      }
      if (frustration > 3 && rnd() < 0.3) {
        if (w >= intentUntilWeek) intentSinceWeek = w;
        intentUntilWeek = w + 5;
        addTicket(id, "cancel_request", weekStart + rnd() * 7 * DAY, (2 + rnd() * 48) * HOUR, 0, null);
      }

      // ---- Intervenções de retenção históricas (apenas parte dos clientes em risco) ----
      const weeksAgo = WEEKS - w;
      if (weeksAgo >= 3 && weeksAgo <= 22 && frustration > 2.5 && w - lastTreatedWeek > 8 && rnd() < 0.2) {
        lastTreatedWeek = w;
        const createdMs = weekStart + (2 + rnd() * 4) * DAY;
        const completedMs = createdMs + (0.3 + rnd() * 2.3) * DAY;
        if (completedMs < nowMs) {
          interventions.push({
            customerId: id,
            customerName: name,
            region: region.name,
            cause: w < intentUntilWeek ? "dissatisfaction" : hadLongTicket ? "support" : "service",
            createdAt: new Date(createdMs),
            completedAt: new Date(completedMs),
          });
          frustration *= 0.35;
          if (rnd() < 0.8) intentUntilWeek = -1;
        }
      }

      // ---- Cancelamento voluntário ----
      const hazard = 0.001 + 0.006 * Math.max(0, frustration - 2) + (w < intentUntilWeek && w > intentSinceWeek ? 0.2 : 0);
      if (rnd() < Math.min(0.6, hazard)) {
        const at = Math.min(weekEnd - rnd() * DAY, nowMs - HOUR);
        if (at > activatedMs + 20 * DAY) {
          cancelledAtMs = at;
          cancelType = "voluntary";
          cancelReason =
            frustration > 2.5
              ? pick(["Problemas de conexão", "Problemas de conexão", "Insatisfação com o atendimento"])
              : pick(["Mudança de endereço", "Preço / oferta da concorrência", "Não informado"]);
          break;
        }
      }
    }

    // ---- Faturas dos últimos 12 meses ----
    const endMs = cancelledAtMs ?? nowMs;
    const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, dueDay, 15));
    for (let m = 0; m < 13; m++) {
      const dueMs = Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + m, dueDay, 15);
      if (dueMs > endMs || dueMs > nowMs || dueMs < activatedMs + 20 * DAY) continue;
      const week = Math.min(WEEKS - 1, Math.max(0, Math.floor((dueMs - simStart) / (7 * DAY))));
      let paidMs: number | null;
      if (stopPayingMs !== null && dueMs >= stopPayingMs) {
        paidMs = null;
      } else if (rnd() < pay.late + ((frustrationByWeek[week] ?? 0) > 3 ? 0.15 : 0)) {
        paidMs = dueMs + (4 + rnd() * 21) * DAY;
      } else {
        paidMs = dueMs - rnd() * 3 * DAY;
      }
      if (paidMs !== null && paidMs > nowMs) paidMs = null;
      if (paidMs !== null && cancelledAtMs !== null && paidMs > cancelledAtMs) paidMs = null;
      invoices.push({
        id: randomUUID(),
        customerId: id,
        externalId: "FAT-" + invoiceSeq++,
        dueDate: new Date(dueMs),
        paidAt: paidMs === null ? null : new Date(paidMs),
        amountCents: plan.feeCents,
      });
    }

    customers.push({
      id,
      externalId: String(10_000 + i),
      name,
      planName: plan.name,
      monthlyFeeCents: plan.feeCents,
      status: cancelledAtMs === null ? "active" : "cancelled",
      activatedAt: new Date(activatedMs),
      cancelledAt: cancelledAtMs === null ? null : new Date(cancelledAtMs),
      cancelType,
      cancelReason,
      city: "Serra Azul",
      region: region.name,
      cto,
    });
  }

  // Remove fatos posteriores ao cancelamento (a simulação semanal pode gerá-los na mesma semana).
  const cancelledAt = new Map(customers.filter((c) => c.cancelledAt).map((c) => [c.id, c.cancelledAt!.getTime()]));
  const beforeCancel = (customerId: string, at: Date) => {
    const limit = cancelledAt.get(customerId);
    return limit === undefined || at.getTime() <= limit;
  };

  return {
    city: "Serra Azul",
    customers,
    tickets: tickets.filter((t) => beforeCancel(t.customerId, t.openedAt)),
    events: events.filter((e) => beforeCancel(e.customerId, e.startedAt)),
    invoices,
    interventions: interventions.filter((i) => beforeCancel(i.customerId, i.completedAt)),
    regionalFix: {
      region: REGIONAL_FIX.region,
      createdAt: new Date(nowMs - REGIONAL_FIX.createdDaysAgo * DAY),
      completedAt: new Date(fixMs),
      customerIds: fixCustomerIds,
    },
  };
}
