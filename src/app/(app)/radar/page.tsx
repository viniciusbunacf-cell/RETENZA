import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq, ilike, inArray, isNotNull, or, sql, type SQL } from "drizzle-orm";
import { Search } from "lucide-react";
import { getDb, schema } from "@/db/client";
import {
  ActionStatusBadge,
  Card,
  EmptyState,
  GroupTag,
  PageHeader,
  RiskBadge,
  ScoreBar,
  cn,
} from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { formatInt, formatMoney, formatTenure } from "@/lib/format";
import { BAND_LABELS, GROUP_LABELS, GROUP_ORDER } from "@/lib/risk/config";
import type { RiskBand, SignalGroup } from "@/lib/risk/types";

export const metadata: Metadata = { title: "Radar de risco" };

const PAGE_SIZE = 25;
const BAND_FILTERS: { key: string; label: string; bands: RiskBand[] | null }[] = [
  { key: "todas", label: "Todos", bands: null },
  { key: "prioritario", label: "Alto + crítico", bands: ["critical", "high"] },
  { key: "critical", label: "Crítico", bands: ["critical"] },
  { key: "high", label: "Alto", bands: ["high"] },
  { key: "moderate", label: "Moderado", bands: ["moderate"] },
  { key: "low", label: "Baixo", bands: ["low"] },
];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function RadarPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const one = (key: string) => {
    const v = params[key];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  const bandKey = BAND_FILTERS.some((b) => b.key === one("faixa")) ? one("faixa") : "todas";
  const region = one("regiao");
  const cause = GROUP_ORDER.includes(one("causa") as SignalGroup) ? (one("causa") as SignalGroup) : "";
  const q = one("q").trim().slice(0, 80);
  const page = Math.max(1, Number.parseInt(one("pagina") || "1", 10) || 1);

  const db = await getDb();
  const base: SQL[] = [eq(schema.customers.providerId, user.providerId), eq(schema.customers.status, "active")];
  const filters: SQL[] = [...base];
  const bandFilter = BAND_FILTERS.find((b) => b.key === bandKey)!;
  if (bandFilter.bands) filters.push(inArray(schema.customers.riskBand, bandFilter.bands));
  if (region) filters.push(eq(schema.customers.region, region));
  if (cause) filters.push(eq(schema.customers.riskTopGroup, cause));
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
    const match = or(ilike(schema.customers.name, like), ilike(schema.customers.externalId, like));
    if (match) filters.push(match);
  }

  const [bandCounts, regionRows, totalRow, rows] = await Promise.all([
    db
      .select({ band: schema.customers.riskBand, n: sql<number>`count(*)::int` })
      .from(schema.customers)
      .where(and(...base))
      .groupBy(schema.customers.riskBand),
    db
      .selectDistinct({ region: schema.customers.region })
      .from(schema.customers)
      .where(and(...base, isNotNull(schema.customers.region)))
      .orderBy(asc(schema.customers.region)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.customers)
      .where(and(...filters)),
    db
      .select({
        id: schema.customers.id,
        externalId: schema.customers.externalId,
        name: schema.customers.name,
        planName: schema.customers.planName,
        fee: schema.customers.monthlyFeeCents,
        region: schema.customers.region,
        cto: schema.customers.cto,
        activatedAt: schema.customers.activatedAt,
        score: schema.customers.riskScore,
        band: schema.customers.riskBand,
        topGroup: schema.customers.riskTopGroup,
        factors: schema.customers.riskFactors,
        openActionStatus: sql<string | null>`(
          select a.status from action_customers ac join actions a on a.id = ac.action_id
           where ac.customer_id = "customers"."id" and a.status in ('pending', 'in_progress')
           order by a.created_at desc limit 1)`,
      })
      .from(schema.customers)
      .where(and(...filters))
      .orderBy(sql`${schema.customers.riskScore} desc nulls last`, desc(schema.customers.monthlyFeeCents), asc(schema.customers.name))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
  ]);

  const total = Number(totalRow[0]?.n ?? 0);
  const totalActive = bandCounts.reduce((s, b) => s + Number(b.n), 0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const countFor = (bands: RiskBand[] | null) =>
    bands === null
      ? totalActive
      : bandCounts.filter((b) => bands.includes(b.band as RiskBand)).reduce((s, b) => s + Number(b.n), 0);

  const href = (overrides: Record<string, string>) => {
    const next = new URLSearchParams();
    const merged = { faixa: bandKey, regiao: region, causa: cause, q, pagina: "1", ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v && !(k === "faixa" && v === "todas") && !(k === "pagina" && v === "1")) next.set(k, v);
    }
    const qs = next.toString();
    return qs ? `/radar?${qs}` : "/radar";
  };

  if (totalActive === 0) {
    return (
      <>
        <PageHeader title="Radar de risco" />
        <EmptyState
          title="Nenhum cliente ativo importado"
          description="Importe a base de assinantes para o radar classificar o risco de cada cliente."
          action={
            <Link href="/integracoes" className="btn-primary">
              Importar dados
            </Link>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Radar de risco"
        description="Cada cliente ativo é classificado pela combinação de sinais de rede, atendimento, financeiro e insatisfação. Clique em um cliente para ver os fatores e as evidências."
      />

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por faixa de risco">
        {BAND_FILTERS.map((b) => (
          <Link
            key={b.key}
            href={href({ faixa: b.key })}
            role="tab"
            aria-selected={b.key === bandKey}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              b.key === bandKey
                ? "border-ink bg-ink text-white"
                : "border-line-strong bg-white text-text-soft hover:bg-page",
            )}
          >
            {b.label}
            <span className={cn("ml-2 tabular-nums", b.key === bandKey ? "text-slate-300" : "text-text-muted")}>
              {formatInt(countFor(b.bands))}
            </span>
          </Link>
        ))}
      </div>

      <form method="get" action="/radar" className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_200px_200px_auto]">
        {bandKey !== "todas" ? <input type="hidden" name="faixa" value={bandKey} /> : null}
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-muted" aria-hidden="true" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome ou código do cliente"
            aria-label="Buscar cliente"
            className="input pl-9"
          />
        </div>
        <select name="regiao" defaultValue={region} aria-label="Região" className="input">
          <option value="">Todas as regiões</option>
          {regionRows.map((r) => (
            <option key={r.region} value={r.region ?? ""}>
              {r.region}
            </option>
          ))}
        </select>
        <select name="causa" defaultValue={cause} aria-label="Causa predominante" className="input">
          <option value="">Todas as causas</option>
          {GROUP_ORDER.map((g) => (
            <option key={g} value={g}>
              {GROUP_LABELS[g]}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-secondary">
          Filtrar
        </button>
      </form>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse">
            <thead className="border-b border-line bg-page/60">
              <tr>
                <th className="th">Cliente</th>
                <th className="th">Plano</th>
                <th className="th">Região</th>
                <th className="th">Relacionamento</th>
                <th className="th w-44">Risco</th>
                <th className="th">Principal fator</th>
                <th className="th">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((c) => {
                const band = (c.band ?? "low") as RiskBand;
                return (
                  <tr key={c.id} className="hover:bg-page/60">
                    <td className="td">
                      <Link href={`/clientes/${c.id}`} className="font-semibold text-text hover:text-brand-strong hover:underline">
                        {c.name}
                      </Link>
                      <p className="text-xs text-text-muted">Cód. {c.externalId}</p>
                    </td>
                    <td className="td">
                      <p className="text-text">{c.planName ?? "—"}</p>
                      <p className="text-xs text-text-muted">{formatMoney(c.fee)}/mês</p>
                    </td>
                    <td className="td">
                      <p className="text-text">{c.region ?? "—"}</p>
                      <p className="text-xs text-text-muted">{c.cto ?? ""}</p>
                    </td>
                    <td className="td whitespace-nowrap text-text-soft">{formatTenure(c.activatedAt)}</td>
                    <td className="td">
                      {c.band ? (
                        <div className="space-y-1.5">
                          <RiskBadge band={band} score={c.score} />
                          <ScoreBar score={c.score ?? 0} band={band} />
                        </div>
                      ) : (
                        <span className="text-text-muted">Sem score</span>
                      )}
                    </td>
                    <td className="td">
                      {c.factors && c.factors.length > 0 ? (
                        <div className="space-y-1">
                          <GroupTag group={c.topGroup} />
                          <p className="max-w-56 text-xs text-text-soft">
                            {c.factors[0].label}
                            {c.factors.length > 1 ? ` +${c.factors.length - 1}` : ""}
                          </p>
                        </div>
                      ) : (
                        <span className="text-text-muted">Sem sinais ativos</span>
                      )}
                    </td>
                    <td className="td">
                      {c.openActionStatus ? (
                        <ActionStatusBadge status={c.openActionStatus} />
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="td py-12 text-center text-text-muted">
                    Nenhum cliente encontrado com estes filtros.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm text-text-soft">
          <p>
            {formatInt(total)} {total === 1 ? "cliente" : "clientes"}
            {bandFilter.bands ? ` · ${bandFilter.bands.map((b) => BAND_LABELS[b].toLowerCase()).join(" + ")}` : ""}
          </p>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link href={href({ pagina: String(page - 1) })} className="btn-secondary">
                Anterior
              </Link>
            ) : null}
            <span className="tabular-nums">
              Página {Math.min(page, pages)} de {pages}
            </span>
            {page < pages ? (
              <Link href={href({ pagina: String(page + 1) })} className="btn-secondary">
                Próxima
              </Link>
            ) : null}
          </div>
        </div>
      </Card>
    </>
  );
}
