"use client";

import { useMemo } from "react";
import {
  Bar, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { ChartSpec, Recession, Series } from "@/lib/types";
import { toTime } from "@/lib/format";
import { useControls } from "./Controls";
import { styleFor } from "./colors";

const YEARS = { "5Y": 5, "10Y": 10, MAX: 100 } as const;
const fmtTick = (t: number) => String(new Date(t).getUTCFullYear());
const fmtDay = (t: number) =>
  new Date(t).toLocaleDateString("en-CA", { year: "numeric", month: "short", timeZone: "UTC" });

export default function SeriesChart({ spec, series, recessions }: {
  spec: ChartSpec; series: Series[]; recessions: Recession[];
}) {
  const { country, range } = useControls();
  const shown = useMemo(
    () => series.filter((s) => country === "both" || s.country === country),
    [series, country],
  );
  const styles = styleFor(shown);

  const { rows, start, end } = useMemo(() => {
    const end = Math.max(...shown.map((s) => toTime(s.latest.date)));
    const startDate = new Date(end);
    startDate.setUTCFullYear(startDate.getUTCFullYear() - YEARS[range]);
    const dataStart = Math.min(...shown.map((s) => toTime(s.data[0]?.[0] ?? s.latest.date)));
    const start = Math.max(startDate.getTime(), dataStart);
    const byTime = new Map<number, Record<string, number>>();
    for (const s of shown) {
      for (const [d, v] of s.data) {
        const t = toTime(d);
        if (t < start) continue;
        const row = byTime.get(t) ?? { t };
        row[s.name] = v;
        byTime.set(t, row);
      }
    }
    return { rows: [...byTime.values()].sort((a, b) => a.t - b.t), start, end };
  }, [shown, range]);

  const countries = new Set(shown.map((s) => s.country));
  const shading = recessions.filter(
    (r) => countries.has(r.country) && toTime(r.end_date) >= start && toTime(r.start_date) <= end,
  );
  // One tick per year (every 2nd/4th year on longer ranges), placed on Jan 1
  const firstYear = new Date(start).getUTCFullYear() + 1;
  const lastYear = new Date(end).getUTCFullYear();
  const step = lastYear - firstYear > 12 ? 4 : lastYear - firstYear > 6 ? 2 : 1;
  const ticks: number[] = [];
  for (let y = firstYear; y <= lastYear; y += step) ticks.push(Date.UTC(y, 0, 1));
  const barSize = Math.max(2, Math.min(18, Math.floor(560 / Math.max(rows.length, 1) / shown.length)));

  return (
    <figure className="rounded-lg border border-line bg-surface p-4">
      <figcaption>
        <h3 className="font-medium">{spec.title}</h3>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {shown.map((s, i) => (
            <li key={s.name} className="flex items-center gap-1.5">
              <svg width="18" height="8" aria-hidden>
                <line x1="0" y1="4" x2="18" y2="4" stroke={styles[i].color} strokeWidth="2.5" strokeDasharray={styles[i].dash} />
              </svg>
              {s.country === "CA" ? "Canada" : "U.S."}: {s.description} ({s.unit})
            </li>
          ))}
          {spec.band && (
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-sm" style={{ background: "var(--band)" }} aria-hidden />
              {spec.bandLabel}
            </li>
          )}
        </ul>
      </figcaption>

      {shown.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">
          No {country === "CA" ? "Canadian" : "U.S."} series in this chart. Switch the country filter to see it.
        </p>
      ) : (
        <div className="mt-3 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" vertical={false} />
              {shading.map((r) => (
                <ReferenceArea key={`${r.country}-${r.start_date}`} x1={Math.max(toTime(r.start_date), start)}
                  x2={Math.min(toTime(r.end_date), end)} fill="var(--shade)" ifOverflow="hidden" />
              ))}
              {spec.band && (
                <ReferenceArea y1={spec.band[0]} y2={spec.band[1]} fill="var(--band)" ifOverflow="extendDomain" />
              )}
              {spec.zeroLine && <ReferenceLine y={0} stroke="var(--muted)" strokeWidth={1} />}
              <XAxis dataKey="t" type="number" scale="time" domain={[start, end]} ticks={ticks} tickFormatter={fmtTick}
                stroke="var(--muted)" fontSize={11} tickLine={false} />
              <YAxis domain={spec.yDomain ?? (spec.kind === "bar" ? undefined : ["auto", "auto"])} stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} width={48} />
              <Tooltip
                labelFormatter={(t) => fmtDay(Number(t))}
                formatter={(v, name) => [
                  typeof v === "number" ? v.toFixed(2) : String(v),
                  shown.find((s) => s.name === name)?.description ?? String(name),
                ]}
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, fontSize: 12 }}
                labelStyle={{ color: "var(--ink)" }}
              />
              {shown.map((s, i) =>
                spec.kind === "bar" ? (
                  <Bar key={s.name} dataKey={s.name} fill={styles[i].color} barSize={barSize} isAnimationActive={false} />
                ) : (
                  <Line key={s.name} dataKey={s.name} type={spec.kind === "step" ? "stepAfter" : "linear"}
                    stroke={styles[i].color} strokeDasharray={styles[i].dash} strokeWidth={2}
                    dot={false} connectNulls isAnimationActive={false} />
                ),
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
      {spec.note && <p className="mt-3 text-xs text-muted">{spec.note}</p>}
    </figure>
  );
}
