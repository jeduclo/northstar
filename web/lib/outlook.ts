import forecastsJson from "@/public/data/forecasts.json";
import causalJson from "@/public/data/causal_effects.json";
import type { Country, Series } from "./types";
import { getTab } from "./data";

export interface MacroForecast {
  name: string;
  country: Country;
  description: string;
  unit: string;
  history: [string, number][];
  forecast: [string, number, number, number][]; // date, p10, p50, p90
  backtest: { mae_model: number; mae_naive: number };
}

export interface SectorForecast { market: Country; sector: string; ticker: string; p10: number; p50: number; p90: number }

export interface Forecasts {
  generated_at: string;
  model: string;
  horizon_months: number;
  macro: MacroForecast[];
  sectors: SectorForecast[];
}

export interface Effect {
  market: Country; sector: string; ticker: string; n_obs: number;
  coef: number; se: number; ci_low: number; ci_high: number; p_value: number;
}

export interface Causal {
  generated_at: string;
  method: string;
  treatment: string;
  outcome: string;
  scale: string;
  policy_moves: number;
  effects: Effect[];
}

export const forecasts = forecastsJson as unknown as Forecasts;
export const causal = causalJson as unknown as Causal;

// ---- Macro radar: where today's reading sits in its own history since 2006 (0 = worst, 100 = best) ----

export const PILLARS = ["Growth", "Jobs", "Price stability", "Policy support", "Leading indicators"] as const;

const PILLAR_SERIES: Record<(typeof PILLARS)[number], { tab: string; CA: string; US: string; score: (v: number) => number }> = {
  Growth: { tab: "output", CA: "ca_gdp_yoy", US: "us_gdp_yoy", score: (v) => v },
  Jobs: { tab: "labour", CA: "ca_unemployment", US: "us_unemployment", score: (v) => -v },
  "Price stability": { tab: "prices", CA: "ca_cpi_all_items", US: "us_cpi", score: (v) => -Math.abs(v - 2) },
  "Policy support": { tab: "money", CA: "overnight_rate", US: "us_fed_funds", score: (v) => -v },
  "Leading indicators": { tab: "sentiment", CA: "canada_oecd_cli", US: "us_oecd_cli", score: (v) => v },
};

function percentile(s: Series | undefined, score: (v: number) => number): number | null {
  if (!s || s.data.length < 24) return null;
  const hist = s.data.map(([, v]) => score(v));
  const now = score(s.latest.value);
  return Math.round((100 * hist.filter((h) => h <= now).length) / hist.length);
}

export function radarScores(): { pillar: string; CA: number | null; US: number | null }[] {
  return PILLARS.map((p) => {
    const cfg = PILLAR_SERIES[p];
    const tab = getTab(cfg.tab);
    const find = (n: string) => tab?.series.find((s) => s.name === n);
    return { pillar: p, CA: percentile(find(cfg.CA), cfg.score), US: percentile(find(cfg.US), cfg.score) };
  });
}

export function outlookAnswer(): string {
  const get = (n: string) => forecasts.macro.find((m) => m.name === n)?.forecast.at(-1);
  const cpi = get("ca_cpi_all_items"), onr = get("overnight_rate");
  if (!cpi || !onr) return "";
  return `Chronos-2 puts Canadian inflation at ${cpi[2].toFixed(1)}% in ${forecasts.horizon_months} months `
    + `(80% range ${cpi[1].toFixed(1)}–${cpi[3].toFixed(1)}%) and the Bank of Canada's policy rate near ${onr[2].toFixed(2)}%.`;
}
