import { momentum, rotation, series as seriesByName } from "../data";
import type { Answer, MomentumRow, Verdict } from "../intel-types";
import {
  C, T, change, get, lastV, line, maxDate, pct, period, pp, present, recessionSpans, signed, when,
} from "./helpers";

const YF = "Yahoo Finance";
const FRED = "FRED (St. Louis Fed)";

const NICE: Record<string, string> = { HealthCare: "Health care", Tech: "Technology" };
const nice = (s: string) => NICE[s] ?? s;

const sectorRows = (): MomentumRow[] =>
  (momentum?.rows ?? []).filter((r) => (r.market === "CA" || r.market === "US") && r.sector !== "Benchmark" && r.ticker !== "tsx_composite");

const benchRet = (market: "CA" | "US", key: "r3m" | "r12m"): number | undefined => {
  const m = momentum?.rows.find((r) => r.market === market && r.sector === "Benchmark")?.[key];
  if (m != null) return m;
  const latest = rotation.rows.filter((r) => r.month === rotation.latest_month && r.market === market && r.sector === "Benchmark")[0];
  const v = latest?.[key === "r3m" ? "ret_3m" : "ret_12m"];
  return v ?? undefined;
};

function regime(): Answer {
  const cg = get("copper_gold_ratio"), hy = get("us_hy_spread"), baa = get("us_baa_spread"), nfci = get("us_nfci");
  const spread = hy ?? baa;
  const signals: { label: string; name: string; value: string; vote: number; note: string }[] = [];
  if (cg) {
    const c3 = change(cg, 3) ?? 0;
    signals.push({ label: "Copper/gold ratio, 3-mo", name: "copper outpacing gold", value: signed((100 * c3) / (lastV(cg) - c3), 1, "%"), vote: c3 > 0 ? 1 : -1,
      note: c3 > 0 ? "Industrial demand beating safe havens" : "Safe havens beating industrial demand" });
  }
  if (spread) {
    const s3 = change(spread, 3) ?? 0;
    signals.push({ label: `${hy ? "High-yield" : "Baa"} credit spread`, name: "credit spreads", value: `${lastV(spread).toFixed(2)} pts`, vote: s3 <= -0.1 ? 1 : s3 >= 0.25 ? -1 : 0,
      note: `${pp(s3)} over 3 months` });
  }
  if (nfci) {
    signals.push({ label: "Financial conditions (NFCI)", name: "financial conditions", value: lastV(nfci).toFixed(2), vote: lastV(nfci) < 0 ? 1 : -1,
      note: lastV(nfci) < 0 ? "Looser than average" : "Tighter than average" });
  }
  const spx = benchRet("US", "r3m");
  if (spx !== undefined) signals.push({ label: "S&P 500, 3-mo return", name: "equity trend", value: `${signed(spx)}%`, vote: spx > 0 ? 1 : -1, note: "Equity trend" });
  const score = signals.reduce((a, s) => a + s.vote, 0);
  const verdict: Verdict = signals.length === 0 ? { label: "Data pending", tone: "neutral" }
    : score >= 2 ? { label: "Risk-on", tone: "good" } : score <= -2 ? { label: "Risk-off", tone: "bad" } : { label: "Mixed signals", tone: "caution" };
  const on = signals.filter((s) => s.vote > 0).map((s) => s.name);
  const off = signals.filter((s) => s.vote < 0).map((s) => s.name);
  const chartSeries = cg
    ? present([line("copper_gold_ratio", C.s4, 5, { label: "Copper/gold price ratio (×1000)" })])
    : present([line("us_hy_spread", C.s5, 5, { label: "High-yield spread" }), line("us_baa_spread", C.us, 5, { label: "Baa corporate spread" })]);
  return {
    id: "risk-regime", lens: "investor", short: "Risk regime",
    question: "Are we in a risk-on or risk-off environment?",
    verdict,
    summary: `${signals.length} market signals add up to ${signed(score, 0)} (each votes +1 risk-on or −1 risk-off). `
      + (on.length ? `Pointing risk-on: ${on.join(", ")}. ` : "") + (off.length ? `Pointing risk-off: ${off.join(", ")}.` : ""),
    metrics: signals.map((s) => ({ label: s.label, value: s.value, note: s.note })),
    chart: chartSeries.length ? { kind: "line", unit: cg ? "ratio" : "pts", series: chartSeries } : null,
    chartTitle: cg ? "Copper-to-gold price ratio: rising = growth appetite, falling = defence" : "Corporate credit spreads over Treasuries (percentage points)",
    explain:
      "Copper is bought when factories and builders expect growth; gold is bought for safety. Their ratio rises when investors lean into growth. "
      + "Credit spreads (the extra yield on corporate bonds) widen when lenders fear defaults. We combine these with financial conditions and the equity trend: each signal votes +1 (risk-on) or −1 (risk-off).",
    sources: [YF, FRED, "Chicago Fed NFCI"],
    asOf: maxDate(cg, spread, nfci),
    pending: cg && hy ? undefined : present([cg ? null : "copper_gold_ratio", hy ? null : "us_hy_spread"]),
  };
}

