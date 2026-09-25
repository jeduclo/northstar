"use client";

import { useState } from "react";
import type { Country } from "@/lib/types";
import { type Horizon, type RotationData, BENCHMARK_NAME, latestRows, pairedSectors } from "@/lib/rotation";
import { ControlBar, useControls } from "../Controls";
import Heatmap from "./Heatmap";
import { Leaderboard, Quadrant, SectorHistory } from "./Charts";
import { HorizonPicker, MARKET_NAME, MarketKey, Panel } from "./shared";

const signed = (v: number | null | undefined, unit = "%") =>
  v === null || v === undefined ? "–" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}${unit}`;

function Stats({ data, markets }: { data: RotationData; markets: Country[] }) {
  const latest = latestRows(data);
  const bench = (m: Country) => latest.find((r) => r.market === m && r.sector === "Benchmark");
  const leader = (m: Country) => latest.filter((r) => r.market === m && r.sector !== "Benchmark" && r.rs_12m !== null)
    .sort((a, b) => b.rs_12m! - a.rs_12m!)[0];
  const gaps = pairedSectors(data).map((s) => {
    const ca = latest.find((r) => r.market === "CA" && r.sector === s)?.ret_12m;
    const us = latest.find((r) => r.market === "US" && r.sector === s)?.ret_12m;
    return { s, gap: ca != null && us != null ? ca - us : null };
  }).filter((g) => g.gap !== null).sort((a, b) => Math.abs(b.gap!) - Math.abs(a.gap!));

  const items: { key: string; country?: Country; label: string; value: string; sub: string }[] = [];
  for (const m of markets) {
    items.push({ key: `b${m}`, country: m, label: `${BENCHMARK_NAME[m]}, 12-month return`,
      value: signed(bench(m)?.ret_12m), sub: bench(m)?.ticker ?? "" });
  }
  for (const m of markets) {
    const l = leader(m);
    items.push({ key: `l${m}`, country: m, label: "Strongest sector, 12 months",
      value: l?.sector ?? "–", sub: `${signed(l?.rs_12m, " pts")} vs benchmark` });
  }
  if (markets.length === 2 && gaps[0]) {
    items.push({ key: "gap", label: "Widest cross-border gap, 12 months", value: gaps[0].s,
      sub: `Canada ${signed(gaps[0].gap, " pts")} vs U.S.` });
  }

  return (
    <dl className="flex flex-wrap gap-px overflow-hidden rounded-lg border border-line bg-line">
      {items.map((i) => (
        <div key={i.key} className="min-w-[9.5rem] flex-1 bg-surface px-4 py-4">
          <dt className="flex items-center gap-2 text-xs text-muted">
            {i.country && <span className={`h-2 w-2 rounded-full ${i.country === "CA" ? "bg-ca" : "bg-us"}`} aria-hidden />}
            <span>{i.country ? `${MARKET_NAME[i.country]} · ` : ""}{i.label}</span>
          </dt>
          <dd className="mt-1.5 text-2xl font-semibold tabular-nums">{i.value}</dd>
          <dd className="mt-1 text-xs text-muted">{i.sub}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function RotationView({ data }: { data: RotationData }) {
  const { country } = useControls();
  const [horizon, setHorizon] = useState<Horizon>("12m");
  const paired = pairedSectors(data);
  const [sector, setSector] = useState(paired.includes("Energy") ? "Energy" : paired[0]);
  const markets: Country[] = country === "both" ? ["CA", "US"] : [country];
  const latest = latestRows(data);
  const hLabel = { "3m": "3-month", "6m": "6-month", "12m": "12-month" }[horizon];

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <ControlBar showRange={false} />
        <HorizonPicker value={horizon} onChange={setHorizon} />
      </div>

      <div className="mt-6"><Stats data={data} markets={markets} /></div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        {markets.map((m) => (
          <Panel key={m} wide title={`${MARKET_NAME[m]}: ${hLabel} relative strength by sector`}
            legend={`Sector return minus the ${BENCHMARK_NAME[m]} return, in percentage points. Green beats the benchmark; red trails it.`}>
            <Heatmap rows={data.rows} market={m} horizon={horizon} />
          </Panel>
        ))}

        <Panel title={`Sector leaderboard, ${hLabel}`} legend={<MarketKey markets={markets} />}
          note="Sorted by average relative strength across the markets shown.">
          <Leaderboard latest={latest} markets={markets} horizon={horizon} />
        </Panel>

        <Panel title="Rotation quadrant" legend={<MarketKey markets={markets} />}
          note="Across: 12-month relative strength (trend). Up: 3-month relative strength (momentum). Sectors tend to rotate clockwise: improving, leading, weakening, lagging.">
          <Quadrant latest={latest} markets={markets} />
        </Panel>

        <Panel wide title="One sector across the border: 12-month relative strength"
          legend={
            <label className="flex items-center gap-2">
              Sector
              <select value={sector} onChange={(e) => setSector(e.target.value)}
                className="rounded border border-line bg-surface px-2 py-1 text-ink">
                {paired.map((s) => <option key={s}>{s}</option>)}
              </select>
              <MarketKey markets={markets} />
            </label>
          }
          note="Canadian ETFs are priced in Canadian dollars and U.S. ETFs in U.S. dollars, so cross-border gaps include currency effects.">
          <SectorHistory rows={data.rows} sector={sector} markets={markets} />
        </Panel>
      </div>
    </>
  );
}
