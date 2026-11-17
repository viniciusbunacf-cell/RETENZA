"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { audit } from "@/lib/audit";
import { ForbiddenError, requireManager, requireOwner } from "@/lib/auth/session";
import { loadDemoData, wipeProviderData } from "@/lib/demo/seed";
import { IMPORT_KINDS, type ImportKind } from "@/lib/import/parse";
import { runImport } from "@/lib/import/run";
import { GROUP_ORDER, RULES, normalizeRiskConfig } from "@/lib/risk/config";
import { recalculateProvider } from "@/lib/risk/recalculate";
import { generateActions } from "@/lib/retention/generate";
import type { RiskConfig } from "@/lib/risk/types";
import type { FormState } from "./auth";

const DAY = 86_400_000;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

function denied(err: unknown): FormState | null {
  return err instanceof ForbiddenError ? { error: err.message } : null;
}

async function recalcAndGenerate(providerId: string) {
  const result = await recalculateProvider(providerId);
  const generated = await generateActions(providerId);
  return { result, generated };
}

export async function recalculateAction(): Promise<FormState> {
  try {
    const user = await requireManager();
    const { result, generated } = await recalcAndGenerate(user.providerId);
    await audit(user, "Recálculo de risco", `${result.snapshots} clientes avaliados`);
    revalidatePath("/", "layout");
    const created = generated.regionActions + generated.customerActions;
    return {
      ok: `Risco recalculado para ${result.snapshots} clientes. ${created ? `${created} novas ações preventivas geradas.` : "Nenhuma nova ação necessária."}`,
    };
  } catch (err) {
    const d = denied(err);
    if (d) return d;
    throw err;
  }
}

/** Reconstrói o histórico semanal de score a partir dos dados importados (permite validar o score de imediato). */
export async function rebuildHistoryAction(): Promise<FormState> {
  try {
    const user = await requireManager();
    const now = Date.now();
    const dates: Date[] = [];
    for (let w = 26; w >= 0; w--) dates.push(new Date(now - w * 7 * DAY));
    const result = await recalculateProvider(user.providerId, { asOfDates: dates });
    await audit(user, "Reconstrução do histórico de score", `${result.snapshots} fotografias em 27 semanas`);
    revalidatePath("/", "layout");
    return { ok: `Histórico reconstruído: ${result.snapshots} fotografias de score nas últimas 26 semanas.` };
  } catch (err) {
    const d = denied(err);
    if (d) return d;
    throw err;
  }
}

export async function importCsvAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await requireManager();
    const kind = String(formData.get("kind") ?? "") as ImportKind;
    if (!IMPORT_KINDS.some((k) => k.kind === kind)) return { error: "Tipo de arquivo inválido." };
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "Selecione um arquivo CSV." };
    if (file.size > MAX_FILE_BYTES) return { error: "Arquivo acima de 20 MB. Divida a exportação em partes." };

    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await runImport(user.providerId, kind, bytes);
    const db = await getDb();
    await db.insert(schema.imports).values({
      providerId: user.providerId,
      userName: user.name,
      kind,
      filename: file.name.slice(0, 200),
      rowsTotal: result.rowsTotal,
      rowsOk: result.rowsOk,
      rowsError: result.rowsError,
      errors: result.errors,
    });
    await audit(user, "Importação de dados", `${kind}: ${result.rowsOk} linhas (${file.name.slice(0, 80)})`);

    if (result.rowsOk > 0) await recalcAndGenerate(user.providerId);
    revalidatePath("/", "layout");
    if (!result.ok) return { error: result.message };
    return { ok: `${result.message} Risco recalculado.` };
  } catch (err) {
    const d = denied(err);
    if (d) return d;
    throw err;
  }
}

export async function loadDemoDataAction(): Promise<FormState> {
  try {
    const user = await requireOwner();
    await loadDemoData(user.providerId);
    const db = await getDb();
    await db.update(schema.providers).set({ isDemo: true }).where(eq(schema.providers.id, user.providerId));
    await audit(user, "Dados de demonstração carregados", "Base fictícia de 1.800 assinantes");
    revalidatePath("/", "layout");
    return { ok: "Dados fictícios carregados. Explore o painel, o radar e a central de ações." };
  } catch (err) {
    const d = denied(err);
    if (d) return d;
    throw err;
  }
}

export async function wipeDataAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await requireOwner();
    if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "EXCLUIR") {
      return { error: 'Digite EXCLUIR para confirmar a exclusão dos dados.' };
    }
    const db = await getDb();
    await wipeProviderData(user.providerId, db);
    await db.update(schema.providers).set({ isDemo: false }).where(eq(schema.providers.id, user.providerId));
    await audit(user, "Exclusão de dados", "Clientes, chamados, eventos, faturas, scores e ações removidos");
    revalidatePath("/", "layout");
    return { ok: "Todos os dados operacionais da empresa foram excluídos." };
  } catch (err) {
    const d = denied(err);
    if (d) return d;
    throw err;
  }
}

export async function saveRiskConfigAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await requireManager();
    const num = (name: string) => Number(String(formData.get(name) ?? "").replace(",", "."));
    const raw = {
      recentDays: num("recentDays"),
      incidentLinkHours: num("incidentLinkHours"),
      rules: Object.fromEntries(
        RULES.map((r) => [
          r.id,
          {
            enabled: formData.get(`rule.${r.id}.enabled`) === "on",
            points: num(`rule.${r.id}.points`),
            threshold: num(`rule.${r.id}.threshold`),
          },
        ]),
      ),
      groupCaps: Object.fromEntries(GROUP_ORDER.map((g) => [g, num(`cap.${g}`)])),
      bands: { critical: num("band.critical"), high: num("band.high"), moderate: num("band.moderate") },
      cluster: { minCustomers: num("cluster.minCustomers"), minSharePct: num("cluster.minSharePct") },
    };
    if (!(raw.bands.critical > raw.bands.high && raw.bands.high > raw.bands.moderate && raw.bands.moderate > 0)) {
      return { error: "Os limites das faixas devem ser crescentes: moderado < alto < crítico." };
    }
    const config: RiskConfig = normalizeRiskConfig(raw);
    const db = await getDb();
    await db
      .insert(schema.riskConfigs)
      .values({ providerId: user.providerId, config, updatedAt: new Date() })
      .onConflictDoUpdate({ target: schema.riskConfigs.providerId, set: { config, updatedAt: new Date() } });
    const result = await recalculateProvider(user.providerId);
    await audit(user, "Regras de risco alteradas", `Score recalculado para ${result.snapshots} clientes`);
    revalidatePath("/", "layout");
    return { ok: `Regras salvas e risco recalculado para ${result.snapshots} clientes.` };
  } catch (err) {
    const d = denied(err);
    if (d) return d;
    throw err;
  }
}

export async function resetRiskConfigAction(): Promise<FormState> {
  try {
    const user = await requireManager();
    const db = await getDb();
    await db.delete(schema.riskConfigs).where(eq(schema.riskConfigs.providerId, user.providerId));
    await recalculateProvider(user.providerId);
    await audit(user, "Regras de risco restauradas", "Configuração padrão");
    revalidatePath("/", "layout");
    return { ok: "Regras restauradas para o padrão e risco recalculado." };
  } catch (err) {
    const d = denied(err);
    if (d) return d;
    throw err;
  }
}
