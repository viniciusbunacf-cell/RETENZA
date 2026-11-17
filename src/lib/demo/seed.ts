import { and, eq, inArray, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { getDb, schema, type Db } from "@/db/client";
import { hashPassword } from "@/lib/auth/password";
import { DEFAULT_RISK_CONFIG } from "@/lib/risk/config";
import { recalculateProvider } from "@/lib/risk/recalculate";
import { recommendFor } from "@/lib/risk/recommend";
import { generateActions } from "@/lib/retention/generate";
import { generateDemoData } from "./generate";

const DAY = 86_400_000;
const HOUR = 3_600_000;

export const DEMO_EMAIL = "demo@retenza.app";
export const DEMO_PASSWORD = "retenza-demo";
export const DEMO_PROVIDER_NAME = "Conecta Fibra (demonstração)";

/** Semanas de histórico de score gravadas na demonstração. */
const SNAPSHOT_WEEKS = 22;

async function insertChunked<T extends PgTable>(db: Db, table: T, rows: T["$inferInsert"][], size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    await db.insert(table).values(rows.slice(i, i + size));
  }
}

/** Apaga todos os dados operacionais de um provedor (clientes, chamados, ações...). */
export async function wipeProviderData(providerId: string, dbArg?: Db): Promise<void> {
  const db = dbArg ?? (await getDb());
  await db.delete(schema.actions).where(eq(schema.actions.providerId, providerId));
  await db.delete(schema.customers).where(eq(schema.customers.providerId, providerId));
  await db.delete(schema.imports).where(eq(schema.imports.providerId, providerId));
}

/**
 * Carrega dados fictícios em um provedor: base de assinantes, 12 meses de
 * histórico, 22 semanas de score, ações já concluídas e ações em aberto.
 */
