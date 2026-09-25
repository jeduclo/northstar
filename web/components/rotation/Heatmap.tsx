"use client";

import type { Country } from "@/lib/types";
import { type Horizon, type RotRow, BENCHMARK_NAME, rsKey } from "@/lib/rotation";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const label = (iso: string) => {
  const [y, m] = iso.split("-").map(Number);
  return m === 1 ? `Jan ${String(y).slice(2)}` : MONTHS[m - 1];
};

/** Diverging fill: green when a sector beats its benchmark, red when it trails. */
function cellColor(v: number | null, scale: number) {
  if (v === null) return "transparent";
  const pct = Math.round(Math.min(Math.abs(v) / scale, 1) * 85) + 5;
  return `color-mix(in srgb, ${v >= 0 ? "var(--up)" : "var(--down)"} ${pct}%, transparent)`;
}

export default function Heatmap({ rows, market, horizon, months = 24 }: {
  rows: RotRow[]; market: Country; horizon: Horizon; months?: number;
}) {
  const key = rsKey(horizon);
  const mine = rows.filter((r) => r.market === market && r.sector !== "Benchmark");
  const allMonths = [...new Set(mine.map((r) => r.month))].sort().slice(-months);
  const latest = allMonths[allMonths.length - 1];
  const sectors = [...new Set(mine.map((r) => r.sector))].sort(
    (a, b) =>
      (mine.find((r) => r.sector === b && r.month === latest)?.[key] ?? -999)
      - (mine.find((r) => r.sector === a && r.month === latest)?.[key] ?? -999),
  );
  const cell = new Map(mine.map((r) => [`${r.sector}|${r.month}`, r[key]]));
  const values = mine.filter((r) => allMonths.includes(r.month)).map((r) => Math.abs(r[key] ?? 0));
  const scale = Math.max(5, [...values].sort((a, b) => a - b)[Math.floor(values.length * 0.9)] ?? 10);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0.5 text-xs">
        <caption className="sr-only">
          {horizon} relative strength vs the {BENCHMARK_NAME[market]}, percentage points, by sector and month
        </caption>
        <thead>
          <tr>
            <th className="sticky left-0 bg-surface pr-3 text-left font-normal text-muted">Sector</th>
            {allMonths.map((m, i) => (
              <th key={m} className="min-w-6 font-normal text-muted">
                {i % 3 === allMonths.length % 3 || i === allMonths.length - 1 ? label(m) : ""}
              </th>
            ))}
            <th className="pl-3 text-right font-normal text-muted">Latest</th>
          </tr>
        </thead>
        <tbody>
          {sectors.map((s) => {
            const last = cell.get(`${s}|${latest}`) ?? null;
            return (
              <tr key={s}>
                <th scope="row" className="sticky left-0 bg-surface pr-3 text-left font-medium whitespace-nowrap">{s}</th>
                {allMonths.map((m) => {
                  const v = cell.get(`${s}|${m}`) ?? null;
                  const txt = v === null ? "no data" : `${v >= 0 ? "+" : ""}${v.toFixed(1)} pts`;
                  return (
                    <td key={m} title={`${s}, ${m.slice(0, 7)}: ${txt}`} aria-label={`${s} ${m.slice(0, 7)} ${txt}`}
                      className="h-7 rounded-sm" style={{ background: cellColor(v, scale) }} />
                  );
                })}
                <td className={`pl-3 text-right tabular-nums ${last === null ? "" : last >= 0 ? "text-up" : "text-down"}`}>
                  {last === null ? "–" : `${last >= 0 ? "+" : "−"}${Math.abs(last).toFixed(1)}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
