"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type CountryFilter = "both" | "CA" | "US";
export type Range = "5Y" | "10Y" | "MAX";

interface Controls {
  country: CountryFilter;
  range: Range;
  setCountry: (c: CountryFilter) => void;
  setRange: (r: Range) => void;
}

const Ctx = createContext<Controls | null>(null);

export function ControlsProvider({ children }: { children: ReactNode }) {
  const [country, setCountry] = useState<CountryFilter>("both");
  const [range, setRange] = useState<Range>("5Y");
  return <Ctx.Provider value={{ country, range, setCountry, setRange }}>{children}</Ctx.Provider>;
}

export function useControls(): Controls {
  const c = useContext(Ctx);
  if (!c) throw new Error("useControls must be used inside ControlsProvider");
  return c;
}

function Segmented<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-line bg-surface p-0.5 text-sm">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded px-3 py-1 transition-colors ${
            value === o.value ? "bg-ink text-surface" : "text-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ControlBar({ showRange = true }: { showRange?: boolean }) {
  const { country, range, setCountry, setRange } = useControls();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Segmented label="Country" value={country} onChange={setCountry} options={[
        { value: "both", label: "Both" }, { value: "CA", label: "Canada" }, { value: "US", label: "U.S." },
      ]} />
      {showRange && <Segmented label="Date range" value={range} onChange={setRange} options={[
        { value: "5Y", label: "5 years" }, { value: "10Y", label: "10 years" }, { value: "MAX", label: "Since 2006" },
      ]} />}
    </div>
  );
}
