import Papa from "papaparse";

export type ImportKind = "customers" | "tickets" | "events" | "usage" | "invoices";

export const IMPORT_KINDS: { kind: ImportKind; label: string; description: string; template: string }[] = [
  {
    kind: "customers",
    label: "Clientes e cancelamentos",
    description: "Base de clientes, incluindo os que cancelaram nos últimos 6 a 12 meses.",
    template: "/modelos/clientes.csv",
  },
  {
    kind: "tickets",
    label: "Chamados de atendimento",
    description: "Histórico de chamados, reclamações, pedidos de cancelamento e notas de satisfação.",
    template: "/modelos/chamados.csv",
  },
  {
    kind: "events",
    label: "Falhas no serviço",
    description: "Interrupções, problemas recorrentes e queda de qualidade que afetaram cada cliente.",
    template: "/modelos/falhas.csv",
  },
  {
    kind: "usage",
    label: "Uso do serviço",
    description: "Visitas, aulas, acessos, consultas ou pedidos de cada cliente. Alimenta o sinal de queda de uso.",
    template: "/modelos/uso.csv",
  },
  {
    kind: "invoices",
    label: "Faturas",
    description: "Vencimentos e pagamentos, para identificar atrasos.",
    template: "/modelos/faturas.csv",
  },
];

export interface FieldSpec {
  field: string;
  header: string;
  required: boolean;
  description: string;
  aliases: string[];
}

