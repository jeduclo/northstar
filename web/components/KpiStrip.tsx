"use client";

import type { Series } from "@/lib/types";
import { fmtNumber, fmtPeriod, fmtSigned, isMonthToDate, unitSuffix } from "@/lib/format";
import { useControls } from "./Controls";

export default function KpiStrip({ series, generatedAt }: { series: Series[]; generatedAt: string }) {
  const { country } = useControls();
  const shown = series.filter((s) => country === "both" || s.country === country);
  if (!shown.length) return null;
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 lg:grid-cols-5">
      {shown.map((s) => {
        const mtd = isMonthToDate(s, generatedAt);
        const dir = s.change === null || s.change === 0 ? "" : s.change > 0 ? "text-up" : "text-down";
        return (
          <div key={s.name} className="bg-surface px-4 py-4">
            <dt className="flex items-center gap-2 text-xs text-muted">
              <span className={`h-2 w-2 rounded-full ${s.country === "CA" ? "bg-ca" : "bg-us"}`} aria-hidden />
              <span>{s.country === "CA" ? "Canada" : "U.S."} · {s.description}</span>
            </dt>
            <dd className="mt-1.5">
              <span className="text-2xl font-semibold tabular-nums">{fmtNumber(s.latest.value, s.unit)}</span>
              <span className="ml-1 text-sm text-muted">{unitSuffix(s.unit)}</span>
            </dd>
            <dd className="mt-1 text-xs text-muted">
              {mtd ? "Month to date" : fmtPeriod(s.latest.date, s.frequency)}
              {s.change !== null && (
                <span className={`ml-2 tabular-nums ${dir}`}>{fmtSigned(s.change, s.unit)} vs prior</span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