function sectorMomentum(): Answer {
  const rows = sectorRows();
  let data: { label: string; r1m: number; r1w: number | null; market: string }[];
  let asOf: string;
  let horizon: string;
  if (rows.length) {
    data = rows.filter((r) => r.r1m != null).map((r) => ({ label: `${r.market === "CA" ? "CA" : "US"} ${nice(r.sector)}`, r1m: r.r1m!, r1w: r.r1w, market: r.market }));
    asOf = momentum!.as_of;
    horizon = "1-month";
  } else {
    data = rotation.rows
      .filter((r) => r.month === rotation.latest_month && r.sector !== "Benchmark" && r.ret_1m != null)
      .map((r) => ({ label: `${r.market} ${nice(r.sector)}`, r1m: r.ret_1m!, r1w: null, market: r.market }));
    asOf = rotation.latest_month;
    horizon = "last full month";
  }
  data.sort((a, b) => b.r1m - a.r1m);
  const top = (m: string) => data.find((d) => d.market === m);
  const bottom = (m: string) => [...data].reverse().find((d) => d.market === m);
  const caT = top("CA"), usT = top("US"), caB = bottom("CA"), usB = bottom("US");
  return {
    id: "sector-momentum", lens: "investor", short: "Sector momentum",
    question: "Which equity sectors are showing the most momentum?",
    verdict: caT && usT ? { label: `Leaders: ${caT.label.slice(3)} (CA), ${usT.label.slice(3)} (US)`, tone: "neutral" } : { label: "Data pending", tone: "neutral" },
    summary: caT && usT && caB && usB
      ? `Over the ${horizon}, ${usT.label.slice(3)} led the U.S. (${signed(usT.r1m)}%) and ${caT.label.slice(3)} led Canada (${signed(caT.r1m)}%). `
        + `Laggards: ${usB.label.slice(3)} in the U.S. (${signed(usB.r1m)}%) and ${caB.label.slice(3)} in Canada (${signed(caB.r1m)}%).`
      : "Sector data is not available yet.",
    metrics: present([
      usT && { label: "Top U.S. sector", value: usT.label.slice(3), note: `${signed(usT.r1m)}% ${horizon}` },
      caT && { label: "Top Canadian sector", value: caT.label.slice(3), note: `${signed(caT.r1m)}% ${horizon}` },
      usT?.r1w != null && { label: `${usT.label.slice(3)} (U.S.), 1 week`, value: `${signed(usT.r1w)}%` },
      caT?.r1w != null && { label: `${caT.label.slice(3)} (CA), 1 week`, value: `${signed(caT.r1w)}%` },
    ]),
    chart: data.length ? {
      kind: "hbar", unit: "%",
      rows: data.map((d) => ({ label: d.label, value: Number(d.r1m.toFixed(2)), color: d.market === "CA" ? C.ca : C.us, group: d.market === "CA" ? "Canada" : "U.S." })),
    } : null,
    chartTitle: `Sector ETF returns, ${horizon} (%)`,
    explain:
      "Momentum is the tendency of recent winners to keep outperforming for a while. Short horizons (1 week, 1 month) are noisy; the Sector rotation page shows 3–12 month relative strength against each market's benchmark, "
      + "and the Investor briefing combines momentum with the business-cycle position to suggest overweight and underweight sectors.",
    sources: [`${YF} (iShares and SPDR sector ETFs)`],
    asOf,
    pending: rows.length ? undefined : ["momentum.json (weekly returns)"],
  };
}