export const FIELD_SPECS: Record<ImportKind, FieldSpec[]> = {
  customers: [
    { field: "externalId", header: "id_cliente", required: true, description: "Código do cliente no seu sistema", aliases: ["id", "codigo", "codigo_cliente", "cliente_id", "id_assinante", "id_aluno", "matricula", "id_paciente", "id_conta"] },
    { field: "name", header: "nome", required: true, description: "Nome do cliente", aliases: ["cliente", "nome_cliente", "razao_social", "assinante", "aluno", "paciente", "nome_aluno", "nome_paciente", "conta"] },
    { field: "planName", header: "plano", required: false, description: "Plano contratado", aliases: ["nome_plano", "produto"] },
    { field: "monthlyFee", header: "mensalidade", required: false, description: "Valor mensal (ex.: 99,90)", aliases: ["valor", "valor_plano", "valor_mensal", "preco"] },
    { field: "status", header: "status", required: false, description: "ativo, suspenso ou cancelado", aliases: ["situacao", "status_contrato"] },
    { field: "activatedAt", header: "data_ativacao", required: false, description: "Data de início do contrato", aliases: ["ativacao", "data_instalacao", "data_contrato", "data_cadastro", "inicio_contrato"] },
    { field: "cancelledAt", header: "data_cancelamento", required: false, description: "Data do cancelamento, se houver", aliases: ["cancelamento", "data_desativacao"] },
    { field: "cancelType", header: "tipo_cancelamento", required: false, description: "voluntario ou involuntario (inadimplência)", aliases: ["tipo_churn"] },
    { field: "cancelReason", header: "motivo_cancelamento", required: false, description: "Motivo informado", aliases: ["motivo"] },
    { field: "city", header: "cidade", required: false, description: "Cidade", aliases: ["municipio"] },
    { field: "region", header: "regiao", required: false, description: "Região, bairro, unidade ou filial que atende o cliente", aliases: ["bairro", "unidade", "filial", "zona", "area", "polo", "loja"] },
    { field: "cto", header: "subunidade", required: false, description: "Subdivisão da região: CTO, turma, modalidade, carteira, rota...", aliases: ["cto", "caixa", "caixa_atendimento", "nap", "pop", "turma", "modalidade", "especialidade", "carteira", "rota", "sala"] },
  ],
  tickets: [
    { field: "externalId", header: "id_chamado", required: true, description: "Número do chamado/protocolo", aliases: ["id", "protocolo", "numero", "codigo", "id_atendimento", "id_os"] },
    { field: "customerExternalId", header: "id_cliente", required: true, description: "Código do cliente no seu sistema", aliases: ["codigo_cliente", "cliente_id", "id_assinante", "id_aluno", "matricula", "id_paciente", "id_conta"] },
    { field: "category", header: "categoria", required: false, description: "Tipo do chamado (técnico, financeiro, reclamação, cancelamento...)", aliases: ["tipo", "assunto_tipo", "classificacao", "setor"] },
    { field: "subject", header: "assunto", required: false, description: "Assunto ou descrição curta", aliases: ["descricao", "titulo", "motivo"] },
    { field: "openedAt", header: "data_abertura", required: true, description: "Data e hora de abertura", aliases: ["abertura", "data", "criado_em", "data_criacao"] },
    { field: "closedAt", header: "data_fechamento", required: false, description: "Data e hora de encerramento (vazio = em aberto)", aliases: ["fechamento", "encerramento", "data_encerramento", "data_solucao", "finalizado_em"] },
    { field: "reopenCount", header: "reaberturas", required: false, description: "Quantas vezes foi reaberto", aliases: ["reaberto", "qtd_reaberturas"] },
    { field: "csat", header: "nota_satisfacao", required: false, description: "Nota de 1 a 5", aliases: ["nota", "avaliacao", "csat", "satisfacao"] },
  ],
  events: [
    { field: "externalId", header: "id_evento", required: false, description: "Identificador do evento (opcional)", aliases: ["id", "codigo"] },
    { field: "customerExternalId", header: "id_cliente", required: true, description: "Código do cliente no seu sistema", aliases: ["codigo_cliente", "cliente_id", "id_assinante", "id_aluno", "matricula", "id_paciente", "id_conta"] },
    { field: "type", header: "tipo", required: true, description: "interrupção (ou queda), recorrente (ou instabilidade) ou qualidade (ou lentidão)", aliases: ["evento", "tipo_evento", "tipo_falha", "ocorrencia"] },
    { field: "startedAt", header: "data_inicio", required: true, description: "Data e hora de início", aliases: ["inicio", "data", "data_evento"] },
    { field: "durationMinutes", header: "duracao_minutos", required: false, description: "Duração em minutos", aliases: ["duracao", "duracao_min", "minutos", "tempo_minutos"] },
  ],
  usage: [
    { field: "customerExternalId", header: "id_cliente", required: true, description: "Código do cliente no seu sistema", aliases: ["codigo_cliente", "cliente_id", "id_assinante", "id_aluno", "matricula", "id_paciente", "id_conta"] },
    { field: "day", header: "data", required: true, description: "Dia do uso", aliases: ["dia", "data_uso", "data_acesso", "data_visita", "data_checkin", "data_check_in", "checkin", "check_in", "data_aula", "data_presenca", "data_login", "data_pedido", "data_consulta"] },
    { field: "quantity", header: "quantidade", required: false, description: "Quantas vezes usou no dia (vazio = 1, uma linha por visita)", aliases: ["qtd", "visitas", "acessos", "aulas", "presencas", "consultas", "pedidos", "uso", "logins"] },
  ],
  invoices: [
    { field: "externalId", header: "id_fatura", required: true, description: "Número da fatura/boleto", aliases: ["id", "numero", "codigo", "id_boleto", "id_titulo"] },
    { field: "customerExternalId", header: "id_cliente", required: true, description: "Código do cliente no seu sistema", aliases: ["codigo_cliente", "cliente_id", "id_assinante", "id_aluno", "matricula", "id_paciente", "id_conta"] },
    { field: "dueDate", header: "vencimento", required: true, description: "Data de vencimento", aliases: ["data_vencimento"] },
    { field: "paidAt", header: "data_pagamento", required: false, description: "Data do pagamento (vazio = em aberto)", aliases: ["pagamento", "pago_em", "data_baixa"] },
    { field: "amount", header: "valor", required: false, description: "Valor da fatura", aliases: ["valor_fatura", "valor_total"] },
  ],
};

export function normalizeHeader(header: string): string {
  return header
    .replace(/^﻿/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Decodifica o arquivo: UTF-8 quando válido, senão Windows-1252 (comum em exportações de ERPs). */
export function decodeCsv(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/**
 * Converte datas brasileiras (dd/mm/aaaa [hh:mm[:ss]]) ou ISO (aaaa-mm-dd[ T]hh:mm).
 * Horários sem fuso são interpretados no horário de Brasília (UTC−3).
 */
export function parseDate(value: string | undefined | null): Date | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(v);
  let parts: number[] | null = null;
  if (m) {
    parts = [Number(m[3]), Number(m[2]), Number(m[1]), Number(m[4] ?? 12), Number(m[5] ?? 0), Number(m[6] ?? 0)];
  } else {
    m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(v);
    if (m) {
      if (m[7]) {
        const d = new Date(v.replace(" ", "T"));
        return Number.isNaN(d.getTime()) ? null : d;
      }
      parts = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4] ?? 12), Number(m[5] ?? 0), Number(m[6] ?? 0)];
    }
  }
  if (!parts) return null;
  const [y, mo, d, h, mi, s] = parts;
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || y < 1990 || y > 2100) return null;
  const date = new Date(Date.UTC(y, mo - 1, d, h + 3, mi, s));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Converte "R$ 1.299,90", "99,90" ou "99.90" em centavos. */
