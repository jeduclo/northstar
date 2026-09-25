"use client";

import {
  Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ReferenceArea, ReferenceLine,
  ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
import type { Country } from "@/lib/types";
import { type Horizon, type RotRow, rsKey } from "@/lib/rotation";
import { MARKET_COLOR, MARKET_NAME } from "./shared";

const tooltipStyle = {
  contentStyle: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, fontSize: 12 },
  labelStyle: { color: "var(--ink)" },
};
const fmt = (v: unknown) => (typeof v === "number" ? `${v >= 0 ? "+" : ""}${v.toFixed(1)} pts` : String(v));

/** Latest relative strength by sector, Canada and U.S. side by side. */
export function Leaderboard({ latest, markets, horizon }: { latest: RotRow[]; markets: Country[]; horizon: Horizon }) {
  const key = rsKey(horizon);
  const sectors = [...new Set(latest.filter((r) => r.sector !== "Benchmark").map((r) => r.sector))];
  const data = sectors
    .map((s) => {
      const row: Record<string, string | number | null> = { sector: s };
      for (const m of markets) row[m] = latest.find((r) => r.sector === s && r.market === m)?.[key] ?? null;
      return row;
    })
    .filter((r) => markets.some((m) => r[m] !== null))
    .sort((a, b) => {
      const avg = (r: Record<string, string | number | null>) => {
        const v = markets.map((m) => r[m]).filter((x): x is number => typeof x === "number");
        return v.reduce((x, y) => x + y, 0) / Math.max(v.length, 1);
      };
      return avg(b) - avg(a);
    });

  return (
    <div style={{ height: Math.max(220, data.length * (markets.length * 14 + 14)) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" horizontal={false} />
          <XAxis type="number" stroke="var(--muted)" fontSize={11} tickLine={false} />
          <YAxis type="category" dataKey="sector" stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} width={84} />
          <ReferenceLine x={0} stroke="var(--muted)" />
          <Tooltip formatter={(v, n) => [fmt(v), MARKET_NAME[n as Country] ?? String(n)]} {...tooltipStyle} />
          {markets.map((m) => (
            <Bar key={m} dataKey={m} fill={MARKET_COLOR[m]} barSize={10} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Rotation quadrant: 12-month trend (x) vs 3-month momentum (y). */
export function Quadrant({ latest, markets }: { latest: RotRow[]; markets: Country[] }) {
  const pts = latest.filter((r) => r.sector !== "Benchmark" && markets.includes(r.market)
    && r.rs_12m !== null && r.rs_3m !== null);
  const lim = Math.ceil(Math.max(5, ...pts.flatMap((r) => [Math.abs(r.rs_12m!), Math.abs(r.rs_3m!)])) * 1.15);
  const corner = (text: string, pos: "insideTopRight" | "insideTopLeft" | "insideBottomLeft" | "insideBottomRight") =>
    ({ value: text, position: pos, fill: "var(--muted)", fontSize: 11 });

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" />
          <ReferenceArea x1={0} x2={lim} y1={0} y2={lim} fill="transparent" label={corner("Leading", "insideTopRight")} />
          <ReferenceArea x1={-lim} x2={0} y1={0} y2={lim} fill="transparent" label={corner("Improving", "insideTopLeft")} />
          <ReferenceArea x1={-lim} x2={0} y1={-lim} y2={0} fill="transparent" label={corner("Lagging", "insideBottomLeft")} />
          <ReferenceArea x1={0} x2={lim} y1={-lim} y2={0} fill="transparent" label={corner("Weakening", "insideBottomRight")} />
          <ReferenceLine x={0} stroke="var(--muted)" />
          <ReferenceLine y={0} stroke="var(--muted)" />
          <XAxis type="number" dataKey="rs_12m" domain={[-lim, lim]} name="12-month" stroke="var(--muted)" fontSize={11} tickLine={false} />
          <YAxis type="number" dataKey="rs_3m" domain={[-lim, lim]} name="3-month" stroke="var(--muted)" fontSize={11} tickLine={false} width={48} />
          <ZAxis range={[60, 60]} />
          <Tooltip
            {...tooltipStyle}
            formatter={(v, n) => [fmt(v), `${n} relative strength`]}
            labelFormatter={() => ""}
          />
          {markets.map((m) => (
            <Scatter key={m} name={MARKET_NAME[m]} data={pts.filter((r) => r.market === m)} fill={MARKET_COLOR[m]} isAnimationActive={false}>
              <LabelList dataKey="sector" position="top" fontSize={10} fill="var(--ink)" />
            </Scatter>
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

/** 12-month relative strength over time for one sector, both markets. */
export function SectorHistory({ rows, sector, markets }: { rows: RotRow[]; sector: string; markets: Country[] }) {
  const months = [...new Set(rows.map((r) => r.month))].sort();
  const data = months.map((m) => {
    const row: Record<string, string | number | null> = { month: m };
    for (const mk of markets) row[mk] = rows.find((r) => r.month === m && r.market === mk && r.sector === sector)?.rs_12m ?? null;
    return row;
  });
  const tick = (iso: string) => {
    const [y, mo] = iso.split("-");
    return mo === "01" ? y : "";
  };
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="month" tickFormatter={tick} interval={0} stroke="var(--muted)" fontSize={11} tickLine={false} />
          <YAxis stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} width={48} />
          <ReferenceLine y={0} stroke="var(--muted)" />
          <Tooltip {...tooltipStyle} formatter={(v, n) => [fmt(v), MARKET_NAME[n as Country] ?? String(n)]} />
          {markets.map((m) => (
            <Line key={m} dataKey={m} stroke={MARKET_COLOR[m]} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