function recession(): Answer {
  const us = get("us_spread_10_2"), ca = get("ca_spread_10_2"), usS = get("us_sahm"), caS = get("ca_sahm"),
    prob = get("us_recession_prob"), caCli = get("canada_oecd_cli"), usCli = get("us_oecd_cli");
  const flags: string[] = [];
  const curveNote = (s: typeof us, who: string) => {
    if (!s) return null;
    const v = lastV(s);
    const recentMin = Math.min(...s.data.slice(-24).map(([, x]) => x));
    if (v < 0) { flags.push(`${who} curve inverted`); return `${who} 10–2 spread ${v.toFixed(2)} pts: inverted`; }
    if (recentMin < 0) { flags.push(`${who} curve recently un-inverted`); return `${who} spread back above zero after inverting (historically the riskier phase)`; }
    return `${who} 10–2 spread ${v.toFixed(2)} pts: normal`;
  };
  const notes = present([curveNote(us, "U.S."), curveNote(ca, "Canada")]);
  if (usS && lastV(usS) >= 0.5) flags.push("U.S. Sahm rule triggered");
  if (caS && lastV(caS) >= 0.5) flags.push("Canada Sahm rule triggered");
  if (prob && lastV(prob) >= 30) flags.push("U.S. recession probability above 30%");
  for (const [s, who] of [[caCli, "Canada"], [usCli, "U.S."]] as const) {
    if (s && lastV(s) < 100 && (change(s, 3) ?? 0) < 0) flags.push(`${who} leading indicator below trend and falling`);
  }
  const verdict: Verdict = flags.length === 0 ? { label: "Low near-term risk", tone: "good" }
    : flags.length === 1 ? { label: "Watch closely", tone: "caution" } : { label: "Elevated risk", tone: "bad" };
  const start = T((us ?? ca)!.latest.date) - 20 * 365.25 * 86_400_000;
  return {
    id: "recession", lens: "investor", short: "Recession risk",
    question: "Is a recession actually imminent?",
    verdict,
    summary: `${flags.length ? `Warning flags: ${flags.join("; ")}.` : "None of our recession flags are raised."} ${notes.join(". ")}.`
      + (prob ? ` The U.S. smoothed recession probability is ${pct(lastV(prob))} (${when(prob)}).` : ""),
    metrics: present([
      us && { label: "U.S. 10y − 2y", value: `${lastV(us).toFixed(2)} pts`, note: when(us) },
      ca && { label: "Canada 10y − 2y", value: `${lastV(ca).toFixed(2)} pts`, note: when(ca) },
      usS && { label: "U.S. Sahm indicator", value: lastV(usS).toFixed(2), note: "0.5+ = triggered" },
      caS && { label: "Canada Sahm indicator", value: lastV(caS).toFixed(2) },
      prob && { label: "U.S. recession probability", value: pct(lastV(prob)) },
    ]),
    chart: {
      kind: "line", unit: "pts", zero: true,
      series: present([line("ca_spread_10_2", C.ca, 20, { label: "Canada 10y − 2y" }), line("us_spread_10_2", C.us, 20, { label: "U.S. 10y − 2y" })]),
      recessions: recessionSpans(["US", "CA"], start),
    },
    chartTitle: "Yield-curve spread, 10-year minus 2-year (percentage points), recessions shaded",
    explain:
      "An inverted curve (short rates above long rates) has preceded every U.S. recession since the 1970s, but with a 6–24 month lag, and the recession often starts after the curve has un-inverted. "
      + "The Sahm rule confirms a downturn once unemployment starts climbing. We treat these as flags, not a forecast: two or more raised together is the signal to take seriously.",
    sources: ["Bank of Canada", FRED, "OECD via FRED"],
    asOf: maxDate(us, ca, usS),
  };
}

