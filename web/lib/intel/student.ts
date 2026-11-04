import { fxOil } from "../data";
import type { Answer, Verdict } from "../intel-types";
import type { Series } from "../types";
import { C, T, ago, change, corr, get, lastV, line, maxDate, pct, period, pp, present, signed, slope, when } from "./helpers";

function curve(): Answer {
  const pts = (items: [string, number, Series | undefined][], monthsAgo: number) =>
    present(items.map(([tenor, years, s]) => {
      if (!s) return null;
      const y = monthsAgo ? ago(s, monthsAgo) : lastV(s);
      return y === undefined ? null : { tenor, years, y: Number(y.toFixed(2)) };
    }));
  const ca: [string, number, Series | undefined][] = [
    ["Overnight", 0, get("overnight_rate")], ["3M", 0.25, get("ca_tbill_3m")], ["2Y", 2, get("yield_2yr")], ["5Y", 5, get("yield_5yr")], ["10Y", 10, get("yield_10yr")],
  ];
  const us: [string, number, Series | undefined][] = [
    ["Overnight", 0, get("us_fed_funds")], ["3M", 0.25, get("us_tbill_3m")], ["2Y", 2, get("us_yield_2yr")], ["5Y", 5, get("us_yield_5yr")], ["10Y", 10, get("us_yield_10yr")],
  ];
  const y2 = get("yield_2yr"), y10 = get("yield_10yr");
  let verdict: Verdict = { label: "Data pending", tone: "neutral" };
  let summary = "";
  if (y2 && y10) {
    const d2 = change(y2, 6) ?? 0, d10 = change(y10, 6) ?? 0, ds = d10 - d2, spread = lastV(y10) - lastV(y2);
    let kind: string, meaning: string;
    if (ds > 0.1) {
      if (d2 < 0 && Math.abs(d2) >= Math.abs(d10)) { kind = "Bull steepening"; meaning = "short-term rates falling faster than long-term ones, usually because markets expect the central bank to cut"; }
      else { kind = "Bear steepening"; meaning = "long-term rates rising faster than short-term ones, as investors demand more compensation for future inflation, growth or government borrowing"; }
    } else if (ds < -0.1) {
      if (d10 < 0 && Math.abs(d10) >= Math.abs(d2)) { kind = "Bull flattening"; meaning = "long-term rates falling faster, often a sign of weaker growth expectations or a flight to safety"; }
      else { kind = "Bear flattening"; meaning = "short-term rates rising faster, typical when the central bank is hiking"; }
    } else { kind = "Little change"; meaning = "the curve's slope has barely moved"; }
    verdict = { label: `Canada: ${kind.toLowerCase()}`, tone: "neutral" };
    summary = `Over the past six months Canada's 2-year yield moved ${pp(d2)} and the 10-year ${pp(d10)}, so the 10–2 spread is now ${spread.toFixed(2)} points (${ds >= 0 ? "wider" : "narrower"} by ${Math.abs(ds).toFixed(2)}). `
      + `That is a ${kind.toLowerCase()}: ${meaning}.`;
  }
  return {
    id: "yield-curve", lens: "student", short: "Yield curve",
    question: "What does a 'steepening yield curve' actually mean today?",
    verdict, summary,
    metrics: present([
      y2 && { label: "Canada 2-year", value: pct(lastV(y2), 2), note: `${pp(change(y2, 6) ?? 0)} in 6 months` },
      y10 && { label: "Canada 10-year", value: pct(lastV(y10), 2), note: `${pp(change(y10, 6) ?? 0)} in 6 months` },
      y2 && y10 && { label: "10y − 2y spread", value: `${(lastV(y10) - lastV(y2)).toFixed(2)} pts` },
    ]),
    chart: {
      kind: "curve", unit: "%",
      series: [
        { key: "ca_now", label: "Canada, latest", color: C.ca, points: pts(ca, 0) },
        { key: "ca_1y", label: "Canada, a year ago", color: C.ca, dash: "5 3", points: pts(ca, 12) },
        { key: "us_now", label: "U.S., latest", color: C.us, points: pts(us, 0) },
        { key: "us_1y", label: "U.S., a year ago", color: C.us, dash: "5 3", points: pts(us, 12) },
      ].filter((s) => s.points.length >= 3),
    },
    chartTitle: "Yield curves: interest rate (%) by maturity, today vs a year ago",
    explain:
      "The yield curve plots interest rates from overnight to 10 years. 'Steepening' means long rates rise relative to short rates. The cause matters: in a bull steepener, short rates fall (cuts expected, bond prices rise: 'bull'); "
      + "in a bear steepener, long rates rise (bond prices fall: 'bear'), often from inflation worries or heavy government borrowing. Flattening and inversion (short above long) usually come from central bank hikes.",
    sources: ["Bank of Canada", "FRED (U.S. Treasury)"],
    asOf: maxDate(y2, y10),
    pending: get("ca_tbill_3m") && get("us_yield_5yr") ? undefined : ["ca_tbill_3m", "us_tbill_3m", "us_yield_5yr"],
  };
}

