import type { Answer, LineSeries, Verdict } from "../intel-types";
import { C, T, ago, change, get, lastV, line, maxDate, mean, pct, pp, present, signed, when } from "./helpers";

const SC = "Statistics Canada";

function divergence(): Answer {
  const onr = get("overnight_rate"), ff = get("us_fed_funds"), trim = get("cpi_trim"), pce = get("us_core_pce"), s2 = get("ca_us_2y_spread");
  if (!onr || !ff) {
    return { id: "divergence", lens: "policy", short: "BoC vs Fed", question: "Is Canadian monetary policy diverging from the U.S.?", verdict: { label: "Data pending", tone: "neutral" },
      summary: "", metrics: [], chart: null, chartTitle: "", explain: "", sources: [], asOf: "" };
  }
  const gap = lastV(onr) - lastV(ff);
  const gap12 = (ago(onr, 12) ?? lastV(onr)) - (ago(ff, 12) ?? lastV(ff));
  const widening = Math.abs(gap) > Math.abs(gap12) + 0.1;
  const verdict: Verdict = Math.abs(gap) >= 1 ? { label: `Wide divergence${widening ? ", widening" : ""}`, tone: "caution" }
    : Math.abs(gap) >= 0.5 ? { label: `Diverging${widening ? " further" : ""}`, tone: "caution" } : { label: "Moving in step", tone: "neutral" };
  const coreGap = trim && pce ? lastV(trim) - lastV(pce) : undefined;
  return {
    id: "divergence", lens: "policy", short: "BoC vs Fed",
    question: "Is Canadian monetary policy diverging from the U.S.?",
    verdict,
    summary: `The Bank of Canada's policy rate (${pct(lastV(onr), 2)}) is ${Math.abs(gap).toFixed(2)} points ${gap < 0 ? "below" : "above"} the Fed's (${pct(lastV(ff), 2)}), `
      + `${widening ? "wider" : "narrower or unchanged"} versus ${Math.abs(gap12).toFixed(2)} points a year ago.`
      + (coreGap !== undefined ? ` Core inflation is ${pct(lastV(trim!))} in Canada (CPI-trim) against ${pct(lastV(pce!))} in the U.S. (core PCE), a ${pp(coreGap, 1)} gap.` : "")
      + (s2 ? ` Two-year yields, which price the next two years of policy, sit ${Math.abs(lastV(s2)).toFixed(2)} points ${lastV(s2) < 0 ? "lower" : "higher"} in Canada, so markets expect the gap to persist.` : ""),
    metrics: present([
      { label: "BoC overnight", value: pct(lastV(onr), 2), note: when(onr) },
      { label: "Fed funds", value: pct(lastV(ff), 2), note: when(ff) },
      { label: "Policy gap (CA − US)", value: pp(gap), note: `${pp(gap12)} a year ago` },
      coreGap !== undefined && { label: "Core inflation gap", value: pp(coreGap, 1), note: "CPI-trim minus core PCE" },
      s2 && { label: "2-yr yield gap", value: pp(lastV(s2)), note: "Market-implied" },
    ]),
    chart: {
      kind: "line", unit: "%", step: true,
      series: present([line("overnight_rate", C.ca, 10, { label: "Bank of Canada overnight rate" }), line("us_fed_funds", C.us, 10, { label: "U.S. effective fed funds rate" })]),
    },
    chartTitle: "Policy rates, past 10 years (%)",
    explain:
      "Canada usually cannot stray far from the Fed: a much lower Canadian rate weakens the loonie, importing inflation. Divergence opens when the economies differ: "
      + "Canadian households carry more debt on shorter mortgage terms, so rate hikes bite faster here, and Canada's exposure to U.S. trade policy weighs on its growth. "
      + "The 2-year yield gap shows whether markets expect divergence to last.",
    sources: ["Bank of Canada", "FRED"],
    asOf: maxDate(onr, ff),
  };
}

