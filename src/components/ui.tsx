import Link from "next/link";
import type { ReactNode } from "react";
import { AlertOctagon, AlertTriangle, CircleCheck, Eye, Info } from "lucide-react";
import { BAND_LABELS, GROUP_LABELS } from "@/lib/risk/config";
import type { RiskBand, SignalGroup } from "@/lib/risk/types";

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function Logo({ light = false, className }: { light?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <rect width="28" height="28" rx="7" fill="#0d8f84" />
        <path
          d="M8 20V8h6.2a3.9 3.9 0 0 1 1.5 7.5L19.5 20h-3.2l-3.2-4H10.8v4H8Zm2.8-6.4h3.1a1.5 1.5 0 0 0 0-3h-3.1v3Z"
          fill="#fff"
        />
      </svg>
      <span className={cn("text-[17px] font-semibold tracking-[0.14em]", light ? "text-white" : "text-ink")}>
        RETENZA
      </span>
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-text">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm text-text-soft">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("card", className)}>{children}</section>;
}

export function CardHeader({
  title,
  description,
  right,
}: {
  title: string;
  description?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-text">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-text-soft">{description}</p> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = "default",
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "critical" | "warning" | "good";
  href?: string;
}) {
  const accent =
    tone === "critical"
      ? "border-l-critical"
      : tone === "warning"
        ? "border-l-high"
        : tone === "good"
          ? "border-l-low"
          : "border-l-line-strong";
  const body = (
    <div className={cn("card h-full border-l-4 px-4 py-3.5", accent, href && "transition-shadow hover:shadow-sm")}>
      <p className="text-sm text-text-soft">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-text">{value}</p>
      {hint ? <p className="mt-1 text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-xl focus-visible:outline-2 focus-visible:outline-brand">
      {body}
    </Link>
  ) : (
    body
  );
}

const BAND_STYLE: Record<RiskBand, { cls: string; dot: string; Icon: typeof Eye }> = {
  critical: { cls: "bg-critical-soft text-critical-ink", dot: "bg-critical", Icon: AlertOctagon },
  high: { cls: "bg-high-soft text-high-ink", dot: "bg-high", Icon: AlertTriangle },
  moderate: { cls: "bg-moderate-soft text-moderate-ink", dot: "bg-moderate", Icon: Eye },
  low: { cls: "bg-low-soft text-low-ink", dot: "bg-low", Icon: CircleCheck },
};

export function RiskBadge({ band, score }: { band: RiskBand | null | undefined; score?: number | null }) {
  if (!band) return <span className="text-sm text-text-muted">Sem score</span>;
  const style = BAND_STYLE[band];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", style.cls)}>
      <style.Icon size={13} aria-hidden="true" />
      {BAND_LABELS[band]}
      {score !== undefined && score !== null ? <span className="font-bold tabular-nums">{score}</span> : null}
    </span>
  );
}

export function bandDotClass(band: RiskBand): string {
  return BAND_STYLE[band].dot;
}

/** Barra de 0 a 100 com a cor da faixa de risco. */
export function ScoreBar({ score, band }: { score: number; band: RiskBand }) {
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-page"
      role="img"
      aria-label={`Score de risco ${score} de 100`}
    >
      <div className={cn("h-full rounded-full", BAND_STYLE[band].dot)} style={{ width: `${Math.max(2, score)}%` }} />
    </div>
  );
}

export function GroupTag({ group }: { group: SignalGroup | string | null | undefined }) {
  if (!group) return <span className="text-text-muted">—</span>;
  return (
    <span className="inline-flex rounded-md border border-line bg-page px-2 py-0.5 text-xs font-medium text-text-soft">
      {GROUP_LABELS[group as SignalGroup] ?? group}
    </span>
  );
}

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-moderate-soft text-moderate-ink" },
  in_progress: { label: "Em andamento", cls: "bg-[#e3eefb] text-[#174a86]" },
  done: { label: "Concluída", cls: "bg-low-soft text-low-ink" },
  cancelled: { label: "Cancelada", cls: "bg-page text-text-soft" },
};

export function ActionStatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, cls: "bg-page text-text-soft" };
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", s.cls)}>{s.label}</span>;
}

const PRIORITY: Record<string, { label: string; cls: string }> = {
  critical: { label: "Prioridade crítica", cls: "border-critical/40 text-critical-ink" },
  high: { label: "Prioridade alta", cls: "border-high/50 text-high-ink" },
  medium: { label: "Prioridade média", cls: "border-line-strong text-text-soft" },
};

export function PriorityTag({ priority }: { priority: string }) {
  const p = PRIORITY[priority] ?? PRIORITY.medium;
  return (
    <span className={cn("inline-flex rounded-md border bg-white px-2 py-0.5 text-xs font-semibold", p.cls)}>
      {p.label}
    </span>
  );
}

export function Notice({
  children,
  tone = "info",
  className,
}: {
  children: ReactNode;
  tone?: "info" | "warning";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-2.5 rounded-lg border px-3.5 py-3 text-sm",
        tone === "warning" ? "border-moderate/50 bg-moderate-soft text-moderate-ink" : "border-line bg-page text-text-soft",
        className,
      )}
    >
      <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <h2 className="text-lg font-semibold text-text">{title}</h2>
      {description ? <p className="mt-2 max-w-xl text-sm text-text-soft">{description}</p> : null}
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}
