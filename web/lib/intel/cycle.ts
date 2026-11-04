import { momentum, rotation } from "../data";
import type { Call, CycleReading, RiskAlert, SectorCall } from "../intel-types";
import { ago, change, get, lastV, pct, pp, signed, when } from "./helpers";

/** Business-cycle position from the OECD composite leading indicator: level vs trend (100) and 3-month momentum. */
export function cycle(): CycleReading[] {
  const out: CycleReading[] = [];
  for (const [country, name] of [["CA", "canada_oecd_cli"], ["US", "us_oecd_cli"]] as const) {
    const s = get(name);
    if (!s || s.data.length < 16) continue;
    const trail = s.data.slice(-12).map(([date], i, arr) => {
      const idx = s.data.length - arr.length + i;
      return { date, level: Number((s.data[idx][1] - 100).toFixed(3)), momentum: Number((s.data[idx][1] - s.data[idx - 3][1]).toFixed(3)) };
    });
    const now = trail.at(-1)!;
    const phase: CycleReading["phase"] = now.level >= 0
      ? now.momentum >= 0 ? "Mid cycle" : "Late cycle"
      : now.momentum >= 0 ? "Early cycle" : "Contraction";
    out.push({ country, phase, level: now.level, momentum: now.momentum, trail, asOf: s.latest.date });
  }
  return out;
}

export const PHASE_NOTES: Record<CycleReading["phase"], string> = {
  "Early cycle": "Activity below trend but recovering. Historically favours financials, industrials, technology and consumer cyclicals.",
  "Mid cycle": "Activity above trend and still improving. Broad growth; technology and industrials tend to lead.",
  "Late cycle": "Activity above trend but losing momentum, often with inflation pressure. Energy, materials, health care and staples tend to hold up.",
  Contraction: "Activity below trend and falling. Defensives (staples, utilities, health care) tend to outperform.",
};

const TILT: Record<CycleReading["phase"], Record<string, number>> = {
  "Early cycle": { Financials: 1, Industrials: 1, Tech: 1, Materials: 0, Energy: 0, HealthCare: -1, Staples: -1, Utilities: -1 },
  "Mid cycle": { Tech: 1, Industrials: 1, Materials: 0, Financials: 0, Energy: 0, HealthCare: 0, Staples: -1, Utilities: -1 },
  "Late cycle": { Energy: 1, Materials: 1, HealthCare: 1, Staples: 1, Tech: -1, Financials: 0, Industrials: 0, Utilities: 0 },
  Contraction: { Staples: 1, Utilities: 1, HealthCare: 1, Tech: 0, Energy: -1, Industrials: -1, Financials: -1, Materials: -1 },
};

/** Rules-based starting point: cycle tilt + 3/6-month relative strength. The AI briefing may refine it. */
export function baselineSectors(): SectorCall[] {
  const phases = Object.fromEntries(cycle().map((c) => [c.country, c.phase])) as Record<"CA" | "US", CycleReading["phase"]>;
  const latest = rotation.rows.filter((r) => r.month === rotation.latest_month && r.sector !== "Benchmark");
  return latest.map((r) => {
    const phase = phases[r.market] ?? "Mid cycle";
    const tilt = TILT[phase][r.sector] ?? 0;
    const m3 = r.rs_3m, m6 = r.rs_6m;
    const mom = m3 != null && m6 != null ? (m3 > 0 && m6 > 0 ? 1 : m3 < 0 && m6 < 0 ? -1 : 0) : 0;
    const score = tilt + mom;
    const call: Call = score >= 1 ? "Overweight" : score <= -1 ? "Underweight" : "Market weight";
    const parts = [
      tilt > 0 ? `historically favoured in the ${phase.toLowerCase()}` : tilt < 0 ? `historically lags in the ${phase.toLowerCase()}` : `cycle-neutral in the ${phase.toLowerCase()}`,
      mom > 0 ? "beating its benchmark over 3 and 6 months" : mom < 0 ? "trailing its benchmark over 3 and 6 months" : "mixed relative momentum",
    ];
    return {
      market: r.market, sector: r.sector, ticker: r.ticker, call, score,
      momentum3m: m3 == null ? null : Number(m3.toFixed(1)), momentum6m: m6 == null ? null : Number(m6.toFixed(1)),
      rationale: `${parts[0][0].toUpperCase()}${parts[0].slice(1)}; ${parts[1]}.`,
    };
  }).sort((a, b) => a.market.localeCompare(b.market) || b.score - a.score || a.sector.localeCompare(b.sector));
}

