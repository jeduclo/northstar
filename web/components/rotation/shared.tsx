"use client";

import type { ReactNode } from "react";
import type { Horizon } from "@/lib/rotation";

export const MARKET_COLOR = { CA: "var(--ca)", US: "var(--us)" } as const;
export const MARKET_NAME = { CA: "Canada", US: "U.S." } as const;

export function Panel({ title, legend, note, children, wide = false }: {
  title: string; legend?: ReactNode; note?: string; children: ReactNode; wide?: boolean;
}) {
  return (
    <figure className={`rounded-lg border border-line bg-surface p-4 ${wide ? "lg:col-span-2" : ""}`}>
      <figcaption>
        <h3 className="font-medium">{title}</h3>
        {legend && <div className="mt-2 text-xs text-muted">{legend}</div>}
      </figcaption>
      <div className="mt-3">{children}</div>
      {note && <p className="mt-3 text-xs text-muted">{note}</p>}
    </figure>
  );
}

export function HorizonPicker({ value, onChange }: { value: Horizon; onChange: (h: Horizon) => void }) {
  const opts: { v: Horizon; label: string }[] = [
    { v: "3m", label: "3 months" }, { v: "6m", label: "6 months" }, { v: "12m", label: "12 months" },
  ];
  return (
    <div role="radiogroup" aria-label="Return horizon" className="inline-flex rounded-md border border-line bg-surface p-0.5 text-sm">
      {opts.map((o) => (
        <button key={o.v} role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)}
          className={`rounded px-3 py-1 transition-colors ${value === o.v ? "bg-ink text-surface" : "text-muted hover:text-ink"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function MarketKey({ markets, suffix = " sector ETFs" }: { markets: ("CA" | "US")[]; suffix?: string }) {
  return (
    <span className="flex flex-wrap gap-x-4">
      {markets.map((m) => (
        <span key={m} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: MARKET_COLOR[m] }} aria-hidden />
          {MARKET_NAME[m]}{suffix}
        </span>
      ))}
    </span>
  );
}