function drivers(): Answer {
  const comps = ["ca_cpi_energy", "ca_cpi_shelter", "ca_cpi_services", "ca_cpi_goods", "ca_cpi_food_stores"].map((n) => get(n));
  const [energy, shelter, services, goods] = comps;
  const headline = get("ca_cpi_all_items"), trim = get("cpi_trim"), median = get("cpi_median"), wti = get("wti_crude_yoy"), ippi = get("ca_ippi_total");
  const usCpi = get("us_cpi"), usCore = get("us_core_cpi");
  const h = headline ? lastV(headline) : NaN, t = trim ? lastV(trim) : NaN;
  let verdict: Verdict;
  let summary: string;
  let series: LineSeries[];
  const hasComps = !!(energy && services);
  if (hasComps) {
    const e = lastV(energy!), sv = lastV(services!), sh = shelter ? lastV(shelter) : NaN;
    if (e - h >= 3 && t < 2.5) verdict = { label: "Supply-driven (energy)", tone: "caution" };
    else if (sv >= 3.5 && t >= 3) verdict = { label: "Demand-driven, broad-based", tone: "bad" };
    else if (sh >= 4) verdict = { label: "Shelter-driven", tone: "caution" };
    else verdict = { label: "Mixed, no dominant driver", tone: "neutral" };
    summary = `Headline CPI is ${pct(h)} (${when(headline!)}). Energy is ${signed(e)}%, services ${signed(sv)}%`
      + `${shelter ? `, shelter ${signed(sh)}%` : ""}${goods ? `, goods ${signed(lastV(goods))}%` : ""}; the Bank of Canada's CPI-trim core measure is ${pct(t)}.`;
    series = present([
      line("ca_cpi_energy", C.s5, 5, { label: "Energy" }), line("ca_cpi_shelter", C.s4, 5, { label: "Shelter" }),
      line("ca_cpi_services", C.s3, 5, { label: "Services" }), line("ca_cpi_all_items", C.ca, 5, { label: "All items" }),
    ]);
  } else {
    const gap = h - t, oil = wti ? lastV(wti) : 0;
    if (gap >= 0.75 && oil >= 20) verdict = { label: "Supply-driven (energy)", tone: "caution" };
    else if (t >= 3) verdict = { label: "Broad-based, demand-driven", tone: "bad" };
    else if (gap >= 0.75) verdict = { label: "Volatile items pushing headline up", tone: "caution" };
    else verdict = { label: "Contained", tone: "good" };
    summary = `Headline CPI is ${pct(h)} but CPI-trim, which strips out the most extreme price moves, is ${pct(t)}${median ? ` and CPI-median ${pct(lastV(median))}` : ""}. `
      + (wti ? `Oil is ${signed(oil, 0)}% from a year ago` : "") + (ippi ? ` and industrial producer prices are ${signed(lastV(ippi))}%` : "")
      + `: the gap between headline and core points to ${gap >= 0.75 ? "cost shocks rather than broad demand pressure" : "little supply-shock distortion"}.`;
    series = present([
      line("ca_cpi_all_items", C.ca, 5, { label: "Headline CPI" }), line("cpi_trim", C.s3, 5, { label: "CPI-trim (core)" }), line("cpi_median", C.s5, 5, { label: "CPI-median (core)" }),
    ]);
  }
  if (usCpi && usCore) summary += ` In the U.S., headline is ${pct(lastV(usCpi))} and core ${pct(lastV(usCore))}.`;
  return {
    id: "inflation-drivers", lens: "policy", short: "Inflation drivers",
    question: "Is inflation driven by supply constraints or overheating demand?",
    verdict, summary,
    metrics: present([
      headline && { label: "Headline CPI", value: pct(h), note: when(headline) },
      trim && { label: "CPI-trim", value: pct(t), note: "BoC core" },
      energy && { label: "Energy CPI", value: `${signed(lastV(energy))}%` },
      services && { label: "Services CPI", value: `${signed(lastV(services))}%` },
      !energy && wti && { label: "WTI crude, y/y", value: `${signed(lastV(wti), 0)}%` },
      ippi && { label: "Producer prices (IPPI)", value: `${signed(lastV(ippi))}%`, note: "Pipeline cost pressure" },
    ]),
    chart: { kind: "line", unit: "% y/y", zero: true, band: [1, 3], bandLabel: "BoC 1–3% target range", series },
    chartTitle: hasComps ? "Canadian CPI by component, % change from a year earlier" : "Headline vs core inflation in Canada, % y/y",
    explain:
      "Supply shocks (oil, shipping, droughts) push up a few prices sharply; demand pressure lifts prices broadly, especially services, where labour is the main cost. "
      + "Interest rates work on demand, so they are the right tool for broad, services-led inflation but a costly one for an energy shock that will fade on its own. "
      + "When headline sits well above core, a supply shock is the likelier culprit.",
    sources: [`${SC} CPI (18-10-0004)`, "Bank of Canada core measures", "FRED"],
    asOf: maxDate(headline, trim),
    pending: hasComps ? undefined : ["ca_cpi_energy", "ca_cpi_shelter", "ca_cpi_services"],
  };
}

