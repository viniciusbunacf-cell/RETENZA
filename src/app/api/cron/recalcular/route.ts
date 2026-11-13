import { timingSafeEqual } from "node:crypto";
import { getDb, schema } from "@/db/client";
import { audit } from "@/lib/audit";
import { recalculateProvider } from "@/lib/risk/recalculate";
import { generateActions } from "@/lib/retention/generate";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/**
 * Recalcula o risco e gera as ações preventivas de todos os provedores.
 * Pensado para um agendador externo (cron da hospedagem, n8n etc.), uma vez por dia:
 *
 *   curl -X POST https://seu-dominio/api/cron/recalcular -H "Authorization: Bearer $CRON_SECRET"
 *
 * Fica desativado enquanto CRON_SECRET não estiver definido.
 */
export async function POST(request: Request): Promise<Response> {
  if (!authorized(request)) return Response.json({ error: "Não autorizado." }, { status: 401 });

  const db = await getDb();
  const providers = await db.select({ id: schema.providers.id }).from(schema.providers);
  const results: { providerId: string; customers: number; newActions: number }[] = [];
  for (const provider of providers) {
    const result = await recalculateProvider(provider.id);
    const generated = await generateActions(provider.id);
    const newActions = generated.regionActions + generated.customerActions;
    await audit(
      { providerId: provider.id, name: "Agendador" },
      "Recálculo de risco agendado",
      `${result.snapshots} clientes avaliados, ${newActions} novas ações`,
    );
    results.push({ providerId: provider.id, customers: result.snapshots, newActions });
  }
  return Response.json({ ok: true, providers: results });
}
