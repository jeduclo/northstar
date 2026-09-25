"use client";

import { useState } from "react";
import type { Country } from "@/lib/types";
import type { Causal, Forecasts } from "@/lib/outlook";
import { ControlBar, useControls } from "../Controls";
import { MARKET_NAME, MarketKey, Panel } from "../rotation/shared";
import MacroRadar from "./Radar";
import ForecastCone from "./ForecastCone";
import RangeRows, { type RangeRow } from "./RangeRows";

const sectorLabel = (market: Country, sector: string) =>
  sector === "Benchmark" ? (market === "CA" ? "TSX 60" : "S&P 500") : sector;

export default function OutlookView({ forecasts, causal, radar }: {
  forecasts: Forecasts; causal: Causal; radar: { pillar: string; CA: number | null; US: number | null }[];
}) {
  const { country } = useControls();
  const markets: Country[] = country === "both" ? ["CA", "US"] : [country];
  const [shock, setShock] = useState(0.25);
  const macro = forecasts.macro.filter((m) => markets.includes(m.country));
  const [seriesName, setSeriesName] = useState("ca_cpi_all_items");
  const selected = macro.find((m) => m.name === seriesName) ?? macro[0];
  const scale = shock / 0.25;

  const effect = (market: Country, ticker: string) => causal.effects.find((e) => e.market === market && e.ticker === ticker);

  const effectRows: RangeRow[] = causal.effects
    .filter((e) => markets.includes(e.market))
    .sort((a, b) => a.coef - b.coef)
    .map((e) => {
      const a = e.ci_low * scale, b = e.ci_high * scale;
      return { key: e.ticker, label: `${MARKET_NAME[e.market]} ${sectorLabel(e.market, e.sector)}`, market: e.market,
        low: Math.min(a, b), mid: e.coef * scale, high: Math.max(a, b), dim: e.p_value > 0.1 };
    });

  const outlookRows: RangeRow[] = forecasts.sectors
    .filter((s) => markets.includes(s.market))
    .sort((a, b) => b.p50 - a.p50)
    .map((s) => ({
      key: s.ticker, label: `${MARKET_NAME[s.market]} ${sectorLabel(s.market, s.sector)}`, market: s.market,
      low: s.p10, mid: s.p50, high: s.p90,
      shifted: shock === 0 ? undefined : s.p50 + (effect(s.market, s.ticker)?.coef ?? 0) * scale,
    }));

  const wins = forecasts.macro.filter((m) => m.backtest.mae_model < m.backtest.mae_naive).length;

  return (
    <>
      <div className="mt-6"><ControlBar showRange={false} /></div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Panel title="Macro radar: where each economy sits in its own history"
          legend={<MarketKey markets={markets} suffix="" />}
          note="Each score is the share of months since 2006 with a weaker reading than today (100 = strongest). Growth: real GDP y/y. Jobs: unemployment (lower is better). Price stability: distance of CPI from 2%. Policy support: policy rate (lower is more supportive). Leading: OECD indicator.">
          <MacroRadar data={radar} markets={markets} />
        </Panel>

        <Panel title={`${forecasts.horizon_months}-month forecast`}
          legend={
            <label className="flex flex-wrap items-center gap-2">
              Series
              <select value={selected?.name} onChange={(e) => setSeriesName(e.target.value)}
                className="rounded border border-line bg-surface px-2 py-1 text-ink">
                {macro.map((m) => <option key={m.name} value={m.name}>{MARKET_NAME[m.country]}: {m.description}</option>)}
              </select>
            </label>
          }
          note={selected ? `Shaded: 80% range (P10–P90). Dashed: median. In a 12-month holdout test, the median forecast's average error was ${selected.backtest.mae_model.toFixed(2)} vs ${selected.backtest.mae_naive.toFixed(2)} for a no-change forecast. Chronos-2 beat no-change on ${wins} of ${forecasts.macro.length} series.` : undefined}>
          {selected ? <ForecastCone f={selected} /> : <p className="py-16 text-center text-sm text-muted">No forecasts for this country filter.</p>}
        </Panel>

        <Panel title="Scenario lab: a Bank of Canada rate move"
          legend={
            <label className="flex flex-wrap items-center gap-3">
              <span>Rate change</span>
              <input type="range" min={-1} max={1} step={0.25} value={shock}
                onChange={(e) => setShock(Number(e.target.value))} className="w-40 accent-[var(--ca)]"
                aria-valuetext={`${shock >= 0 ? "+" : ""}${shock.toFixed(2)} percentage points`} />
              <span className="font-medium text-ink tabular-nums">{shock >= 0 ? "+" : "−"}{Math.abs(shock).toFixed(2)} pp</span>
            </label>
          }
          note={`Estimated same-month return impact, with 95% confidence intervals. Faded rows are not statistically significant (p > 0.10). ${causal.method}; ${causal.policy_moves} policy moves in the sample. Exploratory, not investment advice.`}>
          <RangeRows rows={effectRows} unit="%" digits={2} />
        </Panel>

        <Panel title={`${forecasts.horizon_months}-month return outlook by sector`}
          legend={<span>Bar: 80% range. Tick: median. {shock !== 0 && "Diamond: median after the scenario rate move."}</span>}
          note="Chronos-2 forecasts of each ETF's price, converted to 12-month returns. The scenario shift applies the estimated rate effect once, as an illustration.">
          <RangeRows rows={outlookRows} unit="%" />
        </Panel>
      </div>
    </>
  );
}