function phillips(): Answer {
  const u = get("ca_unemployment"), inf = get("cpi_trim");
  if (!u || !inf) return { id: "phillips-curve", lens: "student", short: "Phillips curve", question: "Does the Phillips Curve still work?", verdict: { label: "Data pending", tone: "neutral" }, summary: "", metrics: [], chart: null, chartTitle: "", explain: "", sources: [], asOf: "" };
  const infBy = new Map(inf.data);
  const pairs = u.data.filter(([d]) => infBy.has(d)).map(([d, x]) => ({ date: d, x, y: infBy.get(d)! }));
  const eras = [
    { key: "pre", label: "2006–2019", color: C.s5, test: (d: string) => d < "2020-01-01" },
    { key: "covid", label: "2020–2022", color: C.s4, test: (d: string) => d >= "2020-01-01" && d < "2023-01-01" },
    { key: "recent", label: "2023 onward", color: C.ca, test: (d: string) => d >= "2023-01-01" },
  ];
  const groups = eras.map((e) => ({ key: e.key, label: e.label, color: e.color, points: pairs.filter((p) => e.test(p.date)) }));
  const slopes = groups.map((g) => ({ label: g.label, s: slope(g.points.map((p) => p.x), g.points.map((p) => p.y)), r: corr(g.points.map((p) => p.x), g.points.map((p) => p.y)) }));
  const recent = slopes[2], pre = slopes[0];
  const verdict: Verdict = recent.s === null ? { label: "Too little recent data", tone: "neutral" }
    : recent.s < -0.3 ? { label: "Yes, it's visible again", tone: "good" }
    : recent.s <= 0 ? { label: "Weakly", tone: "neutral" } : { label: "Not right now", tone: "caution" };
  const fmtS = (s: number | null) => (s === null ? "n/a" : `${s >= 0 ? "+" : "−"}${Math.abs(s).toFixed(2)}`);
  const last = pairs.at(-1)!;
  return {
    id: "phillips-curve", lens: "student", short: "Phillips curve",
    question: "Does the Phillips Curve still work?",
    verdict,
    summary: `Each dot is a month: unemployment (across) against core inflation (up). From 2006–2019 the slope was ${fmtS(pre.s)} (core inflation moved ${Math.abs(pre.s ?? 0).toFixed(2)} points per point of unemployment): very flat. `
      + `Since 2023 it is ${fmtS(recent.s)}. Today: unemployment ${pct(last.x)}, CPI-trim ${pct(last.y)} (${when(u)}).`,
    metrics: slopes.map((s) => ({ label: `Slope, ${s.label}`, value: fmtS(s.s), note: s.r === null ? undefined : `correlation ${s.r.toFixed(2)}` })),
    chart: { kind: "scatter", xLabel: "Unemployment rate (%)", yLabel: "Core inflation, CPI-trim (% y/y)", groups, latest: last },
    chartTitle: "Canada: unemployment vs core inflation, monthly since 2006",
    explain:
      "The Phillips curve says low unemployment pushes up wages and then prices, so inflation and unemployment move in opposite directions (a downward slope). "
      + "From the 1990s to 2019 the curve looked almost flat, because anchored inflation expectations kept prices steady. The 2021–22 surge showed it can steepen sharply when the economy runs hot and supply is constrained.",
    sources: ["Statistics Canada LFS", "Bank of Canada core inflation"],
    asOf: maxDate(u, inf),
  };
}

