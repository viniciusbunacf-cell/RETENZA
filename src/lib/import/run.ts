import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import {
  decodeCsv,
  normalizeCancelType,
  normalizeCustomerStatus,
  normalizeEventType,
  normalizeTicketCategory,
  parseCsv,
  parseDate,
  parseIntSafe,
  parseMoneyCents,
  type ImportKind,
} from "./parse";

export interface ImportResult {
  ok: boolean;
  message: string;
  rowsTotal: number;
  rowsOk: number;
  rowsError: number;
  errors: string[];
}

const MAX_ERRORS = 30;
const CHUNK = 500;

/** Mantém apenas a última ocorrência de cada chave (o upsert não aceita chaves repetidas no mesmo lote). */
function dedupe<T>(rows: T[], key: (row: T) => string): T[] {
  const map = new Map<string, T>();
  for (const row of rows) map.set(key(row), row);
  return [...map.values()];
}

/**
 * Importa um arquivo CSV para o provedor. Operação idempotente: reimportar o
 * mesmo arquivo atualiza os registros existentes (chave = identificador do ERP).
 */
export async function runImport(
  providerId: string,
  kind: ImportKind,
  bytes: Uint8Array,
): Promise<ImportResult> {
  const db = await getDb();
  const parsed = parseCsv(decodeCsv(bytes), kind);
  const errors: string[] = [];
  let errorCount = 0;
  const fail = (line: number, message: string) => {
    errorCount += 1;
    if (errors.length < MAX_ERRORS) errors.push(`Linha ${line}: ${message}`);
  };

  if (parsed.missingRequired.length > 0) {
    return {
      ok: false,
      message: `Colunas obrigatórias ausentes: ${parsed.missingRequired.join(", ")}. Confira o modelo de arquivo.`,
      rowsTotal: parsed.rows.length,
      rowsOk: 0,
      rowsError: parsed.rows.length,
      errors: [],
    };
  }
  if (parsed.rows.length === 0) {
    return { ok: false, message: "O arquivo não contém linhas de dados.", rowsTotal: 0, rowsOk: 0, rowsError: 0, errors: [] };
  }

  let rowsOk = 0;

  if (kind === "customers") {
    const values: (typeof schema.customers.$inferInsert)[] = [];
    parsed.rows.forEach((row, index) => {
      const line = index + 2;
      const externalId = (row.externalId ?? "").trim();
      const name = (row.name ?? "").trim();
      if (!externalId) return fail(line, "id_cliente vazio.");
      if (!name) return fail(line, "nome vazio.");
      const cancelledAt = parseDate(row.cancelledAt);
      if ((row.cancelledAt ?? "").trim() && !cancelledAt) return fail(line, `data_cancelamento inválida ("${row.cancelledAt}").`);
      const activatedAt = parseDate(row.activatedAt);
      if ((row.activatedAt ?? "").trim() && !activatedAt) return fail(line, `data_ativacao inválida ("${row.activatedAt}").`);
      const status = normalizeCustomerStatus(row.status ?? "", cancelledAt !== null);
      const cancelled = status === "cancelled";
      values.push({
        providerId,
        externalId,
        name,
        planName: (row.planName ?? "").trim() || null,
        monthlyFeeCents: parseMoneyCents(row.monthlyFee) ?? 0,
        status,
        activatedAt,
        cancelledAt: cancelled ? cancelledAt : null,
        cancelType: cancelled ? normalizeCancelType(row.cancelType ?? "", row.cancelReason ?? "") : null,
        cancelReason: cancelled ? (row.cancelReason ?? "").trim() || null : null,
        city: (row.city ?? "").trim() || null,
        region: (row.region ?? "").trim() || null,
        cto: (row.cto ?? "").trim() || null,
      });
    });
    const unique = dedupe(values, (v) => v.externalId);
    for (let i = 0; i < unique.length; i += CHUNK) {
      await db
        .insert(schema.customers)
        .values(unique.slice(i, i + CHUNK))
        .onConflictDoUpdate({
          target: [schema.customers.providerId, schema.customers.externalId],
          set: {
            name: sql`excluded.name`,
            planName: sql`excluded.plan_name`,
            monthlyFeeCents: sql`excluded.monthly_fee_cents`,
            status: sql`excluded.status`,
            activatedAt: sql`excluded.activated_at`,
            cancelledAt: sql`excluded.cancelled_at`,
            cancelType: sql`excluded.cancel_type`,
            cancelReason: sql`excluded.cancel_reason`,
            city: sql`excluded.city`,
            region: sql`excluded.region`,
            cto: sql`excluded.cto`,
          },
        });
    }
    rowsOk = values.length;
  } else {
    const customerRows = await db
      .select({ id: schema.customers.id, externalId: schema.customers.externalId })
      .from(schema.customers)
      .where(eq(schema.customers.providerId, providerId));
    if (customerRows.length === 0) {
      return {
        ok: false,
        message: "Importe primeiro o arquivo de clientes: os demais arquivos são vinculados pelo id_cliente.",
        rowsTotal: parsed.rows.length,
        rowsOk: 0,
        rowsError: parsed.rows.length,
        errors: [],
      };
    }
    const customerIds = new Map(customerRows.map((c) => [c.externalId, c.id]));
    const resolve = (row: Record<string, string>, line: number): string | null => {
      const ext = (row.customerExternalId ?? "").trim();
      if (!ext) {
        fail(line, "id_cliente vazio.");
        return null;
      }
      const id = customerIds.get(ext);
      if (!id) fail(line, `cliente "${ext}" não encontrado na base importada.`);
      return id ?? null;
    };

    if (kind === "tickets") {
      const values: (typeof schema.tickets.$inferInsert)[] = [];
      parsed.rows.forEach((row, index) => {
        const line = index + 2;
        const externalId = (row.externalId ?? "").trim();
        if (!externalId) return fail(line, "id_chamado vazio.");
        const customerId = resolve(row, line);
        if (!customerId) return;
        const openedAt = parseDate(row.openedAt);
        if (!openedAt) return fail(line, `data_abertura inválida ("${row.openedAt ?? ""}").`);
        const closedAt = parseDate(row.closedAt);
        if ((row.closedAt ?? "").trim() && !closedAt) return fail(line, `data_fechamento inválida ("${row.closedAt}").`);
        const csat = parseIntSafe(row.csat);
        values.push({
          providerId,
          customerId,
          externalId,
          category: normalizeTicketCategory(row.category ?? "", row.subject ?? ""),
          subject: ((row.subject ?? "").trim() || (row.category ?? "").trim() || null)?.slice(0, 200) ?? null,
          openedAt,
          closedAt,
          reopenCount: Math.max(0, parseIntSafe(row.reopenCount) ?? 0),
          csat: csat !== null && csat >= 1 && csat <= 5 ? csat : null,
        });
      });
      const unique = dedupe(values, (v) => v.externalId);
      for (let i = 0; i < unique.length; i += CHUNK) {
        await db
          .insert(schema.tickets)
          .values(unique.slice(i, i + CHUNK))
          .onConflictDoUpdate({
            target: [schema.tickets.providerId, schema.tickets.externalId],
            set: {
              customerId: sql`excluded.customer_id`,
              category: sql`excluded.category`,
              subject: sql`excluded.subject`,
              openedAt: sql`excluded.opened_at`,
              closedAt: sql`excluded.closed_at`,
              reopenCount: sql`excluded.reopen_count`,
              csat: sql`excluded.csat`,
            },
          });
      }
      rowsOk = values.length;
    } else if (kind === "events") {
      const values: (typeof schema.networkEvents.$inferInsert)[] = [];
      parsed.rows.forEach((row, index) => {
        const line = index + 2;
        const customerId = resolve(row, line);
        if (!customerId) return;
        const type = normalizeEventType(row.type ?? "");
        if (!type) return fail(line, `tipo de evento não reconhecido ("${row.type ?? ""}"). Use queda, instabilidade ou lentidao.`);
        const startedAt = parseDate(row.startedAt);
        if (!startedAt) return fail(line, `data_inicio inválida ("${row.startedAt ?? ""}").`);
        // Sem identificador próprio, a chave é derivada do conteúdo para que a reimportação não duplique eventos.
        const externalId =
          (row.externalId ?? "").trim() ||
          "auto-" + createHash("sha1").update(`${customerId}|${type}|${startedAt.toISOString()}`).digest("hex").slice(0, 20);
        values.push({
          providerId,
          customerId,
          externalId,
          type,
          startedAt,
          durationMinutes: Math.max(0, parseIntSafe(row.durationMinutes) ?? 0),
        });
      });
      const unique = dedupe(values, (v) => v.externalId);
      for (let i = 0; i < unique.length; i += CHUNK) {
        await db
          .insert(schema.networkEvents)
          .values(unique.slice(i, i + CHUNK))
          .onConflictDoUpdate({
            target: [schema.networkEvents.providerId, schema.networkEvents.externalId],
            set: {
              customerId: sql`excluded.customer_id`,
              type: sql`excluded.type`,
              startedAt: sql`excluded.started_at`,
              durationMinutes: sql`excluded.duration_minutes`,
            },
          });
      }
      rowsOk = values.length;
    } else if (kind === "usage") {
      // Soma por cliente e dia dentro do arquivo; na reimportação o valor do dia é substituído.
      const days = new Map<string, { customerId: string; day: string; quantity: number }>();
      parsed.rows.forEach((row, index) => {
        const line = index + 2;
        const customerId = resolve(row, line);
        if (!customerId) return;
        const when = parseDate(row.day);
        if (!when) return fail(line, `data inválida ("${row.day ?? ""}").`);
        const qty = (row.quantity ?? "").trim() === "" ? 1 : parseIntSafe(row.quantity);
        if (qty === null || qty < 0) return fail(line, `quantidade inválida ("${row.quantity}").`);
        // parseDate devolve o instante em UTC; o dia é o do horário de Brasília (UTC−3).
        const day = new Date(when.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
        const key = customerId + "|" + day;
        const cur = days.get(key);
        if (cur) cur.quantity += qty;
        else days.set(key, { customerId, day, quantity: qty });
        rowsOk += 1;
      });
      const values = [...days.values()].map((d) => ({ providerId, ...d }));
      for (let i = 0; i < values.length; i += CHUNK) {
        await db
          .insert(schema.usageRecords)
          .values(values.slice(i, i + CHUNK))
          .onConflictDoUpdate({
            target: [schema.usageRecords.customerId, schema.usageRecords.day],
            set: { quantity: sql`excluded.quantity` },
          });
      }
    } else {
      const values: (typeof schema.invoices.$inferInsert)[] = [];
      parsed.rows.forEach((row, index) => {
        const line = index + 2;
        const externalId = (row.externalId ?? "").trim();
        if (!externalId) return fail(line, "id_fatura vazio.");
        const customerId = resolve(row, line);
        if (!customerId) return;
        const dueDate = parseDate(row.dueDate);
        if (!dueDate) return fail(line, `vencimento inválido ("${row.dueDate ?? ""}").`);
        const paidAt = parseDate(row.paidAt);
        if ((row.paidAt ?? "").trim() && !paidAt) return fail(line, `data_pagamento inválida ("${row.paidAt}").`);
        values.push({
          providerId,
          customerId,
          externalId,
          dueDate,
          paidAt,
          amountCents: parseMoneyCents(row.amount) ?? 0,
        });
      });
      const unique = dedupe(values, (v) => v.externalId);
      for (let i = 0; i < unique.length; i += CHUNK) {
        await db
          .insert(schema.invoices)
          .values(unique.slice(i, i + CHUNK))
          .onConflictDoUpdate({
            target: [schema.invoices.providerId, schema.invoices.externalId],
            set: {
              customerId: sql`excluded.customer_id`,
              dueDate: sql`excluded.due_date`,
              paidAt: sql`excluded.paid_at`,
              amountCents: sql`excluded.amount_cents`,
            },
          });
      }
      rowsOk = values.length;
    }
  }

  const ignored = parsed.unknownHeaders.length
    ? ` Colunas ignoradas: ${parsed.unknownHeaders.slice(0, 8).join(", ")}.`
    : "";
  return {
    ok: rowsOk > 0,
    message:
      rowsOk > 0
        ? `${rowsOk} linhas importadas${errorCount ? `, ${errorCount} com erro` : ""}.${ignored}`
        : `Nenhuma linha válida encontrada.${ignored}`,
    rowsTotal: parsed.rows.length,
    rowsOk,
    rowsError: errorCount,
    errors,
  };
}