function productivity(): Answer {
  const caL = get("ca_gdp_pc_level"), usL = get("us_gdp_pc_level"), caY = get("ca_gdp_per_capita"), usY = get("us_gdp_per_capita");
  const base = {
    id: "productivity", lens: "policy" as const, short: "Productivity",
    question: "Are we experiencing a productivity crisis?",
    explain:
      "Total GDP can grow simply because population grows. Real GDP per working-age person strips that out and tracks living standards. "
      + "Canada's population surged after 2022, so headline growth has flattered the economy while output per person stalled. Sustained gaps with the U.S. point to structural issues: business investment, competition, and adoption of technology.",
    sources: [`${SC} national accounts and LFS`, "BEA and BLS via FRED"],
  };
  if (caL && usL) {
    const idx = (s: NonNullable<typeof caL>) => {
      const b = s.data.find(([d]) => d === "2019-10-01")?.[1];
      return b ? s.data.filter(([d]) => d >= "2015-01-01").map(([d, v]) => [T(d), Number(((100 * v) / b).toFixed(2))] as [number, number]) : [];
    };
    const ci = idx(caL), ui = idx(usL);
    const caCum = ci.at(-1)![1] - 100, usCum = ui.at(-1)![1] - 100, gap = usCum - caCum;
    const verdict: Verdict = caCum <= 0 ? { label: "Yes: output per person has stalled", tone: "bad" }
      : gap >= 5 ? { label: "Falling behind the U.S.", tone: "bad" } : gap >= 2 ? { label: "Lagging", tone: "caution" } : { label: "Keeping pace", tone: "good" };
    return {
      ...base, verdict,
      summary: `Since the end of 2019, real GDP per working-age person is ${signed(caCum)}% in Canada (to ${when(caL)}) versus ${signed(usCum)}% in the U.S.: a ${gap.toFixed(1)}-point gap in living-standard growth.`,
      metrics: [
        { label: "Canada since Q4 2019", value: `${signed(caCum)}%` },
        { label: "U.S. since Q4 2019", value: `${signed(usCum)}%` },
        ...(caY ? [{ label: "Canada, latest y/y", value: `${signed(lastV(caY))}%`, note: when(caY) }] : []),
      ],
      chart: { kind: "line", unit: "index", ref: { y: 100, label: "Q4 2019" },
        series: [{ key: "ca", label: "Canada", color: C.ca, data: ci }, { key: "us", label: "U.S.", color: C.us, data: ui }] },
      chartTitle: "Real GDP per working-age person, indexed to Q4 2019 = 100",
      asOf: maxDate(caL, usL),
    };
  }
  if (!caY || !usY) return { ...base, verdict: { label: "Data pending", tone: "neutral" }, summary: "", metrics: [], chart: null, chartTitle: "", asOf: "" };
  const last8 = (s: typeof caY) => mean(s.data.slice(-8).map(([, v]) => v));
  const ca8 = last8(caY), us8 = last8(usY);
  const verdict: Verdict = ca8 < 0.5 && us8 - ca8 > 1 ? { label: "Falling behind the U.S.", tone: "bad" } : ca8 < 0 ? { label: "Output per person shrinking", tone: "bad" } : { label: "Modest growth", tone: "neutral" };
  return {
    ...base, verdict,
    summary: `Over the last two years real GDP per working-age person grew an average of ${signed(ca8)}% a year in Canada against ${signed(us8)}% in the U.S. Latest: Canada ${signed(lastV(caY))}% (${when(caY)}), U.S. ${signed(lastV(usY))}%.`,
    metrics: [
      { label: "Canada, 2-yr avg growth", value: `${signed(ca8)}%` },
      { label: "U.S., 2-yr avg growth", value: `${signed(us8)}%` },
      { label: "Gap", value: pp(us8 - ca8, 1) },
    ],
    chart: { kind: "bar", unit: "% y/y", zero: true,
      series: present([line("ca_gdp_per_capita", C.ca, 8, { label: "Canada" }), line("us_gdp_per_capita", C.us, 8, { label: "U.S." })]) },
    chartTitle: "Real GDP per working-age person, % change from a year earlier",
    asOf: maxDate(caY, usY),
    pending: ["ca_gdp_pc_level", "us_gdp_pc_level"],
  };
}