function hedge(): Answer {
  const m = (t: string) => momentum?.rows.find((r) => r.ticker === t)?.r12m ?? undefined;
  const fromYoy = (n: string) => { const s = get(n); return s ? lastV(s) : undefined; };
  const assets = present([
    { label: "Gold", v: m("gold") ?? fromYoy("gold_yoy"), color: "var(--c-4)" },
    { label: "WTI crude oil", v: m("wti_crude") ?? fromYoy("wti_crude_yoy"), color: "var(--c-5)" },
    { label: "S&P 500 (SPY)", v: benchRet("US", "r12m"), color: C.us },
    { label: "TSX 60 (XIU)", v: benchRet("CA", "r12m"), color: C.ca },
  ].map((a) => (a.v === undefined ? null : { ...a, v: a.v as number })));
  const usCpi = get("us_cpi"), caCpi = get("ca_cpi_all_items"), be = get("us_breakeven_10y"), caBe = get("ca_breakeven_long");
  const infl = usCpi ? lastV(usCpi) : 0;
  const sorted = [...assets].sort((a, b) => b.v - a.v);
  const best = sorted[0];
  const beating = sorted.filter((a) => a.v > infl);
  const verdict: Verdict = !best ? { label: "Data pending", tone: "neutral" }
    : beating.length === 0 ? { label: "Nothing is beating inflation", tone: "bad" }
    : { label: `Leading hedge: ${best.label}`, tone: "neutral" };
  return {
    id: "inflation-hedge", lens: "investor", short: "Inflation hedge",
    question: "Where is the inflation hedge right now?",
    verdict,
    summary: best
      ? `Over the past 12 months ${sorted.map((a) => `${a.label} ${signed(a.v)}%`).join(", ")}, against U.S. CPI inflation of ${pct(infl)}`
        + `${caCpi ? ` and Canadian of ${pct(lastV(caCpi))}` : ""}. `
        + (be ? `Bond markets price ${pct(lastV(be), 2)} average U.S. inflation over the next decade${caBe ? ` (Canada ${pct(lastV(caBe), 2)})` : ""}.` : "")
      : "Return data is not available yet.",
    metrics: present([
      ...sorted.map((a) => ({ label: `${a.label}, 12-mo`, value: `${signed(a.v)}%`, note: `Real: ${signed(a.v - infl)}%` })),
      be && { label: "U.S. 10-yr breakeven", value: pct(lastV(be), 2), note: "Market inflation expectation" },
    ]),
    chart: assets.length ? {
      kind: "hbar", unit: "%",
      rows: sorted.map((a) => ({ label: a.label, value: Number(a.v.toFixed(2)), color: a.color })),
      ref: usCpi ? { value: Number(infl.toFixed(2)), label: "U.S. CPI inflation" } : undefined,
    } : null,
    chartTitle: "12-month price return (%), with U.S. inflation for reference",
    explain:
      "An asset hedges inflation if its return beats inflation, leaving a positive real return. Commodities tend to lead when inflation comes from supply shocks; equities win when inflation is moderate and growth is strong; "
      + "inflation-linked bonds (TIPS, Real Return Bonds) lock in a real yield. Breakeven inflation, the gap between nominal and inflation-linked yields, is the market's own inflation forecast.",
    sources: [YF, FRED, "Bank of Canada"],
    asOf: maxDate(usCpi, be) || (momentum?.as_of ?? ""),
    pending: momentum ? undefined : ["momentum.json (gold, 12-month returns)"],
  };
}

