"use client";

import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MacroForecast } from "@/lib/outlook";
import { toTime } from "@/lib/format";

const fmtTick = (t: number) => String(new Date(t).getUTCFullYear());
const fmtDay = (t: number) => new Date(t).toLocaleDateString("en-CA", { year: "numeric", month: "short", timeZone: "UTC" });

export default function ForecastCone({ f }: { f: MacroForecast }) {
  const color = f.country === "CA" ? "var(--ca)" : "var(--us)";
  const rows: Record<string, number | [number, number] | null>[] = f.history.map(([d, v]) => ({ t: toTime(d), actual: v }));
  // Join the median to the last actual so the cone starts at today's value
  const last = f.history.at(-1)!;
  rows[rows.length - 1] = { ...rows[rows.length - 1], median: last[1], band: [last[1], last[1]] };
  for (const [d, p10, p50, p90] of f.forecast) rows.push({ t: toTime(d), median: p50, band: [p10, p90] });

  const start = toTime(f.history[0][0]), end = toTime(f.forecast.at(-1)![0]), now = toTime(last[0]);
  const ticks: number[] = [];
  for (let y = new Date(start).getUTCFullYear() + 1; y <= new Date(end).getUTCFullYear(); y++) ticks.push(Date.UTC(y, 0, 1));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="t" type="number" scale="time" domain={[start, end]} ticks={ticks} tickFormatter={fmtTick}
            stroke="var(--muted)" fontSize={11} tickLine={false} />
          <YAxis domain={["auto", "auto"]} stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} width={48} />
          <ReferenceLine x={now} stroke="var(--muted)" strokeDasharray="3 3"
            label={{ value: "Forecast →", position: "insideTopLeft", fill: "var(--muted)", fontSize: 11 }} />
          <Tooltip
            labelFormatter={(t) => fmtDay(Number(t))}
            formatter={(v, n) => [
              Array.isArray(v) ? `${Number(v[0]).toFixed(2)} to ${Number(v[1]).toFixed(2)}` : Number(v).toFixed(2),
              n === "band" ? "80% range" : n === "median" ? "Median forecast" : "Actual",
            ]}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, fontSize: 12 }}
          />
          <Area dataKey="band" stroke="none" fill={color} fillOpacity={0.15} isAnimationActive={false} connectNulls />
          <Line dataKey="actual" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line dataKey="median" stroke={color} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
