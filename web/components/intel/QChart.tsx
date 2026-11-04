"use client";

import { useMemo } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, LineChart, ReferenceArea, ReferenceLine,
  ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
import type { ChartData } from "@/lib/intel-types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtMonth = (t: number) => { const d = new Date(t); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const fmtYear = (t: number) => String(new Date(t).getUTCFullYear());
const fmtV = (v: unknown) => (typeof v === "number" ? v.toLocaleString("en-CA", { maximumFractionDigits: 2 }) : String(v ?? "–"));

const tooltipStyle = {
  contentStyle: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, fontSize: 12, color: "var(--ink)" },
  labelStyle: { color: "var(--ink)", fontWeight: 500 },
  itemStyle: { color: "var(--ink)", padding: 0 },
};
const axis = { stroke: "var(--muted)", fontSize: 11, tickLine: false } as const;

function Swatch({ color, dash, square }: { color: string; dash?: string; square?: boolean }) {
  return square ? (
    <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} aria-hidden />
  ) : (
    <svg width="18" height="8" aria-hidden><line x1="0" y1="4" x2="18" y2="4" stroke={color} strokeWidth="2.5" strokeDasharray={dash} /></svg>
  );
}

function Legend({ items }: { items: { label: string; color: string; dash?: string; square?: boolean }[] }) {
  if (items.length < 2) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5"><Swatch color={i.color} dash={i.dash} square={i.square} />{i.label}</li>
      ))}
    </ul>
  );
}

function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-2 text-xs text-muted">
      <summary className="cursor-pointer select-none hover:text-ink">Data table</summary>
      <div className="mt-2 max-h-56 overflow-auto">
        <table className="w-full text-left tabular-nums">
          <thead><tr>{head.map((h) => <th key={h} className="sticky top-0 bg-surface py-1 pr-3 font-medium">{h}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-line">{r.map((c, j) => <td key={j} className="py-1 pr-3">{fmtV(c)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </details>
  );
}

function TimeChart({ chart }: { chart: Extract<ChartData, { kind: "line" | "bar" }> }) {
  const { rows, start, end, ticks } = useMemo(() => {
    const byT = new Map<number, Record<string, number>>();
    for (const s of chart.series) for (const [t, v] of s.data) {
      const r = byT.get(t) ?? { t };
      r[s.key] = v;
      byT.set(t, r);
    }
    const rows = [...byT.values()].sort((a, b) => a.t - b.t);
    const start = rows[0]?.t ?? 0, end = rows.at(-1)?.t ?? 0;
    const y0 = new Date(start).getUTCFullYear() + 1, y1 = new Date(end).getUTCFullYear();
    const step = y1 - y0 > 12 ? 4 : y1 - y0 > 6 ? 2 : 1;
    const ticks: number[] = [];
    for (let y = y0; y <= y1; y += step) ticks.push(Date.UTC(y, 0, 1));
    return { rows, start, end, ticks };
  }, [chart]);
  const label = Object.fromEntries(chart.series.map((s) => [s.key, s.label]));
  const barSize = Math.max(2, Math.min(14, Math.floor(520 / Math.max(rows.length, 1) / chart.series.length)));
  return (
    <>
      <Legend items={[
        ...chart.series.map((s) => ({ label: s.label, color: s.color, dash: s.dash, square: chart.kind === "bar" })),
        ...(chart.band ? [{ label: chart.bandLabel ?? "Target", color: "var(--band)", square: true }] : []),
        ...(chart.recessions?.length ? [{ label: "Recession", color: "var(--shade)", square: true }] : []),
      ]} />
      <div className="mt-2 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 6, right: 10, bottom: 0, left: -10 }}>
            <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" vertical={false} />
            {chart.recessions?.map(([a, b]) => <ReferenceArea key={a} x1={a} x2={Math.min(b, end)} fill="var(--shade)" ifOverflow="hidden" />)}
            {chart.band && <ReferenceArea y1={chart.band[0]} y2={chart.band[1]} fill="var(--band)" ifOverflow="extendDomain" />}
            {chart.zero && <ReferenceLine y={0} stroke="var(--muted)" />}
            {chart.ref && <ReferenceLine y={chart.ref.y} stroke="var(--muted)" strokeDasharray="4 3"
              label={{ value: chart.ref.label, position: "insideTopLeft", fontSize: 11, fill: "var(--muted)" }} />}
            <XAxis dataKey="t" type="number" scale="time" domain={[start, end]} ticks={ticks} tickFormatter={fmtYear} {...axis} />
            <YAxis domain={chart.kind === "bar" ? undefined : ["auto", "auto"]} axisLine={false} width={50} {...axis}
              tickFormatter={(v: number) => fmtV(v)} />
            <Tooltip {...tooltipStyle} labelFormatter={(t) => fmtMonth(Number(t))}
              formatter={(v, k) => [`${fmtV(v)} ${chart.unit === "index" || chart.unit === "ratio" ? "" : chart.unit}`, label[String(k)] ?? String(k)]} />
            {chart.series.map((s) => chart.kind === "bar"
              ? <Bar key={s.key} dataKey={s.key} fill={s.color} barSize={barSize} radius={[2, 2, 0, 0]} isAnimationActive={false} />
              : <Line key={s.key} dataKey={s.key} type={chart.step ? "stepAfter" : "linear"} stroke={s.color} strokeDasharray={s.dash}
                  strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />)}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <DataTable head={["Date", ...chart.series.map((s) => s.label)]}
        rows={rows.slice(-24).reverse().map((r) => [fmtMonth(r.t), ...chart.series.map((s) => r[s.key] ?? "–")])} />
    </>
  );
}

