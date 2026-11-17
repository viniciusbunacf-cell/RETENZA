import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDownRight, ArrowLeft, ArrowUpRight, Minus } from "lucide-react";
import { assignActionAction, startActionAction } from "@/app/actions/retention";
import { SubmitButton } from "@/components/forms";
import { ActionStatusBadge, Card, CardHeader, GroupTag, Notice, PriorityTag, RiskBadge, cn } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { cap, segmentOf } from "@/lib/segments";
import { formatDateTime, formatInt, formatMoneyRound, formatRelative } from "@/lib/format";
import { getActionDetail } from "@/lib/retention/queries";
import type { RiskBand } from "@/lib/risk/types";
import { CancelForm, CompleteForm, NoteForm } from "./action-forms";

export const metadata: Metadata = { title: "Ação preventiva" };

const EVENT_LABELS: Record<string, string> = {
  created: "Ação criada",
  started: "Intervenção iniciada",
  completed: "Intervenção concluída",
  cancelled: "Ação cancelada",
  note: "Anotação",
  assigned: "Responsável alterado",
};
const OUTCOME: Record<string, string> = {
  resolved: "Problema resolvido",
  partial: "Resolvido parcialmente",
  not_resolved: "Não resolvido",
};

export default async function ActionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const seg = segmentOf(user.segment);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const action = await getActionDetail(user.providerId, id);
  if (!action) notFound();

  const now = new Date();
  const open = action.status === "pending" || action.status === "in_progress";
  const overdue = open && action.dueAt.getTime() < now.getTime();
  const members = action.customers;
  const stillActive = members.filter((c) => c.status !== "cancelled");
  const cancelledAfter = members.filter(
    (c) => c.status === "cancelled" && c.cancelledAt && c.cancelledAt.getTime() > action.createdAt.getTime(),
  );
  const withBoth = stillActive.filter((c) => c.scoreAtCreation !== null && c.scoreNow !== null);
  const avgBefore = withBoth.length ? withBoth.reduce((s, c) => s + (c.scoreAtCreation ?? 0), 0) / withBoth.length : null;
  const avgNow = withBoth.length ? withBoth.reduce((s, c) => s + (c.scoreNow ?? 0), 0) / withBoth.length : null;
  const mrr = members.reduce((s, c) => s + c.fee, 0);

  return (
    <>
      <Link href="/acoes" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-soft hover:text-text">
        <ArrowLeft size={15} aria-hidden="true" /> Central de ações
      </Link>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">
            Ação preventiva #{action.number} · {action.kind === "region" ? "Regional" : "Cliente"} ·{" "}
            {action.source === "auto" ? "gerada automaticamente" : "criada manualmente"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-text">{action.title}</h1>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <PriorityTag priority={action.priority} />
          <ActionStatusBadge status={action.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <div className="space-y-4 px-5 py-5">
              <div>
                <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">Problema identificado</p>
                <p className="mt-1 text-sm text-text">{action.problem}</p>
              </div>
              <div>
                <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">Recomendação</p>
                <p className="mt-1 text-sm text-text">{action.recommendation}</p>
              </div>
              {action.status === "done" && action.resolution ? (
                <div className="rounded-lg border border-keep/30 bg-keep-soft px-4 py-3">
                  <p className="text-xs font-semibold tracking-wide text-keep uppercase">
                    Solução registrada · {OUTCOME[action.outcome ?? ""] ?? "Concluída"}
                  </p>
                  <p className="mt-1 text-sm text-text">{action.resolution}</p>
                </div>
              ) : null}
            </div>
            <dl className="grid grid-cols-2 gap-px border-t border-line bg-line text-sm sm:grid-cols-4">
              {[
                ["Responsável", `${action.ownerTeam}${action.assigneeName ? ` · ${action.assigneeName}` : ""}`],
                [
                  "Prazo",
                  open
                    ? `${formatDateTime(action.dueAt)} (${overdue ? "vencido " : ""}${formatRelative(action.dueAt, now)})`
                    : formatDateTime(action.dueAt),
                ],
                ["Clientes impactados", formatInt(members.length)],
                ["Receita mensal envolvida", formatMoneyRound(mrr)],
              ].map(([k, v], i) => (
                <div key={k} className="bg-white px-5 py-3">
                  <dt className="text-xs text-text-muted">{k}</dt>
                  <dd className={cn("mt-0.5 font-medium text-text", i === 1 && overdue && "text-critical-ink")}>{v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {open ? (
            <Card>
              <CardHeader
                title={action.status === "pending" ? "Executar a intervenção" : "Registrar a solução"}
                description="O registro alimenta o histórico de intervenções e a medição de resultados."
              />
              <div className="space-y-5 px-5 py-5">
                {action.status === "pending" ? (
                  <form action={startActionAction} className="flex flex-wrap items-center gap-3">
                    <input type="hidden" name="actionId" value={action.id} />
                    <SubmitButton pendingLabel="Iniciando…">Iniciar intervenção</SubmitButton>
                    <span className="text-sm text-text-muted">Você passa a ser o responsável pela ação.</span>
                  </form>
                ) : null}
                <CompleteForm actionId={action.id} />
                <hr className="border-line" />
                <CancelForm actionId={action.id} />
              </div>
            </Card>
          ) : null}

          <Card className="overflow-hidden">
            <CardHeader
              title="Clientes impactados e evolução do risco"
              description="Score de cada cliente quando a ação foi criada e o score atual."
            />
            {members.length === 0 ? (
              <p className="px-5 py-8 text-sm text-text-muted">Nenhum cliente vinculado.</p>
            ) : (
              <>
                <div className="grid grid-cols-3 divide-x divide-line border-b border-line text-center">
                  <div className="px-2 py-3.5">
                    <p className="text-xl font-semibold text-text tabular-nums">
                      {avgBefore === null ? "—" : Math.round(avgBefore)}
                      <span className="mx-1.5 text-text-muted">→</span>
                      {avgNow === null ? "—" : Math.round(avgNow)}
                    </p>
                    <p className="text-xs text-text-muted">Score médio: na criação → hoje</p>
                  </div>
                  <div className="px-2 py-3.5">
                    <p className="text-xl font-semibold text-text tabular-nums">{stillActive.length}</p>
                    <p className="text-xs text-text-muted">Permanecem ativos</p>
                  </div>
                  <div className="px-2 py-3.5">
                    <p className="text-xl font-semibold text-text tabular-nums">{cancelledAfter.length}</p>
                    <p className="text-xs text-text-muted">Cancelaram depois da ação</p>
                  </div>
                </div>
                <div className="max-h-[420px] overflow-auto">
                  <table className="w-full min-w-[560px] border-collapse">
                    <thead className="sticky top-0 border-b border-line bg-page">
                      <tr>
                        <th className="th">Cliente</th>
                        <th className="th">{cap(seg.unit)}</th>
                        <th className="th">Na criação</th>
                        <th className="th">Hoje</th>
                        <th className="th">Variação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {members.map((c) => {
                        const cancelled = c.status === "cancelled";
                        const delta =
                          !cancelled && c.scoreNow !== null && c.scoreAtCreation !== null
                            ? c.scoreNow - c.scoreAtCreation
                            : null;
                        return (
                          <tr key={c.id}>
                            <td className="td">
                              <Link href={`/clientes/${c.id}`} className="font-medium text-text hover:text-brand-strong hover:underline">
                                {c.name}
                              </Link>
                            </td>
                            <td className="td text-text-soft">{c.cto ?? "—"}</td>
                            <td className="td">
                              <RiskBadge band={c.bandAtCreation as RiskBand | null} score={c.scoreAtCreation} />
                            </td>
                            <td className="td">
                              {cancelled ? (
                                <span className="text-sm font-medium text-text-soft">Cancelou</span>
                              ) : (
                                <RiskBadge band={c.bandNow as RiskBand | null} score={c.scoreNow} />
                              )}
                            </td>
                            <td className="td">
                              {delta === null ? (
                                <span className="text-text-muted">—</span>
                              ) : (
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 font-medium tabular-nums",
                                    delta < 0 ? "text-keep" : delta > 0 ? "text-critical-ink" : "text-text-soft",
                                  )}
                                >
                                  {delta < 0 ? <ArrowDownRight size={14} aria-hidden="true" /> : delta > 0 ? <ArrowUpRight size={14} aria-hidden="true" /> : <Minus size={14} aria-hidden="true" />}
                                  {delta > 0 ? "+" : ""}
                                  {delta}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Card>

          {action.status === "done" ? (
            <Notice>
              A queda do score após uma ação é um indício de que a causa foi tratada, não uma prova. A comparação com
              clientes semelhantes que não receberam intervenção está em{" "}
              <Link href="/indicadores" className="link">
                Indicadores de retenção
              </Link>
              .
            </Notice>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Responsável" />
            <form action={assignActionAction} className="flex items-end gap-2 px-5 py-4">
              <input type="hidden" name="actionId" value={action.id} />
              <div className="min-w-0 flex-1">
                <label htmlFor="assigneeId" className="label">
                  {action.ownerTeam}
                </label>
                <select id="assigneeId" name="assigneeId" defaultValue={action.assigneeId ?? ""} className="input" disabled={!open}>
                  <option value="">Sem responsável definido</option>
                  {action.team.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                      {u.team ? ` (${u.team})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              {open ? (
                <SubmitButton className="btn-secondary" pendingLabel="…">
                  Atribuir
                </SubmitButton>
              ) : null}
            </form>
            <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3 text-sm text-text-soft">
              Causa tratada: <GroupTag group={action.causeGroup} />
              {action.region ? <span>· {action.region}</span> : null}
            </div>
          </Card>

          <Card>
            <CardHeader title="Histórico da intervenção" />
            <ol className="px-5 py-4">
              {action.events.map((e, index) => (
                <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {index < action.events.length - 1 ? (
                    <span className="absolute top-3 bottom-0 left-[4.5px] w-px bg-line" aria-hidden="true" />
                  ) : null}
                  <span
                    className={cn(
                      "z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                      e.type === "completed" ? "bg-keep-vivid" : e.type === "cancelled" ? "bg-text-muted" : "bg-brand",
                    )}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text">{EVENT_LABELS[e.type] ?? e.type}</p>
                    <p className="text-xs text-text-muted">
                      {e.userName ?? "Sistema"} · {formatDateTime(e.createdAt)}
                    </p>
                    {e.note ? <p className="mt-1 text-sm whitespace-pre-line text-text-soft">{e.note}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
            <div className="border-t border-line px-5 py-4">
              <NoteForm actionId={action.id} />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
