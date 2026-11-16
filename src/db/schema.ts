import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { RiskConfig, RiskFactor } from "@/lib/risk/types";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/** Provedor de internet (tenant). Todos os dados operacionais pertencem a um provedor. */
export const providers = pgTable("providers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  city: text("city"),
  erp: text("erp"),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    /** owner | manager | agent */
    role: text("role").notNull().default("agent"),
    team: text("team"),
    active: boolean("active").notNull().default(true),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email), index("users_provider_idx").on(t.providerId)],
);

/**
 * Assinantes. Por minimização de dados (LGPD) o RETENZA não armazena CPF/CNPJ,
 * endereço completo nem dados de pagamento: apenas o identificador do ERP,
 * nome, plano e localização em nível de bairro/CTO.
 */
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    name: text("name").notNull(),
    planName: text("plan_name"),
    monthlyFeeCents: integer("monthly_fee_cents").notNull().default(0),
    /** active | suspended | cancelled */
    status: text("status").notNull().default("active"),
    activatedAt: ts("activated_at"),
    cancelledAt: ts("cancelled_at"),
    /** voluntary | involuntary */
    cancelType: text("cancel_type"),
    cancelReason: text("cancel_reason"),
    city: text("city"),
    region: text("region"),
    cto: text("cto"),
    riskScore: integer("risk_score"),
    riskBand: text("risk_band"),
    riskTopGroup: text("risk_top_group"),
    riskFactors: jsonb("risk_factors").$type<RiskFactor[]>(),
    riskNotes: jsonb("risk_notes").$type<string[]>(),
    riskUpdatedAt: ts("risk_updated_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("customers_provider_external_uq").on(t.providerId, t.externalId),
    index("customers_provider_status_idx").on(t.providerId, t.status),
    index("customers_provider_score_idx").on(t.providerId, t.riskScore),
    index("customers_provider_region_idx").on(t.providerId, t.region),
  ],
);

export const tickets = pgTable(
  "tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    /** technical | speed | financial | commercial | complaint | discount_request | cancel_request | other */
    category: text("category").notNull().default("other"),
    subject: text("subject"),
    openedAt: ts("opened_at").notNull(),
    closedAt: ts("closed_at"),
    reopenCount: integer("reopen_count").notNull().default(0),
    /** Nota de satisfação de 1 a 5, quando respondida. */
    csat: integer("csat"),
  },
  (t) => [
    uniqueIndex("tickets_provider_external_uq").on(t.providerId, t.externalId),
    index("tickets_customer_idx").on(t.customerId),
    index("tickets_provider_opened_idx").on(t.providerId, t.openedAt),
  ],
);

export const networkEvents = pgTable(
  "network_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    /** outage | instability | slow_speed */
    type: text("type").notNull(),
    startedAt: ts("started_at").notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(0),
  },
  (t) => [
    uniqueIndex("network_events_provider_external_uq").on(t.providerId, t.externalId),
    index("network_events_customer_idx").on(t.customerId),
    index("network_events_provider_started_idx").on(t.providerId, t.startedAt),
  ],
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    dueDate: ts("due_date").notNull(),
    paidAt: ts("paid_at"),
    amountCents: integer("amount_cents").notNull().default(0),
  },
  (t) => [
    uniqueIndex("invoices_provider_external_uq").on(t.providerId, t.externalId),
    index("invoices_customer_idx").on(t.customerId),
    index("invoices_provider_due_idx").on(t.providerId, t.dueDate),
  ],
);

/** Fotografia do score por cliente e data: permite acompanhar a evolução do risco e validar o score. */
export const riskSnapshots = pgTable(
  "risk_snapshots",
  {
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    snapshotDate: date("snapshot_date", { mode: "string" }).notNull(),
    score: integer("score").notNull(),
    band: text("band").notNull(),
    topGroup: text("top_group"),
    factors: jsonb("factors").$type<RiskFactor[]>().notNull(),
    notes: jsonb("notes").$type<string[]>(),
  },
  (t) => [
    primaryKey({ columns: [t.customerId, t.snapshotDate] }),
    index("risk_snapshots_provider_date_idx").on(t.providerId, t.snapshotDate),
  ],
);

export const actions = pgTable(
  "actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    /** customer | region */
    kind: text("kind").notNull(),
    causeGroup: text("cause_group"),
    region: text("region"),
    title: text("title").notNull(),
    problem: text("problem").notNull(),
    recommendation: text("recommendation").notNull(),
    /** critical | high | medium */
    priority: text("priority").notNull().default("high"),
    ownerTeam: text("owner_team").notNull(),
    assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
    dueAt: ts("due_at").notNull(),
    /** pending | in_progress | done | cancelled */
    status: text("status").notNull().default("pending"),
    /** auto | manual */
    source: text("source").notNull().default("auto"),
    createdAt: ts("created_at").notNull().defaultNow(),
    startedAt: ts("started_at"),
    completedAt: ts("completed_at"),
    resolution: text("resolution"),
    /** resolved | partial | not_resolved */
    outcome: text("outcome"),
  },
  (t) => [
    uniqueIndex("actions_provider_number_uq").on(t.providerId, t.number),
    index("actions_provider_status_idx").on(t.providerId, t.status),
  ],
);

export const actionCustomers = pgTable(
  "action_customers",
  {
    actionId: uuid("action_id")
      .notNull()
      .references(() => actions.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    scoreAtCreation: integer("score_at_creation"),
    bandAtCreation: text("band_at_creation"),
  },
  (t) => [
    primaryKey({ columns: [t.actionId, t.customerId] }),
    index("action_customers_customer_idx").on(t.customerId),
    index("action_customers_provider_idx").on(t.providerId),
  ],
);

/** Histórico de intervenções: tudo o que aconteceu em cada ação preventiva. */
export const actionEvents = pgTable(
  "action_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    actionId: uuid("action_id")
      .notNull()
      .references(() => actions.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    userName: text("user_name"),
    /** created | started | completed | cancelled | reopened | note | assigned */
    type: text("type").notNull(),
    note: text("note"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("action_events_action_idx").on(t.actionId)],
);

export const riskConfigs = pgTable("risk_configs", {
  providerId: uuid("provider_id")
    .primaryKey()
    .references(() => providers.id, { onDelete: "cascade" }),
  config: jsonb("config").$type<RiskConfig>().notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/** Registro de atividades (auditoria). */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    userId: uuid("user_id"),
    userName: text("user_name"),
    action: text("action").notNull(),
    detail: text("detail"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("audit_log_provider_idx").on(t.providerId, t.createdAt)],
);

export const imports = pgTable(
  "imports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    userName: text("user_name"),
    kind: text("kind").notNull(),
    filename: text("filename"),
    rowsTotal: integer("rows_total").notNull().default(0),
    rowsOk: integer("rows_ok").notNull().default(0),
    rowsError: integer("rows_error").notNull().default(0),
    errors: jsonb("errors").$type<string[]>(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("imports_provider_idx").on(t.providerId, t.createdAt)],
);

/**
 * Pedidos de demonstração vindos do site público. Não pertencem a nenhum
 * provedor cliente: são contatos comerciais do próprio RETENZA.
 */
export const demoRequests = pgTable(
  "demo_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    role: text("role"),
    company: text("company").notNull(),
    city: text("city"),
    subscribers: text("subscribers"),
    erp: text("erp"),
    email: text("email").notNull(),
    whatsapp: text("whatsapp").notNull(),
    message: text("message"),
    /** Resultado do aviso por e-mail: sent | not_configured | failed */
    emailStatus: text("email_status").notNull().default("not_configured"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("demo_requests_created_idx").on(t.createdAt)],
);