function petro(): Answer {
  const rows = fxOil.filter((r) => r.cad && r.wti);
  const start = rows.length > 120 ? rows.length - 120 : 0;
  const win = rows.slice(start);
  const latest = rows.at(-1);
  const c36 = latest?.corr_36m ?? null, c12 = latest?.corr_12m ?? null;
  const verdict: Verdict = c36 === null ? { label: "Data pending", tone: "neutral" }
    : c36 >= 0.4 ? { label: "Strong petro-link", tone: "neutral" } : c36 >= 0.15 ? { label: "Moderate link", tone: "neutral" } : { label: "The link has broken down", tone: "caution" };
  const yr = rows.at(-13);
  const oilChg = latest && yr ? 100 * (latest.wti / yr.wti - 1) : undefined;
  const cadChg = latest && yr ? 100 * (latest.cad / yr.cad - 1) : undefined;
  const levelCorr = corr(win.map((r) => r.cad), win.map((r) => r.wti));
  return {
    id: "petrocurrency", lens: "student", short: "Oil & the loonie",
    question: "Why do commodity prices swing the Canadian dollar?",
    verdict,
    summary: latest
      ? `Over the past year oil is ${signed(oilChg ?? 0, 0)}% and the loonie ${signed(cadChg ?? 0)}% against the U.S. dollar. `
        + `The correlation of their monthly moves is ${c36?.toFixed(2)} over three years and ${c12?.toFixed(2)} over one year (1 = move in lockstep, 0 = unrelated)`
        + `${levelCorr !== null ? `; over ten years their levels correlate at ${levelCorr.toFixed(2)}` : ""}.`
      : "",
    metrics: present([
      latest && { label: "WTI crude", value: `US$${latest.wti.toFixed(0)}`, note: period(latest.month) },
      latest && { label: "CAD/USD", value: `$${latest.cad.toFixed(3)}` },
      c36 !== null && { label: "3-year correlation", value: c36.toFixed(2) },
      c12 !== null && { label: "1-year correlation", value: c12.toFixed(2) },
    ]),
    chart: win.length ? {
      kind: "line", unit: "index", ref: { y: 100, label: "Start" },
      series: [
        { key: "wti", label: "WTI crude oil", color: C.s4, data: win.map((r) => [T(r.month), Number(((100 * r.wti) / win[0].wti).toFixed(2))]) },
        { key: "cad", label: "Canadian dollar (USD per CAD)", color: C.ca, data: win.map((r) => [T(r.month), Number(((100 * r.cad) / win[0].cad).toFixed(2))]) },
      ],
    } : null,
    chartTitle: "Oil and the Canadian dollar, indexed to 100 ten years ago",
    explain:
      "Energy is one of Canada's largest exports. When oil rises, foreigners need more Canadian dollars to buy it, and Canada's terms of trade (export prices relative to import prices) improve, so the loonie tends to rise: a 'petrocurrency'. "
      + "The link weakens when interest-rate differentials, U.S. trade policy or pipeline constraints (which force Canadian oil to sell at a discount) dominate.",
    sources: ["Bank of Canada", "FRED (WTI)"],
    asOf: latest?.month ?? "",
  };
}

function headlineCore(): Answer {
  const h = get("ca_cpi_all_items"), trim = get("cpi_trim"), med = get("cpi_median"), us = get("us_cpi"), usCore = get("us_core_cpi");
  if (!h || !trim) return { id: "headline-core", lens: "student", short: "Headline vs core", question: "What is the difference between headline and core inflation?", verdict: { label: "Data pending", tone: "neutral" }, summary: "", metrics: [], chart: null, chartTitle: "", explain: "", sources: [], asOf: "" };
  const core = med ? (lastV(trim) + lastV(med)) / 2 : lastV(trim);
  const gap = lastV(h) - core;
  const verdict: Verdict = gap >= 0.5 ? { label: "Headline above core: volatile items pushing up", tone: "caution" }
    : gap <= -0.5 ? { label: "Headline below core: volatile items pulling down", tone: "neutral" } : { label: "Headline and core aligned", tone: "good" };
  return {
    id: "headline-core", lens: "student", short: "Headline vs core",
    question: "What is the difference between headline and core inflation?",
    verdict,
    summary: `Canada's headline inflation is ${pct(lastV(h))} (${when(h)}) while the Bank of Canada's core measures are ${pct(lastV(trim))} (trim)${med ? ` and ${pct(lastV(med))} (median)` : ""}: a ${pp(gap, 1)} gap. `
      + (us && usCore ? `In the U.S., headline is ${pct(lastV(us))} and core ${pct(lastV(usCore))}.` : ""),
    metrics: present([
      { label: "Headline CPI", value: pct(lastV(h)) },
      { label: "CPI-trim", value: pct(lastV(trim)) },
      med && { label: "CPI-median", value: pct(lastV(med)) },
      { label: "Headline − core", value: pp(gap, 1) },
    ]),
    chart: {
      kind: "line", unit: "% y/y", band: [1, 3], bandLabel: "1–3% target range",
      series: present([line("ca_cpi_all_items", C.ca, 10, { label: "Headline CPI" }), line("cpi_trim", C.s3, 10, { label: "CPI-trim" }), line("cpi_median", C.s5, 10, { label: "CPI-median" })]),
    },
    chartTitle: "Canada: headline vs core inflation, % y/y, past 10 years",
    explain:
      "Headline CPI measures the full basket you buy. Core measures strip out the noise: CPI-trim drops the 20% of prices with the most extreme moves each month on either side, CPI-median takes the middle price change. "
      + "Central banks set policy on core because rates take 18–24 months to work; reacting to a gasoline spike that will reverse in months would do more harm than good.",
    sources: ["Statistics Canada CPI", "Bank of Canada"],
    asOf: h.latest.date,
  };
}