function housing(): Answer {
  const nhpi = get("ca_nhpi"), credit = get("ca_mortgage_credit"), m5 = get("ca_mortgage_5y"), varShare = get("ca_variable_mortgage_share"),
    starts = get("ca_housing_starts"), mic = get("ca_cpi_mortgage_interest");
  const c = credit ? lastV(credit) : undefined;
  let verdict: Verdict;
  if (nhpi) {
    const n = lastV(nhpi);
    if (n < 0 && (c ?? 5) < 3) verdict = { label: "Correcting under rate pressure", tone: "caution" };
    else if (n < 0) verdict = { label: "Prices easing", tone: "caution" };
    else if (n > 3 && (c ?? 0) > 5) verdict = { label: "Re-accelerating", tone: "caution" };
    else verdict = { label: "Stalled, not breaking", tone: "neutral" };
  } else {
    verdict = c !== undefined && c < 3 ? { label: "Credit growth has stalled", tone: "caution" } : { label: "No stress signal yet", tone: "neutral" };
  }
  const parts = present([
    nhpi && `New-home prices are ${signed(lastV(nhpi))}% from a year ago (${when(nhpi)})`,
    credit && `bank mortgage balances are growing ${pct(lastV(credit))} a year, ${lastV(credit) < 3 ? "the slowest in years" : "a moderate pace"}`,
    m5 && `posted 5-year fixed rates are ${pct(lastV(m5), 2)}`,
    varShare && `${pct(lastV(varShare), 0)} of new lending is variable-rate, so ${lastV(varShare) > 30 ? "a large share of borrowers feel rate changes immediately" : "most new borrowers are insulated for now"}`,
    mic && `mortgage interest costs in the CPI are ${signed(lastV(mic))}%`,
  ]);
  return {
    id: "housing", lens: "policy", short: "Housing fragility",
    question: "How fragile is the housing market to current rates?",
    verdict,
    summary: parts.length ? `${parts.join("; ")}.`.replace(/^./, (x) => x.toUpperCase()) : "Housing data is not available yet.",
    metrics: present([
      nhpi && { label: "New housing prices, y/y", value: `${signed(lastV(nhpi))}%`, note: when(nhpi) },
      credit && { label: "Mortgage credit growth", value: pct(lastV(credit)), note: when(credit) },
      varShare && { label: "Variable share of new loans", value: pct(lastV(varShare), 0) },
      starts && { label: "Housing starts", value: `${(lastV(starts)).toFixed(0)}k`, note: "Annualized" },
      m5 && { label: "Posted 5-yr fixed", value: pct(lastV(m5), 2) },
    ]),
    chart: {
      kind: "line", unit: nhpi ? "% y/y" : "%", zero: true,
      series: present(nhpi
        ? [line("ca_nhpi", C.s4, 8, { label: "New housing price index, % y/y" }), line("ca_mortgage_credit", C.s3, 8, { label: "Mortgage credit, % y/y" })]
        : [line("ca_mortgage_credit", C.s3, 8, { label: "Mortgage credit, % y/y" }), line("ca_mortgage_5y", C.s4, 8, { label: "Posted 5-year fixed rate, %" })]),
    },
    chartTitle: nhpi ? "New-home prices and mortgage credit, % change from a year earlier" : "Mortgage credit growth (% y/y) and posted 5-year rate (%)",
    explain:
      "Housing breaks when forced sellers meet absent buyers. Rates create forced sellers through renewal shock (borrowers re-pricing from pandemic-era rates) and absent buyers through affordability. "
      + "Falling prices with stalled credit is a structural correction; flat prices with slow credit but few forced sales is a market paused by financing friction, which resumes when rates ease.",
    sources: [`${SC} (18-10-0205, 34-10-0158)`, "Bank of Canada (chartered bank lending)"],
    asOf: maxDate(nhpi, credit, m5),
    pending: nhpi ? undefined : ["ca_nhpi", "ca_cpi_mortgage_interest"],
  };
}