export async function loadDemoData(providerId: string, now: Date = new Date()): Promise<void> {
  const root = await getDb();
  const data = generateDemoData(now);

  await root.transaction(async (tx) => {
    const db = tx as unknown as Db;
    await wipeProviderData(providerId, db);

    await insertChunked(
      db,
      schema.customers,
      data.customers.map((c) => ({ ...c, providerId })),
    );
    await insertChunked(
      db,
      schema.tickets,
      data.tickets.map((t) => ({ ...t, providerId })),
    );
    await insertChunked(
      db,
      schema.networkEvents,
      data.events.map((e) => ({ ...e, providerId })),
    );
    await insertChunked(
      db,
      schema.invoices,
      data.invoices.map((i) => ({ ...i, providerId })),
    );

    const team = await db
      .select({ id: schema.users.id, name: schema.users.name, team: schema.users.team })
      .from(schema.users)
      .where(and(eq(schema.users.providerId, providerId), eq(schema.users.active, true)));
    const memberFor = (ownerTeam: string) =>
      team.find((u) => u.team === ownerTeam) ?? team[Math.floor(team.length / 2)] ?? null;

    // ---------- Histórico: ações de retenção já concluídas ----------
    let number = 1001;
    const history = [
      ...data.interventions.map((i) => ({ kind: "customer" as const, ...i })),
      {
        kind: "region" as const,
        customerId: "",
        customerName: "",
        region: data.regionalFix.region,
        cause: "service" as const,
        createdAt: data.regionalFix.createdAt,
        completedAt: data.regionalFix.completedAt,
      },
    ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const actionRows: (typeof schema.actions.$inferInsert & { id: string })[] = [];
    const linkRows: (typeof schema.actionCustomers.$inferInsert)[] = [];
    const eventRows: (typeof schema.actionEvents.$inferInsert)[] = [];
    const RESOLUTIONS: Record<string, string[]> = {
      service: [
        "Visita técnica realizada: conector da fibra refeito e sinal normalizado. Cliente avisado.",
        "Troca do equipamento do cliente (ONU com defeito). Conexão estável após a troca.",
      ],
      support: [
        "Chamado antigo assumido por atendente sênior e resolvido. Retorno feito ao cliente por telefone.",
        "Pendência resolvida e confirmada com o cliente, que agradeceu o retorno.",
      ],
      dissatisfaction: [
        "Ligação de retenção: cliente relatou as falhas, causa técnica tratada e plano mantido sem desconto.",
        "Contato feito pelo time de retenção. Problema de origem corrigido e cliente decidiu permanecer.",
      ],
    };

    for (const h of history) {
      const id = crypto.randomUUID();
      const isRegion = h.kind === "region";
      const rec = recommendFor(h.cause, "high", "provedor");
      const ownerTeam = isRegion ? "Equipe técnica" : rec.ownerTeam;
      const member = memberFor(ownerTeam);
      const startedAt = new Date(h.createdAt.getTime() + 6 * HOUR);
      actionRows.push({
        id,
        providerId,
        number: number++,
        kind: h.kind,
        causeGroup: h.cause,
        region: h.region,
        title: isRegion ? `Concentração de falhas de conexão — ${h.region}` : `${rec.title} — ${h.customerName}`,
        problem: isRegion
          ? `${data.regionalFix.customerIds.length} clientes da região ${h.region} com quedas recorrentes nas CTOs VNO-01 e VNO-02.`
          : "Cliente com sinais combinados de risco identificados pelo radar.",
        recommendation: isRegion
          ? "Verificar a infraestrutura que atende a região e tratar a causa comum antes de abordar clientes individualmente."
          : rec.recommendation,
        priority: isRegion ? "critical" : "high",
        ownerTeam,
        assigneeId: member?.id ?? null,
        dueAt: new Date(h.createdAt.getTime() + (isRegion ? 24 : rec.slaHours) * HOUR),
        status: "done",
        source: "auto",
        createdAt: h.createdAt,
        startedAt,
        completedAt: h.completedAt,
        resolution: isRegion
          ? "Identificada atenuação alta na rota óptica que alimenta as CTOs VNO-01 e VNO-02. Fusão refeita e splitter substituído. Clientes afetados avisados por mensagem."
          : RESOLUTIONS[h.cause][number % 2],
        outcome: "resolved",
      });
      const members = isRegion ? data.regionalFix.customerIds : [h.customerId];
      for (const customerId of members) linkRows.push({ actionId: id, customerId, providerId });
      eventRows.push(
        { providerId, actionId: id, type: "created", userName: "RETENZA", note: "Ação gerada automaticamente.", createdAt: h.createdAt },
        { providerId, actionId: id, type: "started", userId: member?.id ?? null, userName: member?.name ?? "Equipe", createdAt: startedAt },
        {
          providerId,
          actionId: id,
          type: "completed",
          userId: member?.id ?? null,
          userName: member?.name ?? "Equipe",
          note: "Intervenção concluída e registrada.",
          createdAt: h.completedAt,
        },
      );
    }
    await insertChunked(db, schema.actions, actionRows);
    await insertChunked(db, schema.actionCustomers, linkRows);
    await insertChunked(db, schema.actionEvents, eventRows);

    // ---------- Histórico de score (uma fotografia por semana) ----------
    const dates: Date[] = [];
    for (let w = SNAPSHOT_WEEKS; w >= 0; w--) dates.push(new Date(now.getTime() - w * 7 * DAY));
    await recalculateProvider(providerId, { asOfDates: dates, db });

    // Score que cada cliente tinha quando a ação histórica foi criada.
    await db.execute(sql`
      update action_customers ac
         set score_at_creation = s.score,
             band_at_creation = s.band
        from actions a, risk_snapshots s
       where a.id = ac.action_id
         and ac.provider_id = ${providerId}
         and s.customer_id = ac.customer_id
         and s.snapshot_date = (
               select max(s2.snapshot_date)
                 from risk_snapshots s2
                where s2.customer_id = ac.customer_id
                  and s2.snapshot_date <= (a.created_at + interval '6 days')::date
             )
    `);

    // ---------- Ações em aberto geradas pelo estado atual ----------
    await generateActions(providerId, db, new Date(now.getTime() - 20 * HOUR));

    // Algumas ações já em andamento, para a central parecer uma operação real.
    const open = await db
      .select({ id: schema.actions.id, kind: schema.actions.kind, ownerTeam: schema.actions.ownerTeam })
      .from(schema.actions)
      .where(and(eq(schema.actions.providerId, providerId), eq(schema.actions.status, "pending")))
      .orderBy(schema.actions.number);
    const toStart = [...open.filter((a) => a.kind === "region").slice(0, 1), ...open.filter((a) => a.kind === "customer").slice(0, 4)];
    for (const a of toStart) {
      const member = memberFor(a.ownerTeam);
      const startedAt = new Date(now.getTime() - (3 + Math.floor(Math.random() * 10)) * HOUR);
      await db
        .update(schema.actions)
        .set({ status: "in_progress", startedAt, assigneeId: member?.id ?? null })
        .where(eq(schema.actions.id, a.id));
      await db.insert(schema.actionEvents).values([
        { providerId, actionId: a.id, type: "started", userId: member?.id ?? null, userName: member?.name ?? "Equipe", createdAt: startedAt },
        {
          providerId,
          actionId: a.id,
          type: "note",
          userId: member?.id ?? null,
          userName: member?.name ?? "Equipe",
          note:
            a.kind === "region"
              ? "Equipe de campo deslocada. Medição inicial indica atenuação acima do normal na saída do splitter primário."
              : "Primeira tentativa de contato feita, cliente pediu retorno no fim da tarde.",
          createdAt: new Date(startedAt.getTime() + HOUR),
        },
      ]);
    }
    // Duas ações com prazo vencido, para evidenciar o controle de prazos.
    const late = open.filter((a) => a.kind === "customer").slice(4, 6).map((a) => a.id);
    if (late.length > 0) {
      await db
        .update(schema.actions)
        .set({ createdAt: new Date(now.getTime() - 3 * DAY), dueAt: new Date(now.getTime() - 30 * HOUR) })
        .where(inArray(schema.actions.id, late));
    }
  });
}

export function isDemoModeEnabled(): boolean {
  if (process.env.RETENZA_DEMO === "true") return true;
  if (process.env.RETENZA_DEMO === "false") return false;
  return !process.env.DATABASE_URL;
}

type GlobalWithDemo = typeof globalThis & { __retenzaDemo?: Promise<void> };

/**
 * No modo demonstração, garante que exista um provedor fictício com dados e
 * um usuário de acesso. Executa uma única vez por banco.
 */
export function ensureDemoProvider(): Promise<void> {
  if (!isDemoModeEnabled()) return Promise.resolve();
  const g = globalThis as GlobalWithDemo;
  if (!g.__retenzaDemo) {
    g.__retenzaDemo = createDemoProvider().catch((err) => {
      g.__retenzaDemo = undefined;
      throw err;
    });
  }
  return g.__retenzaDemo;
}

async function createDemoProvider(): Promise<void> {
  const db = await getDb();
  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, DEMO_EMAIL))
    .limit(1);
  if (existing) return;

  const [provider] = await db
    .insert(schema.providers)
    .values({ name: DEMO_PROVIDER_NAME, segment: "provedor", city: "Serra Azul", erp: "Importação CSV", isDemo: true })
    .returning({ id: schema.providers.id });
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  await db.insert(schema.users).values([
    { providerId: provider.id, name: "Marina Duarte", email: DEMO_EMAIL, passwordHash, role: "owner", team: "Diretoria" },
    { providerId: provider.id, name: "Rafael Nunes", email: "rafael@conectafibra.example", passwordHash, role: "manager", team: "Retenção" },
    { providerId: provider.id, name: "Camila Prates", email: "camila@conectafibra.example", passwordHash, role: "agent", team: "Atendimento" },
    { providerId: provider.id, name: "Diego Antunes", email: "diego@conectafibra.example", passwordHash, role: "agent", team: "Equipe técnica" },
    { providerId: provider.id, name: "Lívia Moraes", email: "livia@conectafibra.example", passwordHash, role: "agent", team: "Financeiro" },
  ]);
  await db.insert(schema.riskConfigs).values({ providerId: provider.id, config: DEFAULT_RISK_CONFIG });
  await loadDemoData(provider.id);
}