function transmission(): Answer {
  const onr = get("overnight_rate"), cpi = get("ca_cpi_all_items"), real = get("ca_real_policy_rate");
  if (!onr || !cpi) return { id: "transmission", lens: "student", short: "Rate transmission", question: "How does the central bank actually control inflation?", verdict: { label: "Data pending", tone: "neutral" }, summary: "", metrics: [], chart: null, chartTitle: "", explain: "", sources: [], asOf: "" };
  const rate = new Map(onr.data), infl = new Map(cpi.data);
  const months = cpi.data.map(([d]) => d);
  const shift = (iso: string, m: number) => { const d = new Date(T(iso)); d.setUTCMonth(d.getUTCMonth() + m); return d.toISOString().slice(0, 10); };
  // Correlate the 12-month change in the policy rate with the 12-month change in inflation `lag` months later
  let best = { lag: 18, r: 0 };
  for (let lag = 6; lag <= 30; lag += 1) {
    const xs: number[] = [], ys: number[] = [];
    for (const d of months) {
      const r0 = rate.get(d), r1 = rate.get(shift(d, -12)), i0 = infl.get(shift(d, lag)), i1 = infl.get(shift(d, lag - 12));
      if ([r0, r1, i0, i1].every((v) => v !== undefined)) { xs.push(r0! - r1!); ys.push(i0! - i1!); }
    }
    const r = corr(xs, ys);
    if (r !== null && r < best.r) best = { lag, r };
  }
  const rr = real ? lastV(real) : lastV(onr) - lastV(get("cpi_trim") ?? cpi);
  const verdict: Verdict = rr >= 1.25 ? { label: "Policy is restrictive", tone: "neutral" } : rr <= 0.25 ? { label: "Policy is stimulative", tone: "neutral" } : { label: "Policy is near neutral", tone: "neutral" };
  const lagged = cpi.data.map(([d, v]) => [T(shift(d, -best.lag)), v] as [number, number]).filter(([t]) => t >= T("2006-01-01"));
  return {
    id: "transmission", lens: "student", short: "Rate transmission",
    question: "How does the central bank actually control inflation?",
    verdict,
    summary: `The overnight rate is ${pct(lastV(onr), 2)} (${when(onr)}); after subtracting core inflation, the real policy rate is ${pct(rr, 2)}. `
      + (best.r < -0.1
        ? `In Canadian data since 2006, rate changes line up most strongly (correlation ${best.r.toFixed(2)}) with inflation changes about ${best.lag} months later: the chart shifts inflation back ${best.lag} months so you can see the lag.`
        : `The historical lag is not clear-cut in this sample; the chart shifts inflation back ${best.lag} months, close to the 18–24 months the Bank of Canada cites.`),
    metrics: present([
      { label: "Overnight rate", value: pct(lastV(onr), 2) },
      { label: "Real policy rate", value: pct(rr, 2), note: "Rate minus core inflation" },
      { label: "Strongest lag found", value: `${best.lag} months`, note: best.r < 0 ? `correlation ${best.r.toFixed(2)}` : undefined },
      { label: "Headline CPI", value: pct(lastV(cpi)), note: when(cpi) },
    ]),
    chart: {
      kind: "line", unit: "%",
      series: [
        { key: "onr", label: "Overnight rate (that month)", color: C.ca, data: onr.data.filter(([d]) => d >= "2006-01-01").map(([d, v]) => [T(d), v]) },
        { key: "cpi_lag", label: `CPI inflation ${best.lag} months later`, color: C.s3, data: lagged },
      ],
    },
    chartTitle: `Overnight rate vs inflation ${best.lag} months later (%)`,
    explain:
      "The Bank of Canada sets the overnight rate. That feeds through prime and bond yields to mortgages and loans (the interest-rate channel), to the loonie (the exchange-rate channel), and to asset prices and confidence. "
      + "Spending slows, then hiring and wage growth, then prices: the full effect takes 18–24 months. That lag is why central banks act on forecasts, not on today's inflation.",
    sources: ["Bank of Canada", "Statistics Canada CPI"],
    asOf: maxDate(onr, cpi),
  };
}

export const student = [curve, phillips, petro, headlineCore, transmission];
