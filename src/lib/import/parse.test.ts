import { describe, expect, it } from "vitest";
import {
  decodeCsv,
  normalizeCancelType,
  normalizeCustomerStatus,
  normalizeEventType,
  normalizeTicketCategory,
  parseCsv,
  parseDate,
  parseMoneyCents,
} from "./parse";

describe("parseDate", () => {
  it("lê datas brasileiras no horário de Brasília", () => {
    expect(parseDate("02/06/2026 09:15")?.toISOString()).toBe("2026-06-02T12:15:00.000Z");
    expect(parseDate("2/6/2026")?.toISOString()).toBe("2026-06-02T15:00:00.000Z");
  });
  it("lê datas ISO com e sem fuso", () => {
    expect(parseDate("2026-06-02 09:15:00")?.toISOString()).toBe("2026-06-02T12:15:00.000Z");
    expect(parseDate("2026-06-02T09:15:00Z")?.toISOString()).toBe("2026-06-02T09:15:00.000Z");
  });
  it("rejeita valores inválidos", () => {
    expect(parseDate("")).toBeNull();
    expect(parseDate("31/13/2026")).toBeNull();
    expect(parseDate("ontem")).toBeNull();
  });
});

describe("parseMoneyCents", () => {
  it("aceita formatos brasileiro e internacional", () => {
    expect(parseMoneyCents("99,90")).toBe(9990);
    expect(parseMoneyCents("R$ 1.299,90")).toBe(129990);
    expect(parseMoneyCents("99.90")).toBe(9990);
    expect(parseMoneyCents("")).toBeNull();
  });
});

describe("normalização", () => {
  it("classifica chamados pelas palavras do ERP", () => {
    expect(normalizeTicketCategory("Suporte técnico", "Sem conexão")).toBe("technical");
    expect(normalizeTicketCategory("Suporte", "Internet lenta à noite")).toBe("speed");
    expect(normalizeTicketCategory("Retenção", "Solicitação de cancelamento")).toBe("cancel_request");
    expect(normalizeTicketCategory("Comercial", "Pedido de desconto")).toBe("discount_request");
    expect(normalizeTicketCategory("Ouvidoria", "")).toBe("complaint");
    expect(normalizeTicketCategory("Financeiro", "Segunda via de boleto")).toBe("financial");
    expect(normalizeTicketCategory("", "")).toBe("other");
  });
  it("classifica eventos de rede", () => {
    expect(normalizeEventType("Queda")).toBe("outage");
    expect(normalizeEventType("instabilidade")).toBe("instability");
    expect(normalizeEventType("Lentidão")).toBe("slow_speed");
    expect(normalizeEventType("manutenção")).toBeNull();
    // termos de outros segmentos
    expect(normalizeEventType("Aula cancelada")).toBe("outage");
    expect(normalizeEventType("Indisponibilidade")).toBe("outage");
    expect(normalizeEventType("Atraso recorrente")).toBe("instability");
    expect(normalizeEventType("Equipamento parado")).toBe("instability");
    expect(normalizeEventType("Espera acima do esperado")).toBe("slow_speed");
    expect(normalizeEventType("Produto com defeito")).toBe("slow_speed");
  });
  it("deduz status e tipo de cancelamento", () => {
    expect(normalizeCustomerStatus("Ativo", false)).toBe("active");
    expect(normalizeCustomerStatus("Ativo", true)).toBe("cancelled");
    expect(normalizeCustomerStatus("Bloqueado", false)).toBe("suspended");
    expect(normalizeCancelType("", "Inadimplência")).toBe("involuntary");
    expect(normalizeCancelType("voluntario", "Mudança de endereço")).toBe("voluntary");
  });
});

describe("parseCsv", () => {
  it("detecta o separador e mapeia cabeçalhos com acento e sinônimos", () => {
    const uso = parseCsv("Matrícula;Data Check-in\n10;02/06/2026\n", "usage");
    expect(uso.missingRequired).toEqual([]);
    expect(uso.rows[0]).toMatchObject({ customerExternalId: "10", day: "02/06/2026" });
    const generico = parseCsv("id_cliente;nome;unidade;turma\n10;Maria;Centro;Turma A\n", "customers");
    expect(generico.rows[0]).toMatchObject({ region: "Centro", cto: "Turma A" });
    const csv = "Código;Nome do Cliente;Bairro;Valor\n10;Maria;Centro;99,90\n";
    const parsed = parseCsv(csv, "customers");
    expect(parsed.missingRequired).toEqual(["nome"]);
    expect(parsed.unknownHeaders).toContain("nome_do_cliente");
    const ok = parseCsv("id_cliente,nome,bairro,mensalidade\n10,Maria,Centro,99.90\n", "customers");
    expect(ok.missingRequired).toEqual([]);
    expect(ok.rows[0]).toMatchObject({ externalId: "10", name: "Maria", region: "Centro", monthlyFee: "99.90" });
  });
  it("decodifica arquivos em Windows-1252", () => {
    const bytes = new Uint8Array([0x52, 0x65, 0x67, 0x69, 0xe3, 0x6f]); // "Região" em latin-1
    expect(decodeCsv(bytes)).toBe("Região");
  });
});