function precarious(): Answer {
  const share = get("ca_part_time_share"), ft = get("ca_ft_employment"), pt = get("ca_pt_employment"), part = get("ca_participation"), emp = get("ca_employment");
  if (share) {
    const c12 = change(share, 12) ?? 0;
    const gap = ft && pt ? lastV(pt) - lastV(ft) : 0;
    const verdict: Verdict = c12 >= 0.5 || gap > 1.5 ? { label: "Shifting toward part-time", tone: "caution" }
      : c12 <= -0.3 ? { label: "Shifting toward full-time", tone: "good" } : { label: "No structural shift", tone: "neutral" };
    return {
      id: "precarious-work", lens: "policy", short: "Job quality",
      question: "Is the labour market shifting toward precarious work?",
      verdict,
      summary: `Part-time jobs make up ${pct(lastV(share))} of employment (${when(share)}), ${pp(c12, 1)} versus a year earlier.`
        + (ft && pt ? ` Full-time employment is ${signed(lastV(ft))}% year over year; part-time ${signed(lastV(pt))}%.` : "")
        + (part ? ` The participation rate is ${pct(lastV(part))}.` : ""),
      metrics: present([
        { label: "Part-time share", value: pct(lastV(share)), note: `${pp(c12, 1)} y/y` },
        ft && { label: "Full-time jobs, y/y", value: `${signed(lastV(ft))}%` },
        pt && { label: "Part-time jobs, y/y", value: `${signed(lastV(pt))}%` },
        part && { label: "Participation rate", value: pct(lastV(part)) },
      ]),
      chart: { kind: "line", unit: "%", series: present([line("ca_part_time_share", C.s5, 15, { label: "Part-time share of employment" })]) },
      chartTitle: "Part-time jobs as a share of all employment in Canada (%)",
      explain:
        "Headline job counts treat a 10-hour gig the same as a 40-hour salaried role. A rising part-time share, especially alongside falling hours, signals hidden underemployment: "
        + "people working less than they want to. Policy that targets only the unemployment rate can miss this deterioration in job quality.",
      sources: [`${SC} Labour Force Survey (14-10-0287)`],
      asOf: share.latest.date,
    };
  }
  const p12 = part ? change(part, 12) ?? 0 : 0;
  return {
    id: "precarious-work", lens: "policy", short: "Job quality",
    question: "Is the labour market shifting toward precarious work?",
    verdict: { label: "Part-time detail pending", tone: "neutral" },
    summary: part ? `The participation rate is ${pct(lastV(part))} (${when(part)}), ${pp(p12, 1)} on the year${emp ? `; employment changed by ${signed(lastV(emp), 0)}k last month` : ""}. Full-time and part-time detail appears after the next data refresh.` : "",
    metrics: present([part && { label: "Participation rate", value: pct(lastV(part)) }, emp && { label: "Employment change", value: `${signed(lastV(emp), 0)}k` }]),
    chart: part ? { kind: "line", unit: "%", series: present([line("ca_participation", C.ca, 15, { label: "Participation rate" })]) } : null,
    chartTitle: "Labour force participation rate, Canada (%)",
    explain: "A rising part-time share signals hidden underemployment that the unemployment rate misses.",
    sources: [`${SC} Labour Force Survey`],
    asOf: maxDate(part, emp),
    pending: ["ca_part_time_share", "ca_ft_employment", "ca_pt_employment"],
  };
}

export const policy = [divergence, drivers, productivity, housing, precarious];
