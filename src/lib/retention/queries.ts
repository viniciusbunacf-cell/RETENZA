import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db/client";

export type ActionStatus = "pending" | "in_progress" | "done" | "cancelled";

export const OPEN_STATUSES: ActionStatus[] = ["pending", "in_progress"];

export async function listActions(
  providerId: string,
  options: { statuses: ActionStatus[]; limit?: number; order?: "due" | "recent" } = { statuses: OPEN_STATUSES },
) {
  const db = await getDb();
  const order =
    options.order === "recent"
      ? [desc(sql`coalesce(${schema.actions.completedAt}, ${schema.actions.createdAt})`)]
      : [asc(schema.actions.dueAt)];
  return db
    .select({
      id: schema.actions.id,
      number: schema.actions.number,
      title: schema.actions.title,
      kind: schema.actions.kind,
      region: schema.actions.region,
      causeGroup: schema.actions.causeGroup,
      priority: schema.actions.priority,
      ownerTeam: schema.actions.ownerTeam,
      dueAt: schema.actions.dueAt,
      status: schema.actions.status,
      createdAt: schema.actions.createdAt,
      completedAt: schema.actions.completedAt,
      outcome: schema.actions.outcome,
      assigneeName: schema.users.name,
      impacted: sql<number>`(select count(*) from action_customers ac where ac.action_id = ${schema.actions.id})::int`,
    })
    .from(schema.actions)
    .leftJoin(schema.users, eq(schema.users.id, schema.actions.assigneeId))
    .where(and(eq(schema.actions.providerId, providerId), inArray(schema.actions.status, options.statuses)))
    .orderBy(...order)
    .limit(options.limit ?? 200);
}

export async function getActionDetail(providerId: string, actionId: string) {
  const db = await getDb();
  const [action] = await db
    .select({
      action: schema.actions,
      assigneeName: schema.users.name,
    })
    .from(schema.actions)
    .leftJoin(schema.users, eq(schema.users.id, schema.actions.assigneeId))
    .where(and(eq(schema.actions.id, actionId), eq(schema.actions.providerId, providerId)))
    .limit(1);
  if (!action) return null;

  const customers = await db
    .select({
      id: schema.customers.id,
      name: schema.customers.name,
      region: schema.customers.region,
      cto: schema.customers.cto,
      status: schema.customers.status,
      cancelledAt: schema.customers.cancelledAt,
      fee: schema.customers.monthlyFeeCents,
      scoreNow: schema.customers.riskScore,
      bandNow: schema.customers.riskBand,
      scoreAtCreation: schema.actionCustomers.scoreAtCreation,
      bandAtCreation: schema.actionCustomers.bandAtCreation,
    })
    .from(schema.actionCustomers)
    .innerJoin(schema.customers, eq(schema.customers.id, schema.actionCustomers.customerId))
    .where(eq(schema.actionCustomers.actionId, actionId))
    .orderBy(desc(schema.actionCustomers.scoreAtCreation));

  const events = await db
    .select()
    .from(schema.actionEvents)
    .where(eq(schema.actionEvents.actionId, actionId))
    .orderBy(asc(schema.actionEvents.createdAt));

  const team = await db
    .select({ id: schema.users.id, name: schema.users.name, team: schema.users.team })
    .from(schema.users)
    .where(and(eq(schema.users.providerId, providerId), eq(schema.users.active, true)))
    .orderBy(asc(schema.users.name));

  return { ...action.action, assigneeName: action.assigneeName, customers, events, team };
}
