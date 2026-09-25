"use client";

import type { Country } from "@/lib/types";
import { MARKET_COLOR } from "../rotation/shared";

export interface RangeRow {
  key: string;
  label: string;
  market: Country;
  low: number;
  mid: number;
  high: number;
  shifted?: number;      // scenario-adjusted midpoint
  dim?: boolean;         // e.g. not statistically significant
}

const fmt = (v: number, d = 1) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(d)}`;

/** Dot-and-whisker rows on a shared axis with a zero line. Used for effects and return ranges. */
export default function RangeRows({ rows, unit, digits = 1 }: { rows: RangeRow[]; unit: string; digits?: number }) {
  if (!rows.length) return <p className="py-10 text-center text-sm text-muted">No sectors for this country filter.</p>;
  const vals = rows.flatMap((r) => [r.low, r.high, r.shifted ?? r.mid, 0]);
  const lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo) * 0.06 || 1;
  const min = lo - pad, max = hi + pad;
  const x = (v: number) => `${((v - min) / (max - min)) * 100}%`;

  return (
    <div className="text-xs">
      {rows.map((r) => (
        <div key={r.key} className="grid grid-cols-[7.5rem_1fr_4.5rem] items-center gap-2 py-1">
          <span className="truncate" title={r.label}>{r.label}</span>
          <div className="relative h-5" aria-label={`${r.label}: ${fmt(r.mid, digits)}${unit}, range ${fmt(r.low, digits)} to ${fmt(r.high, digits)}`}>
            <div className="absolute inset-y-0 w-px bg-muted/60" style={{ left: x(0) }} />
            <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
              style={{ left: x(Math.min(r.low, r.high)), width: `calc(${x(Math.max(r.low, r.high))} - ${x(Math.min(r.low, r.high))})`,
                background: MARKET_COLOR[r.market], opacity: r.dim ? 0.3 : 0.45 }} />
            <div className="absolute top-1/2 h-3.5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-sm"
              style={{ left: x(r.mid), background: MARKET_COLOR[r.market], opacity: r.dim ? 0.55 : 1 }} />
            {r.shifted !== undefined && r.shifted !== r.mid && (
              <div className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 bg-surface"
                style={{ left: x(r.shifted), borderColor: MARKET_COLOR[r.market] }} />
            )}
          </div>
          <span className="text-right tabular-nums">{fmt(r.shifted ?? r.mid, digits)}{unit}</span>
        </div>
      ))}
      <div className="grid grid-cols-[7.5rem_1fr_4.5rem] gap-2 pt-1 text-muted">
        <span />
        <div className="relative h-4">
          {[min, 0, max].map((v, i) => (
            <span key={i} className="absolute -translate-x-1/2 tabular-nums" style={{ left: x(v) }}>{i === 1 ? "0" : fmt(v, digits)}</span>
          ))}
        </div>
        <span />
      </div>
    </div>
  );
}
