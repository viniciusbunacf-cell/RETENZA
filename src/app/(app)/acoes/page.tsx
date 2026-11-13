import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, User } from "lucide-react";
import { ActionStatusBadge, Card, GroupTag, PageHeader, PriorityTag, StatTile, cn } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime, formatRelative } from "@/lib/format";
import { getActionCounts } from "@/lib/metrics/dashboard";
import { listActions, type ActionStatus } from "@/lib/retention/queries";

export const metadata: Metadata = { title: "Central de ações" };

const TABS: { key: string; label: string; statuses: ActionStatus[]; order: "due" | "recent" }[] = [
  { key: "abertas", label: "Em aberto", statuses: ["pending", "in_progress"], order: "due" },
  { key: "concluidas", label: "Concluídas", statuses: ["done"], order: "recent" },
  { key: "canceladas", label: "Canceladas", statuses: ["cancelled"], order: "recent" },
];

const OUTCOME: Record<string, string> = {
  resolved: "Problema resolvido",
  partial: "Resolvido parcialmente",
  not_resolved: "Não resolvido",
};

export default async function ActionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const tabKey = typeof params.status === "string" ? params.status : "abertas";
  const tab = TABS.find((t) => t.key === tabKey) ?? TABS[0];
  const now = new Date();
  const [counts, actions] = await Promise.all([
    getActionCounts(user.providerId, now),
    listActions(user.providerId, { statuses: tab.statuses, order: tab.order, limit: 100 }),
  ]);

  return (
    <>
      <PageHeader
        title="Central de ações preventivas"
        description="Cada alerta vira uma ação com recomendação, responsável e prazo. Registre o que foi feito: é o histórico de intervenções que permite medir o que realmente funciona."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Pendentes" value={counts.pending} hint="Aguardando início" />
        <StatTile label="Em andamento" value={counts.inProgress} />
        <StatTile
          label="Com prazo vencido"
          value={counts.overdue}
          tone={counts.overdue ? "critical" : "default"}
          hint="Em aberto além do prazo"
        />
        <StatTile label="Concluídas em 30 dias" value={counts.done30d} tone="good" />
      </div>

      <div className="mt-5 mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Situação das ações">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "abertas" ? "/acoes" : `/acoes?status=${t.key}`}
            role="tab"
            aria-selected={t.key === tab.key}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              t.key === tab.key ? "border-ink bg-ink text-white" : "border-line-strong bg-white text-text-soft hover:bg-page",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {actions.length === 0 ? (
        <Card className="px-6 py-14 text-center">
          <p className="text-sm text-text-muted">
            {tab.key === "abertas"
              ? "Nenhuma ação em aberto. Novas ações são geradas quando o risco é recalculado."
              : "Nenhuma ação nesta situação."}
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {actions.map((a) => {
            const open = a.status === "pending" || a.status === "in_progress";
            const overdue = open && a.dueAt.getTime() < now.getTime();
            return (
              <li key={a.id}>
                <Link
                  href={`/acoes/${a.id}`}
                  className={cn(
                    "card block border-l-4 px-5 py-4 transition-shadow hover:shadow-sm",
                    !open
                      ? "border-l-line-strong"
                      : a.priority === "critical"
                        ? "border-l-critical"
                        : a.priority === "high"
                          ? "border-l-high"
                          : "border-l-moderate",
                  )}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">
                        Ação preventiva #{a.number} · {a.kind === "region" ? "Regional" : "Cliente"}
                      </p>
                      <p className="mt-0.5 text-base font-semibold text-text">{a.title}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-text-soft">
                        <span className="inline-flex items-center gap-1.5">
                          <User size={14} aria-hidden="true" />
                          {a.ownerTeam}
                          {a.assigneeName ? ` · ${a.assigneeName}` : ""}
                        </span>
                        {a.region ? (
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin size={14} aria-hidden="true" />
                            {a.region}
                          </span>
                        ) : null}
                        <span>
                          {a.impacted} {a.impacted === 1 ? "cliente impactado" : "clientes impactados"}
                        </span>
                        <GroupTag group={a.causeGroup} />
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-row flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                      <ActionStatusBadge status={a.status} />
                      {open ? <PriorityTag priority={a.priority} /> : null}
                      <p className={cn("text-xs", overdue ? "font-semibold text-critical-ink" : "text-text-muted")}>
                        {open
                          ? `Prazo ${overdue ? "vencido " : ""}${formatRelative(a.dueAt, now)}`
                          : a.status === "done"
                            ? `${OUTCOME[a.outcome ?? ""] ?? "Concluída"} · ${formatDateTime(a.completedAt)}`
                            : `Criada em ${formatDateTime(a.createdAt)}`}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {actions.length === 100 ? (
        <p className="mt-3 text-xs text-text-muted">Mostrando as 100 ações mais recentes desta situação.</p>
      ) : null}
    </>
  );
}
