"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const INK = "#101828";
const MUTED = "#6b7686";
const GRID = "#e3e7ed";
const AXIS = "#cfd5de";
const SERIES_1 = "#2a78d6";
const SERIES_2 = "#eb6834";
const CRITICAL = "#d03b3b";
const HIGH = "#ec835a";

const tick = { fill: MUTED, fontSize: 12 };
const pct = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";

function TooltipBox({ title, rows }: { title: string; rows: { color: string; label: string; value: string }[] }) {
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-text">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2 text-text-soft">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: r.color }} />
          <span>{r.label}</span>
          <span className="ml-auto pl-3 font-semibold text-text tabular-nums">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

const legendFormatter = (value: string) => <span style={{ color: INK, fontSize: 12 }}>{value}</span>;

export interface ChurnChartPoint {
  label: string;
  voluntaryRate: number;
  involuntaryRate: number;
  voluntary: number;
  involuntary: number;
  base: number;
  partial: boolean;
}

/** Churn mensal: taxa voluntária x involuntária (% da base no início do mês). */
export function ChurnChart({ data }: { data: ChurnChartPoint[] }) {
  // Eixo com passos "redondos" (0,5 em 0,5 ponto percentual).
  const top = Math.max(1, Math.ceil(Math.max(...data.map((d) => Math.max(d.voluntaryRate, d.involuntaryRate))) * 2) / 2);
  const step = top <= 2 ? 0.5 : top <= 4 ? 1 : Math.ceil(top / 4);
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 10) / 10);
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="28%">
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={{ stroke: AXIS }} interval="preserveStartEnd" />
          <YAxis
            tick={tick}
            tickLine={false}
            axisLine={false}
            domain={[0, ticks[ticks.length - 1]]}
            ticks={ticks}
            tickFormatter={(v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%"}
            width={52}
          />
          <Tooltip
            cursor={{ fill: "#f4f6f8" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as ChurnChartPoint;
              return (
                <TooltipBox
                  title={`${p.label}${p.partial ? " (mês em andamento)" : ""} · base ${p.base.toLocaleString("pt-BR")}`}
                  rows={[
                    { color: SERIES_1, label: "Voluntário", value: `${pct(p.voluntaryRate)} (${p.voluntary})` },
                    { color: SERIES_2, label: "Involuntário", value: `${pct(p.involuntaryRate)} (${p.involuntary})` },
                  ]}
                />
              );
            }}
          />
          <Legend verticalAlign="top" align="right" iconType="circle" iconSize={8} height={28} formatter={legendFormatter} itemSorter={null} />
          <Bar dataKey="voluntaryRate" name="Voluntário" fill={SERIES_1} radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={false} />
          <Bar dataKey="involuntaryRate" name="Involuntário" fill={SERIES_2} radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface RiskTrendChartPoint {
  label: string;
  critical: number;
  high: number;
}

/** Evolução semanal dos clientes em risco alto e crítico. */
export function RiskTrendChart({ data }: { data: RiskTrendChartPoint[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={{ stroke: AXIS }} minTickGap={24} />
          <YAxis tick={tick} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
          <Tooltip
            cursor={{ stroke: AXIS }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as RiskTrendChartPoint;
              return (
                <TooltipBox
                  title={`Semana de ${p.label}`}
                  rows={[
                    { color: CRITICAL, label: "Risco crítico", value: String(p.critical) },
                    { color: HIGH, label: "Risco alto", value: String(p.high) },
                  ]}
                />
              );
            }}
          />
          <Legend verticalAlign="top" align="right" iconType="circle" iconSize={8} height={28} formatter={legendFormatter} itemSorter={null} />
          <Line type="monotone" dataKey="critical" name="Risco crítico" stroke={CRITICAL} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
          <Line type="monotone" dataKey="high" name="Risco alto" stroke={HIGH} strokeWidth={2} strokeDasharray="5 3" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface SingleLinePoint {
  label: string;
  value: number;
}

/** Série única (ex.: score de um cliente ou score médio de uma região) com limites de faixa opcionais. */
export function ScoreLineChart({
  data,
  seriesName,
  thresholds,
  domainMax = 100,
  height = 220,
}: {
  data: SingleLinePoint[];
  seriesName: string;
  thresholds?: { value: number; label: string }[];
  domainMax?: number | "auto";
  height?: number;
}) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 56, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={{ stroke: AXIS }} minTickGap={24} />
          <YAxis tick={tick} tickLine={false} axisLine={false} domain={[0, domainMax]} allowDecimals={false} width={44} />
          {(thresholds ?? []).map((t) => (
            <ReferenceLine
              key={t.label}
              y={t.value}
              stroke={AXIS}
              strokeDasharray="4 4"
              label={{ value: t.label, position: "right", fill: MUTED, fontSize: 11 }}
            />
          ))}
          <Tooltip
            cursor={{ stroke: AXIS }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as SingleLinePoint;
              return (
                <TooltipBox
                  title={p.label}
                  rows={[
                    {
                      color: SERIES_1,
                      label: seriesName,
                      value: p.value.toLocaleString("pt-BR", { maximumFractionDigits: 1 }),
                    },
                  ]}
                />
              );
            }}
          />
          <Line type="monotone" dataKey="value" name={seriesName} stroke={SERIES_1} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
