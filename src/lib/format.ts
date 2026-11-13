const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brl0 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const int = new Intl.NumberFormat("pt-BR");
const TZ = "America/Sao_Paulo";
const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ });
const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TZ,
});
const shortFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: TZ });
const monthFmt = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" });

export const formatMoney = (cents: number) => brl.format(cents / 100);
export const formatMoneyRound = (cents: number) => brl0.format(cents / 100);
export const formatInt = (n: number) => int.format(n);
export const formatPct = (ratio: number, digits = 1) =>
  (ratio * 100).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits }) + "%";
export const formatDate = (d: Date | null | undefined) => (d ? dateFmt.format(d) : "—");
export const formatDateTime = (d: Date | null | undefined) => (d ? dateTimeFmt.format(d) : "—");
export const formatShortDate = (d: Date | null | undefined) => (d ? shortFmt.format(d).replace(".", "") : "—");
export const formatMonth = (d: Date) => monthFmt.format(d).replace(".", "").replace(" de ", "/");

export function formatTenure(activatedAt: Date | null | undefined, until: Date = new Date()): string {
  if (!activatedAt) return "—";
  const months = Math.max(0, Math.floor((until.getTime() - activatedAt.getTime()) / (30.44 * 86_400_000)));
  if (months < 1) return "menos de 1 mês";
  if (months < 12) return months + (months === 1 ? " mês" : " meses");
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest ? years + "a " + rest + "m" : years + (years === 1 ? " ano" : " anos");
}

export function formatRelative(d: Date | null | undefined, now: Date = new Date()): string {
  if (!d) return "—";
  const diffH = (d.getTime() - now.getTime()) / 3_600_000;
  const abs = Math.abs(diffH);
  const unit = abs < 1 ? "menos de 1 h" : abs < 48 ? Math.round(abs) + " h" : Math.round(abs / 24) + " dias";
  return diffH >= 0 ? "em " + unit : "há " + unit;
}