export function parseMoneyCents(value: string | undefined | null): number | null {
  let v = (value ?? "").replace(/[R$\s]/g, "");
  if (!v) return null;
  if (v.includes(",")) v = v.replace(/\./g, "").replace(",", ".");
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

export function parseIntSafe(value: string | undefined | null): number | null {
  const v = (value ?? "").trim().replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

const plain = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Normaliza a categoria livre do ERP para as categorias usadas pelo motor de risco. */
export function normalizeTicketCategory(category: string, subject = ""): string {
  const text = plain(`${category} ${subject}`);
  if (/cancel|rescis|desist/.test(text)) return "cancel_request";
  if (/descont|renegoci|reducao de valor|baixar o valor/.test(text)) return "discount_request";
  if (/reclam|ouvidoria|procon|anatel|insatisf/.test(text)) return "complaint";
  if (/lent|veloc|banda baixa/.test(text)) return "speed";
  if (/tecn|conex|sinal|queda|caiu|sem internet|sem acesso|instab|suporte|manutenc|reparo|los|rompimento/.test(text))
    return "technical";
  if (/financ|boleto|fatura|cobran|pagament|segunda via|2a via/.test(text)) return "financial";
  if (/comerc|venda|plano|upgrade|mudanca|endereco|contrat/.test(text)) return "commercial";
  return "other";
}

export function normalizeEventType(value: string): string | null {
  const text = plain(value);
  if (/instab|oscila|intermit|flap|recorrent|repetid|equipamento|remarca|troca/.test(text)) return "instability";
  if (/lent|veloc|slow|qualidade|espera|lotac|atraso|demora|problema|defeito/.test(text)) return "slow_speed";
  if (/queda|caiu|indispon|outage|sem sinal|los|down|offline|rompimento|interrup|falha|cancelad|fechad|nao realizad|fora do ar|erro/.test(text)) return "outage";
  return null;
}

export function normalizeCustomerStatus(status: string, hasCancelDate: boolean): "active" | "suspended" | "cancelled" {
  const text = plain(status);
  if (hasCancelDate || /cancel|inativ|desativ|encerr|rescind/.test(text)) return "cancelled";
  if (/suspens|bloque|pausad/.test(text)) return "suspended";
  return "active";
}

export function normalizeCancelType(type: string, reason: string): "voluntary" | "involuntary" {
  const text = plain(`${type} ${reason}`);
  if (/involunt|inadimpl|falta de pagamento|debito|nao pagamento/.test(text)) return "involuntary";
  return "voluntary";
}

export interface ParsedCsv {
  rows: Record<string, string>[];
  missingRequired: string[];
  unknownHeaders: string[];
}

/** Lê o CSV (separador detectado automaticamente) e mapeia os cabeçalhos para os campos do RETENZA. */
export function parseCsv(text: string, kind: ImportKind): ParsedCsv {
  const specs = FIELD_SPECS[kind];
  const lookup = new Map<string, string>();
  for (const spec of specs) {
    lookup.set(spec.header, spec.field);
    for (const alias of spec.aliases) if (!lookup.has(alias)) lookup.set(alias, spec.field);
  }
  const unknown = new Set<string>();
  const seen = new Set<string>();
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => {
      const normalized = normalizeHeader(header);
      const field = lookup.get(normalized);
      if (!field || seen.has(field)) {
        if (normalized) unknown.add(normalized);
        return `__ignored_${normalized}`;
      }
      seen.add(field);
      return field;
    },
  });
  const missingRequired = specs.filter((s) => s.required && !seen.has(s.field)).map((s) => s.header);
  return { rows: result.data, missingRequired, unknownHeaders: [...unknown] };
}
