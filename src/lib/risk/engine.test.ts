import { describe, expect, it } from "vitest";
import { DEFAULT_RISK_CONFIG, normalizeRiskConfig } from "./config";
import { bandForScore, computeRisk } from "./engine";
import type { CustomerSignals } from "./types";

const NOW = new Date("2026-06-15T12:00:00Z");
const daysAgo = (d: number, hours = 0) => new Date(NOW.getTime() - d * 86_400_000 - hours * 3_600_000);

const empty = (): CustomerSignals => ({
  activatedAt: daysAgo(900),
  tickets: [],
  events: [],
  invoices: [],
  usage: [],
  retentionActionsCompletedAt: [],
});

const ticket = (category: string, opened: Date, extra: Partial<CustomerSignals["tickets"][number]> = {}) => ({
  category,
  openedAt: opened,
  closedAt: new Date(opened.getTime() + 3_600_000),
  reopenCount: 0,
  csat: null,
  ...extra,
});

describe("computeRisk", () => {
  it("cliente sem sinais tem score zero e risco baixo", () => {
    const r = computeRisk(empty(), NOW, DEFAULT_RISK_CONFIG);
    expect(r.score).toBe(0);
    expect(r.band).toBe("low");
    expect(r.topGroup).toBeNull();
    expect(r.factors).toHaveLength(0);
  });

  it("não conta duas vezes chamados técnicos que pertencem a uma queda já registrada", () => {
    const c = empty();
    c.events = [
      { type: "outage", startedAt: daysAgo(10), durationMinutes: 60 },
      { type: "outage", startedAt: daysAgo(6), durationMinutes: 60 },
      { type: "outage", startedAt: daysAgo(2), durationMinutes: 60 },
    ];
    // Um chamado técnico poucas horas depois de cada queda: é o mesmo incidente.
    c.tickets = [
      ticket("technical", daysAgo(10, -3)),
      ticket("technical", daysAgo(6, -5)),
      ticket("technical", daysAgo(2, -1)),
    ];
    const r = computeRisk(c, NOW, DEFAULT_RISK_CONFIG);
    expect(r.factors.map((f) => f.rule)).toContain("outages_recurring");
    expect(r.factors.map((f) => f.rule)).not.toContain("tickets_volume");
    expect(r.notes.join(" ")).toMatch(/não foram somados/);
    expect(r.score).toBe(25);
  });

  it("conta o volume de chamados quando não há falha de rede associada", () => {
    const c = empty();
    c.tickets = [ticket("technical", daysAgo(12)), ticket("financial", daysAgo(8)), ticket("other", daysAgo(3))];
    const r = computeRisk(c, NOW, DEFAULT_RISK_CONFIG);
    expect(r.factors.map((f) => f.rule)).toEqual(["tickets_volume"]);
    expect(r.score).toBe(20);
  });

  it("sinais financeiros isolados nunca passam do risco baixo", () => {
    const c = empty();
    c.invoices = [
      { dueDate: daysAgo(70), paidAt: daysAgo(55) },
      { dueDate: daysAgo(40), paidAt: daysAgo(30) },
      { dueDate: daysAgo(12), paidAt: null },
    ];
    const r = computeRisk(c, NOW, DEFAULT_RISK_CONFIG);
    expect(r.factors.map((f) => f.rule).sort()).toEqual(["late_payments", "overdue_invoice"]);
    expect(r.groups.financial.raw).toBe(18);
    expect(r.groups.financial.applied).toBe(15);
    expect(r.band).toBe("low");
  });

  it("risco crítico exige convergência de vários grupos de sinais", () => {
    // Cenário do briefing: quedas, chamados, lentidão, atraso e insatisfação em 30 dias.
    const c = empty();
    c.activatedAt = daysAgo(180);
    c.events = [
      { type: "outage", startedAt: daysAgo(25), durationMinutes: 120 },
      { type: "outage", startedAt: daysAgo(14), durationMinutes: 90 },
      { type: "instability", startedAt: daysAgo(4), durationMinutes: 60 },
    ];
    c.tickets = [
      ticket("technical", daysAgo(25, -2), { csat: 2 }),
      ticket("technical", daysAgo(14, -2), { reopenCount: 1 }),
      ticket("speed", daysAgo(9)),
      ticket("speed", daysAgo(7)),
      ticket("complaint", daysAgo(3), { csat: 1 }),
      ticket("technical", daysAgo(20)),
    ];
    c.invoices = [{ dueDate: daysAgo(15), paidAt: null }];
    const r = computeRisk(c, NOW, DEFAULT_RISK_CONFIG);
    expect(r.band).toBe("critical");
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.score).toBeLessThanOrEqual(100);
    const groupsWithSignal = Object.values(r.groups).filter((g) => g.applied > 0).length;
    expect(groupsWithSignal).toBeGreaterThanOrEqual(3);
  });

  it("dois grupos no teto não chegam a crítico", () => {
    const c = empty();
    c.events = [
      { type: "outage", startedAt: daysAgo(20), durationMinutes: 300 },
      { type: "outage", startedAt: daysAgo(10), durationMinutes: 300 },
      { type: "slow_speed", startedAt: daysAgo(8), durationMinutes: 0 },
      { type: "slow_speed", startedAt: daysAgo(5), durationMinutes: 0 },
    ];
    c.tickets = [
      ticket("cancel_request", daysAgo(3)),
      ticket("discount_request", daysAgo(6)),
      ticket("other", daysAgo(9), { csat: 1 }),
    ];
    const r = computeRisk(c, NOW, DEFAULT_RISK_CONFIG);
    expect(r.groups.service.applied).toBe(35);
    expect(r.groups.dissatisfaction.applied).toBe(40);
    expect(r.score).toBe(75);
    expect(r.band).toBe("high");
  });

  it("só considera fatos conhecidos até a data de referência", () => {
    const c = empty();
    c.events = [
      { type: "outage", startedAt: daysAgo(3), durationMinutes: 60 },
      { type: "outage", startedAt: daysAgo(1), durationMinutes: 60 },
    ];
    c.tickets = [ticket("cancel_request", daysAgo(1))];
    const past = computeRisk(c, daysAgo(5), DEFAULT_RISK_CONFIG);
    expect(past.score).toBe(0);
    const present = computeRisk(c, NOW, DEFAULT_RISK_CONFIG);
    expect(present.score).toBe(60);
  });

  it("chamado fechado depois da data de referência conta como aberto naquela data", () => {
    const c = empty();
    c.tickets = [ticket("technical", daysAgo(20), { closedAt: daysAgo(2) })];
    const before = computeRisk(c, daysAgo(10), DEFAULT_RISK_CONFIG);
    expect(before.factors.map((f) => f.rule)).toContain("unresolved_ticket");
    const after = computeRisk(c, NOW, DEFAULT_RISK_CONFIG);
    expect(after.factors.map((f) => f.rule)).not.toContain("unresolved_ticket");
  });

  it("regras desativadas não pontuam", () => {
    const config = normalizeRiskConfig({
      rules: { cancel_intent: { enabled: false, points: 35, threshold: 1 } },
    });
    const c = empty();
    c.tickets = [ticket("cancel_request", daysAgo(2))];
    expect(computeRisk(c, NOW, config).score).toBe(0);
  });
});