/** Rules-based anomaly and risk flags. */
export function riskAlerts(): RiskAlert[] {
  const a: RiskAlert[] = [];
  const wti = get("wti_crude_yoy");
  if (wti && lastV(wti) >= 40) {
    a.push({ id: "oil-shock", severity: lastV(wti) >= 50 ? "high" : "medium", title: "Energy price shock",
      detail: `Oil is ${signed(lastV(wti), 0)}% from a year ago (${when(wti)}), feeding headline inflation and squeezing energy importers while lifting Canada's terms of trade.` });
  }
  const cu = momentum?.rows.find((r) => r.ticker === "copper");
  const us10 = get("us_yield_10yr");
  if (cu?.r1m != null && cu.r1m <= -5 && us10 && (change(us10, 1) ?? 0) > 0) {
    a.push({ id: "stagflation", severity: "high", title: "Stagflation signal",
      detail: `Copper fell ${Math.abs(cu.r1m).toFixed(1)}% over the past month while the U.S. 10-year yield rose ${pp(change(us10, 1)!)}: weaker growth with sticky inflation expectations.` });
  }
  for (const [name, who] of [["us_spread_10_2", "U.S."], ["ca_spread_10_2", "Canadian"]] as const) {
    const s = get(name);
    if (s && lastV(s) < 0) a.push({ id: `inverted-${name}`, severity: "medium", title: `${who} yield curve inverted`, detail: `The 10-year minus 2-year spread is ${lastV(s).toFixed(2)} points (${when(s)}), a classic recession precursor.` });
  }
  for (const [name, who] of [["us_sahm", "U.S."], ["ca_sahm", "Canada"]] as const) {
    const s = get(name);
    if (s && lastV(s) >= 0.5) a.push({ id: `sahm-${name}`, severity: "high", title: `${who}: Sahm recession rule triggered`, detail: `The indicator is at ${lastV(s).toFixed(2)} (${when(s)}); unemployment is rising at a recession-like pace.` });
    else if (s && lastV(s) >= 0.3) a.push({ id: `sahm-${name}`, severity: "medium", title: `${who}: unemployment rising quickly`, detail: `The Sahm indicator is at ${lastV(s).toFixed(2)}, approaching the 0.5 recession threshold.` });
  }
  const caR = get("ca_real_wage_growth"), usR = get("us_real_wage_growth");
  if (caR && usR && lastV(caR) < 0 && lastV(usR) < 0) {
    a.push({ id: "real-wages", severity: "medium", title: "Real wages falling in both countries",
      detail: `Pay is trailing prices: real wage growth is ${signed(lastV(caR))}% in Canada and ${signed(lastV(usR))}% in the U.S. (${when(caR)}), a drag on consumer spending.` });
  }
  const usCpi = get("us_cpi"), caCpi = get("ca_cpi_all_items");
  if ((usCpi && lastV(usCpi) > 3.5) || (caCpi && lastV(caCpi) > 3)) {
    a.push({ id: "inflation", severity: "medium", title: "Inflation above target",
      detail: `Headline CPI is ${usCpi ? pct(lastV(usCpi)) : "n/a"} in the U.S. and ${caCpi ? pct(lastV(caCpi)) : "n/a"} in Canada, against 2% targets.` });
  }
  const spread = get("us_hy_spread") ?? get("us_baa_spread");
  const sc = spread ? change(spread, 3) : undefined;
  if (spread && sc !== undefined && sc >= 0.3) {
    a.push({ id: "credit", severity: "medium", title: "Credit spreads widening", detail: `Corporate spreads are up ${pp(sc)} in three months to ${lastV(spread).toFixed(2)} points: lenders are pricing more default risk.` });
  }
  const cad = get("cad_usd_combined");
  const c1 = cad ? ago(cad, 1) : undefined;
  if (cad && c1 && Math.abs(lastV(cad) / c1 - 1) >= 0.03) {
    a.push({ id: "cad-move", severity: "low", title: "Sharp move in the loonie", detail: `CAD/USD moved ${signed(100 * (lastV(cad) / c1 - 1))}% in a month.` });
  }
  const sent = get("us_consumer_sentiment");
  if (sent && lastV(sent) < 60) {
    a.push({ id: "sentiment", severity: "low", title: "U.S. consumer sentiment depressed", detail: `The University of Michigan index is ${lastV(sent).toFixed(1)} (${when(sent)}), near historic lows.` });
  }
  const ie = get("ca_consumer_infl_exp") ?? get("us_consumer_infl_exp");
  if (ie && lastV(ie) >= 4) {
    a.push({ id: "expectations", severity: "low", title: "Household inflation expectations elevated", detail: `Consumers expect ${pct(lastV(ie))} inflation over the next year (${when(ie)}), which can feed wage demands.` });
  }
  const order = { high: 0, medium: 1, low: 2 };
  return a.sort((x, y) => order[x.severity] - order[y.severity]);
}
