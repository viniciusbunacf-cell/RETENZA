import { getDb, schema } from "@/db/client";

/** Registra uma atividade relevante para auditoria (quem fez o quê e quando). */
export async function audit(
  actor: { providerId: string; id?: string | null; name?: string | null },
  action: string,
  detail?: string,
): Promise<void> {
  const db = await getDb();
  await db.insert(schema.auditLog).values({
    providerId: actor.providerId,
    userId: actor.id ?? null,
    userName: actor.name ?? "Sistema",
    action,
    detail: detail ?? null,
  });
}