function CurveChart({ chart }: { chart: Extract<ChartData, { kind: "curve" }> }) {
  const tenors = [...new Map(chart.series.flatMap((s) => s.points.map((p) => [p.tenor, p.years] as const))).entries()].sort((a, b) => a[1] - b[1]).map(([t]) => t);
  const rows = tenors.map((tenor) => ({ tenor, ...Object.fromEntries(chart.series.map((s) => [s.key, s.points.find((p) => p.tenor === tenor)?.y])) }));
  const label = Object.fromEntries(chart.series.map((s) => [s.key, s.label]));
  return (
    <>
      <Legend items={chart.series.map((s) => ({ label: s.label, color: s.color, dash: s.dash }))} />
      <div className="mt-2 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 6, right: 10, bottom: 0, left: -10 }}>
            <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="tenor" {...axis} />
            <YAxis domain={["auto", "auto"]} axisLine={false} width={50} {...axis} tickFormatter={(v: number) => `${v}%`} />
            <Tooltip {...tooltipStyle} formatter={(v, k) => [`${fmtV(v)}%`, label[String(k)]]} />
            {chart.series.map((s) => (
              <Line key={s.key} dataKey={s.key} stroke={s.color} strokeDasharray={s.dash} strokeWidth={2} connectNulls isAnimationActive={false}
                dot={{ r: 4, fill: "var(--surface)", stroke: s.color, strokeWidth: 2 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <DataTable head={["Maturity", ...chart.series.map((s) => s.label)]} rows={rows.map((r) => [r.tenor, ...chart.series.map((s) => (r as Record<string, unknown>)[s.key] as number ?? "–")])} />
    </>
  );
}

function ScatterView({ chart }: { chart: Extract<ChartData, { kind: "scatter" }> }) {
  return (
    <>
      <Legend items={[...chart.groups.map((g) => ({ label: g.label, color: g.color, square: true })), ...(chart.latest ? [{ label: "Latest month", color: "var(--ink)", square: true }] : [])]} />
      <div className="mt-2 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 6, right: 10, bottom: 18, left: -4 }}>
            <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" />
            <XAxis dataKey="x" type="number" domain={["auto", "auto"]} name={chart.xLabel} {...axis}
              label={{ value: chart.xLabel, position: "insideBottom", offset: -10, fontSize: 11, fill: "var(--muted)" }} />
            <YAxis dataKey="y" type="number" domain={["auto", "auto"]} name={chart.yLabel} axisLine={false} width={46} {...axis} />
            <ZAxis range={[28, 28]} />
            <Tooltip {...tooltipStyle} cursor={{ strokeDasharray: "3 3" }}
              content={({ payload }) => {
                const p = payload?.[0]?.payload as { x: number; y: number; date: string } | undefined;
                return p ? <div style={tooltipStyle.contentStyle} className="px-2 py-1">{p.date.slice(0, 7)}<br />Unemployment {p.x}% · inflation {p.y}%</div> : null;
              }} />
            {chart.groups.map((g) => <Scatter key={g.key} name={g.label} data={g.points} fill={g.color} fillOpacity={0.75} isAnimationActive={false} />)}
            {chart.latest && <Scatter name="Latest" data={[chart.latest]} fill="var(--ink)" shape="star" isAnimationActive={false} />}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted">Vertical axis: {chart.yLabel}.</p>
      <DataTable head={["Month", "Unemployment", "Core inflation"]}
        rows={chart.groups.flatMap((g) => g.points).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 36).map((p) => [p.date.slice(0, 7), p.x, p.y])} />
    </>
  );
}

function HBar({ chart }: { chart: Extract<ChartData, { kind: "hbar" }> }) {
  const groups = [...new Map(chart.rows.filter((r) => r.group).map((r) => [r.group!, r.color])).entries()];
  const h = Math.max(160, chart.rows.length * 26 + 30);
  return (
    <>
      <Legend items={[...groups.map(([g, c]) => ({ label: g, color: c, square: true })), ...(chart.ref ? [{ label: chart.ref.label, color: "var(--muted)", dash: "4 3" }] : [])]} />
      <div className="mt-2" style={{ height: h }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart.rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 4 }}>
            <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" horizontal={false} />
            <XAxis type="number" {...axis} tickFormatter={(v: number) => `${v}%`} />
            <YAxis type="category" dataKey="label" width={118} axisLine={false} {...axis} interval={0} />
            <ReferenceLine x={0} stroke="var(--muted)" />
            {chart.ref && <ReferenceLine x={chart.ref.value} stroke="var(--muted)" strokeDasharray="4 3" />}
            <Tooltip {...tooltipStyle} cursor={{ fill: "var(--shade)" }} formatter={(v) => [`${fmtV(v)}%`, "Return"]} />
            <Bar dataKey="value" barSize={14} radius={4} isAnimationActive={false}>
              {chart.rows.map((r) => <Cell key={r.label} fill={r.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTable head={["", "Value (%)"]} rows={chart.rows.map((r) => [r.label, r.value])} />
    </>
  );
}

export default function QChart({ chart }: { chart: ChartData }) {
  switch (chart.kind) {
    case "line":
    case "bar":
      return <TimeChart chart={chart} />;
    case "curve":
      return <CurveChart chart={chart} />;
    case "scatter":
      return <ScatterView chart={chart} />;
    case "hbar":
      return <HBar chart={chart} />;
  }
}