describe("uso e engajamento", () => {
  const usoDiario = (deDias: number, ateDias: number, porDia: number) =>
    Array.from({ length: deDias - ateDias + 1 }, (_, k) => ({ day: daysAgo(deDias - k), quantity: porDia }));

  it("aponta queda de uso em relação à média anterior", () => {
    const c = empty();
    // 120 a 31 dias atrás: 1 visita por dia (média de 30 por mês); últimos 30 dias: 10 visitas.
    c.usage = [...usoDiario(120, 31, 1), ...usoDiario(30, 1, 0), ...Array.from({ length: 10 }, (_, k) => ({ day: daysAgo(1 + k * 3), quantity: 1 }))];
    const r = computeRisk(c, NOW, DEFAULT_RISK_CONFIG);
    expect(r.factors.map((f) => f.rule)).toEqual(["usage_drop"]);
    expect(r.factors[0].evidence).toMatch(/caiu 66%/);
    expect(r.score).toBe(25);
  });

  it("aponta ausência de uso e não soma a queda junto", () => {
    const c = empty();
    c.usage = usoDiario(120, 25, 1);
    const r = computeRisk(c, NOW, DEFAULT_RISK_CONFIG);
    expect(r.factors.map((f) => f.rule)).toEqual(["no_usage"]);
    expect(r.factors[0].evidence).toMatch(/há 25 dias/);
    expect(r.groups.engagement.applied).toBe(30);
  });

  it("uso estável não gera sinal e cliente sem dado de uso não é penalizado", () => {
    const c = empty();
    c.usage = usoDiario(120, 1, 1);
    expect(computeRisk(c, NOW, DEFAULT_RISK_CONFIG).score).toBe(0);
    expect(computeRisk(empty(), NOW, DEFAULT_RISK_CONFIG).groups.engagement.applied).toBe(0);
  });

  it("queda de uso com insatisfação e falhas chega a risco crítico", () => {
    const c = empty();
    c.usage = usoDiario(120, 25, 1);
    c.tickets = [ticket("cancel_request", daysAgo(5)), ticket("complaint", daysAgo(9), { csat: 1 })];
    c.events = [
      { type: "outage", startedAt: daysAgo(20), durationMinutes: 60 },
      { type: "outage", startedAt: daysAgo(10), durationMinutes: 60 },
    ];
    const r = computeRisk(c, NOW, DEFAULT_RISK_CONFIG);
    expect(r.band).toBe("critical");
  });
});

describe("configuração", () => {
  it("classifica as faixas pelos limites configurados", () => {
    expect(bandForScore(80, DEFAULT_RISK_CONFIG)).toBe("critical");
    expect(bandForScore(79, DEFAULT_RISK_CONFIG)).toBe("high");
    expect(bandForScore(60, DEFAULT_RISK_CONFIG)).toBe("high");
    expect(bandForScore(30, DEFAULT_RISK_CONFIG)).toBe("moderate");
    expect(bandForScore(29, DEFAULT_RISK_CONFIG)).toBe("low");
  });

  it("normaliza configurações inválidas mantendo a ordem das faixas", () => {
    const c = normalizeRiskConfig({ bands: { critical: 50, high: 70, moderate: 90 }, recentDays: 9999 });
    expect(c.bands.critical).toBe(50);
    expect(c.bands.high).toBeLessThan(c.bands.critical);
    expect(c.bands.moderate).toBeLessThan(c.bands.high);
    expect(c.recentDays).toBe(90);
  });
});