function usVsCanada(): Answer {
  const rows = rotation.rows.filter((r) => r.sector === "Benchmark");
  const ca = rows.filter((r) => r.market === "CA").sort((a, b) => a.month.localeCompare(b.month));
  const us = rows.filter((r) => r.market === "US").sort((a, b) => a.month.localeCompare(b.month));
  const fx = seriesByName("cad_usd_combined");
  const fxAt = (month: string) => {
    let v: number | undefined;
    for (const [d, x] of fx?.data ?? []) { if (d <= month) v = x; else break; }
    return v;
  };
  const idx = (pts: [string, number][]) => pts.length ? pts.map(([d, v]) => [T(d), Number(((100 * v) / pts[0][1]).toFixed(2))] as [number, number]) : [];
  const usCad: [string, number][] = present(us.map((r) => { const f = fxAt(r.month); return f ? [r.month, r.close / f] as [string, number] : null; }));
  const r12 = (pts: [string, number][]) => pts.length > 12 ? 100 * (pts.at(-1)![1] / pts.at(-13)![1] - 1) : undefined;
  const caR = r12(ca.map((r) => [r.month, r.close])), usR = r12(us.map((r) => [r.month, r.close])), usCadR = r12(usCad);
  const diff = usCadR !== undefined && caR !== undefined ? usCadR - caR : undefined;
  const verdict: Verdict = diff === undefined ? { label: "Data pending", tone: "neutral" }
    : diff > 3 ? { label: "U.S. leading", tone: "neutral" } : diff < -3 ? { label: "Canada leading", tone: "neutral" } : { label: "Neck and neck", tone: "neutral" };
  const fxChg = fx ? change(fx, 12) : undefined;
  return {
    id: "us-vs-canada", lens: "investor", short: "U.S. vs Canada",
    question: "U.S. vs Canadian equities: where should capital flow?",
    verdict,
    summary: diff !== undefined
      ? `Over the 12 months to ${period(rotation.latest_month)}, the S&P 500 returned ${signed(usR!)}% in U.S. dollars and ${signed(usCadR!)}% for a Canadian investor after currency, versus ${signed(caR!)}% for the TSX 60. `
        + (fxChg !== undefined ? `The loonie moved ${signed(fxChg * 100, 1)} U.S. cents, ${fxChg >= 0 ? "eroding" : "boosting"} U.S. returns in Canadian dollars.` : "")
      : "Market data is not available yet.",
    metrics: present([
      usR !== undefined && { label: "S&P 500, 12-mo (USD)", value: `${signed(usR)}%` },
      usCadR !== undefined && { label: "S&P 500, 12-mo (in CAD)", value: `${signed(usCadR)}%` },
      caR !== undefined && { label: "TSX 60, 12-mo", value: `${signed(caR)}%` },
      diff !== undefined && { label: "U.S. minus Canada (CAD)", value: pp(diff, 1) },
    ]),
    chart: {
      kind: "line", unit: "index",
      ref: { y: 100, label: "Start" },
      series: [
        { key: "spy", label: "S&P 500 (SPY), USD", color: C.us, data: idx(us.map((r) => [r.month, r.close])) },
        { key: "spy_cad", label: "S&P 500 in CAD", color: C.us, dash: "5 3", data: idx(usCad) },
        { key: "xiu", label: "TSX 60 (XIU), CAD", color: C.ca, data: idx(ca.map((r) => [r.month, r.close])) },
      ],
    },
    chartTitle: "Total return, indexed to 100 three years ago",
    explain:
      "For a Canadian investor, U.S. stock returns arrive in U.S. dollars and must be converted back: a falling loonie adds to U.S. returns, a rising one subtracts. "
      + "Canada's market is heavy in banks, energy and materials; the U.S. is heavy in technology, so the two often lead at different points in the commodity and rate cycle.",
    sources: [`${YF} (XIU, SPY, dividend-adjusted)`, "Bank of Canada FX"],
    asOf: rotation.latest_month,
  };
}

export const investor = [regime, sectorMomentum, recession, hedge, usVsCanada];
