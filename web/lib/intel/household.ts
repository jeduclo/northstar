import { forecasts } from "../data";
import type { Answer, Verdict } from "../intel-types";
import {
  C, T, ago, change, get, lastV, line, maxDate, median, pct, percentile, pp, present,
  recessionSpans, signed, values, when,
} from "./helpers";

const BOC = "Bank of Canada Valet";
const SC = "Statistics Canada";

function mortgage(): Answer {
  const onr = get("overnight_rate"), prime = get("prime_rate"), y5 = get("yield_5yr"), m5 = get("ca_mortgage_5y");
  const base = {
    id: "mortgage", lens: "household" as const, short: "Fixed or variable?",
    question: "Should I lock in my mortgage or stay variable?",
    chartTitle: "Policy rate, prime, 5-year bond yield and posted 5-year mortgage rate (%)",
    explain:
      "Variable mortgage rates move with prime, which moves one-for-one with the Bank of Canada's overnight rate. "
      + "Fixed 5-year rates are priced off the 5-year Government of Canada bond yield plus a lender margin. "
      + "When the 5-year yield sits well above the overnight rate, bond markets expect the policy rate to rise; when it sits below, they expect cuts. "
      + "Fixing buys certainty; staying variable is a bet that rates fall or stay put. This is information, not financial advice.",
    sources: [BOC, `${SC} (table 10-10-0145)`],
  };
  if (!onr || !y5) {
    return { ...base, verdict: { label: "Data pending", tone: "neutral" }, summary: "Rate data is not available yet.", metrics: [], chart: null, asOf: "" };
  }
  const gap = lastV(y5) - lastV(onr);
  const y5chg = change(y5, 3) ?? 0;
  const fc = forecasts?.macro.find((m) => m.name === "overnight_rate")?.forecast.at(-1);
  let verdict: Verdict;
  let why: string;
  if (gap <= -0.25) {
    verdict = { label: "Variable has the edge", tone: "good" };
    why = "Bond markets are pricing rate cuts, so a variable rate tied to prime is more likely to fall than rise.";
  } else if (gap >= 0.75 && y5chg >= 0.15) {
    verdict = { label: "Fixed rates are climbing: lock sooner", tone: "caution" };
    why = `Markets expect higher policy rates and the 5-year yield, which drives fixed rates, has risen ${pp(y5chg)} in three months.`;
  } else if (gap >= 0.75) {
    verdict = { label: "Variable cheaper now, but rates expected to rise", tone: "caution" };
    why = "Variable is cheaper today, but bond markets expect the policy rate to rise; locking in removes that risk.";
  } else {
    verdict = { label: "Close call", tone: "neutral" };
    why = "Bond markets expect the policy rate to stay roughly where it is, so the choice comes down to how much payment certainty you need.";
  }
  const fcText = fc ? ` Our forecast model puts the overnight rate near ${pct(fc[2], 2)} in a year (80% range ${pct(fc[1], 2)}–${pct(fc[3], 2)}).` : "";
  return {
    ...base,
    verdict,
    summary: `The 5-year bond yield is ${pct(lastV(y5), 2)} against a ${pct(lastV(onr), 2)} overnight rate (${when(y5)}). ${why}${fcText}`,
    metrics: present([
      { label: "BoC overnight rate", value: pct(lastV(onr), 2), note: when(onr) },
      prime && { label: "Prime rate", value: pct(lastV(prime), 2), note: "Variable rates are quoted off this" },
      { label: "5-year GoC yield", value: pct(lastV(y5), 2), note: `${pp(y5chg)} over 3 months` },
      m5 && { label: "Posted 5-year fixed", value: pct(lastV(m5), 2), note: "Posted rate; most borrowers pay less" },
    ]),
    chart: {
      kind: "line", unit: "%",
      series: present([
        line("overnight_rate", C.ca, 6, { label: "BoC overnight rate" }),
        line("prime_rate", C.s3, 6, { label: "Prime rate" }),
        line("yield_5yr", C.s5, 6, { label: "5-year GoC bond yield" }),
        line("ca_mortgage_5y", C.s4, 6, { label: "Posted 5-year fixed mortgage", dash: "5 3" }),
      ]),
    },
    asOf: maxDate(onr, y5),
  };
}

function groceries(): Answer {
  const food = get("ca_cpi_food_stores"), wage = get("ca_avg_hourly_wages"), cpi = get("ca_cpi_all_items");
  const base = {
    id: "groceries", lens: "household" as const, short: "Groceries",
    question: "Are groceries finally getting cheaper?",
    chartTitle: "Grocery prices vs wages, % change from a year earlier",
    explain:
      "Inflation measures how fast prices rise, not whether they are high. Grocery prices getting 'cheaper' would need negative inflation, which is rare. "
      + "What matters for your budget is whether pay is rising faster than your grocery bill: if wage growth beats food inflation, the same paycheque buys more food than a year ago.",
    sources: [`${SC} CPI (18-10-0004)`, `${SC} Labour Force Survey (14-10-0063)`],
  };
  const price = food ?? cpi;
  if (!price || !wage) {
    return { ...base, verdict: { label: "Data pending", tone: "neutral" }, summary: "Price or wage data is not available yet.", metrics: [], chart: null, asOf: "" };
  }
  const p = lastV(price), w = lastV(wage), gap = w - p;
  const what = food ? "Grocery prices" : "Consumer prices overall";
  const prev = ago(price, 3);
  let verdict: Verdict;
  if (p < 0) verdict = { label: "Yes: prices are falling", tone: "good" };
  else if (gap > 0.5) verdict = { label: "Not cheaper, but pay is outpacing them", tone: "good" };
  else if (gap < -0.5) verdict = { label: "No: groceries are outpacing pay", tone: "bad" };
  else verdict = { label: "No: rising about as fast as pay", tone: "neutral" };
  const trend = prev === undefined ? "" : p < prev ? ` Inflation here has slowed from ${pct(prev)} three months earlier.` : p > prev ? ` That's faster than the ${pct(prev)} pace three months earlier.` : "";
  return {
    ...base,
    verdict,
    summary: `${what} are ${p >= 0 ? "up" : "down"} ${pct(Math.abs(p))} from a year ago (${when(price)}), while average hourly wages are up ${pct(w)}.${trend}`,
    metrics: present([
      { label: food ? "Grocery inflation" : "Headline CPI", value: pct(p), note: when(price) },
      { label: "Wage growth", value: pct(w), note: when(wage) },
      { label: "Pay minus prices", value: pp(gap, 1), note: gap >= 0 ? "Purchasing power rising" : "Purchasing power falling" },
      food && cpi && { label: "All-items CPI", value: pct(lastV(cpi)), note: "For comparison" },
    ]),
    chart: {
      kind: "line", unit: "% y/y", zero: true,
      series: present([
        food ? line("ca_cpi_food_stores", C.s4, 6, { label: "Food purchased from stores" }) : null,
        line("ca_avg_hourly_wages", C.s3, 6, { label: "Average hourly wages" }),
        line("ca_cpi_all_items", C.ca, 6, { label: "All-items CPI", dash: "5 3" }),
      ]),
    },
    asOf: maxDate(price, wage),
    pending: food ? undefined : ["ca_cpi_food_stores"],
  };
}

function crossBorder(): Answer {
  const cad = get("cad_usd_combined");
  const base = {
    id: "cross-border", lens: "household" as const, short: "U.S. trips",
    question: "Is it a good time for cross-border shopping or U.S. travel?",
    chartTitle: "U.S. dollars per Canadian dollar, past 10 years",
    explain:
      "The exchange rate sets what Canadians pay for anything priced in U.S. dollars: trips, online orders, snowbird housing. "
      + "We compare today's rate with every month of the past decade: a reading in the top third means your dollar goes further than usual.",
    sources: [BOC, "FRED (backfill before 2017)"],
  };
  if (!cad) return { ...base, verdict: { label: "Data pending", tone: "neutral" }, summary: "", metrics: [], chart: null, asOf: "" };
  const v = lastV(cad), p = percentile(cad, 10), avg = values(cad, 10).reduce((a, b) => a + b, 0) / values(cad, 10).length;
  const yr = ago(cad, 12);
  const chg = yr ? (100 * (v / yr - 1)) : undefined;
  const verdict: Verdict = p >= 67 ? { label: "Good time: strong loonie", tone: "good" }
    : p <= 33 ? { label: "Expensive: weak loonie", tone: "bad" }
    : { label: "About average", tone: "neutral" };
  return {
    ...base,
    verdict,
    summary: `One Canadian dollar buys US$${v.toFixed(3)} (${when(cad)}), so a US$100 purchase costs about C$${(100 / v).toFixed(0)} before card fees. `
      + `The loonie is stronger than in ${p}% of months over the past decade${chg !== undefined ? ` and ${signed(chg)}% versus a year ago` : ""}.`,
    metrics: present([
      { label: "CAD/USD", value: `$${v.toFixed(3)}`, note: when(cad) },
      { label: "Cost of US$100", value: `C$${(100 / v).toFixed(2)}` },
      { label: "10-year percentile", value: `${p}th`, note: "100 = strongest" },
      chg !== undefined && { label: "1-year change", value: `${signed(chg)}%` },
    ]),
    chart: {
      kind: "line", unit: "USD per CAD",
      series: present([line("cad_usd_combined", C.ca, 10, { label: "CAD/USD exchange rate" })]),
      ref: { y: Number(avg.toFixed(3)), label: "10-year average" },
    },
    asOf: cad.latest.date,
  };
}

function jobs(): Answer {
  const u = get("ca_unemployment"), emp = get("ca_employment"), sahm = get("ca_sahm"), vac = get("ca_openings_per_unemployed");
  const base = {
    id: "jobs", lens: "household" as const, short: "Job security",
    question: "Is the job market safe right now?",
    chartTitle: "Canada's unemployment rate (%), recessions shaded",
    explain:
      "The unemployment rate's level matters less than how fast it is rising. The Sahm rule flags trouble when the three-month average jumps 0.5 points above its low of the prior year: "
      + "that pace has historically meant layoffs are spreading. Vacancies per unemployed person show your bargaining power: below 0.5 means many applicants per opening.",
    sources: [`${SC} Labour Force Survey`, `${SC} Job Vacancy and Wage Survey`],
  };
  if (!u) return { ...base, verdict: { label: "Data pending", tone: "neutral" }, summary: "", metrics: [], chart: null, asOf: "" };
  const u12 = change(u, 12) ?? 0;
  const s = sahm ? lastV(sahm) : 0;
  const recent = emp ? emp.data.slice(-3).map(([, v]) => v) : [];
  const emp3 = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : undefined;
  let verdict: Verdict;
  if (s >= 0.5) verdict = { label: "Warning: layoffs are spreading", tone: "bad" };
  else if (s >= 0.3 || u12 >= 0.5) verdict = { label: "Softening", tone: "caution" };
  else if (u12 <= 0 && (emp3 ?? 0) > 0) verdict = { label: "Solid", tone: "good" };
  else verdict = { label: "Stable but not tight", tone: "neutral" };
  const empText = emp3 !== undefined ? ` Employment ${emp3 >= 0 ? "grew" : "fell"} by an average of ${Math.abs(emp3).toFixed(0)},000 a month over the last three months.` : "";
  const vacText = vac ? ` There are ${lastV(vac).toFixed(2)} job vacancies per unemployed person (${when(vac)}).` : "";
  const start = T(u.latest.date) - 10 * 365.25 * 86_400_000;
  return {
    ...base,
    verdict,
    summary: `Unemployment is ${pct(lastV(u))} (${when(u)}), ${u12 >= 0 ? "up" : "down"} ${Math.abs(u12).toFixed(1)} points from a year earlier.${empText}${vacText}`,
    metrics: present([
      { label: "Unemployment rate", value: pct(lastV(u)), note: `${signed(u12)} pts y/y` },
      emp3 !== undefined && { label: "Jobs added (3-mo avg)", value: `${signed(emp3, 0)}k` },
      sahm && { label: "Sahm indicator", value: lastV(sahm).toFixed(2), note: "0.5+ = recession signal" },
      vac && { label: "Vacancies per unemployed", value: lastV(vac).toFixed(2) },
    ]),
    chart: {
      kind: "line", unit: "%",
      series: present([line("ca_unemployment", C.ca, 10, { label: "Canada unemployment rate" })]),
      recessions: recessionSpans(["CA"], start),
    },
    asOf: maxDate(u, emp),
  };
}

function bigTicket(): Answer {
  const dur = get("ca_cpi_durables"), veh = get("ca_cpi_vehicles"), prime = get("prime_rate");
  const base = {
    id: "big-ticket", lens: "household" as const, short: "Cars & appliances",
    question: "Is it a bad time to buy a car or appliances?",
    chartTitle: "Durable-goods and vehicle prices (% y/y) vs the prime rate (%)",
    explain:
      "Two things set the real cost of a big purchase: the sticker price and the cost of financing it. Durable-goods inflation tells you whether sticker prices are rising or being discounted; "
      + "the prime rate drives most consumer loans and lines of credit. Falling prices with falling rates is the best window; rising prices with high rates is the worst.",
    sources: [`${SC} CPI (18-10-0004)`, `${SC} (10-10-0145)`],
  };
  if (!prime) return { ...base, verdict: { label: "Data pending", tone: "neutral" }, summary: "", metrics: [], chart: null, asOf: "" };
  const pr = lastV(prime), med = median(values(prime, 10)), prChg = change(prime, 12) ?? 0;
  let verdict: Verdict;
  let summary: string;
  if (dur) {
    const d = lastV(dur);
    if (d < 0 && prChg <= 0) verdict = { label: "Good window", tone: "good" };
    else if (d > 2 && pr > med) verdict = { label: "Wait if you can", tone: "bad" };
    else if (pr > med + 1) verdict = { label: "Prices fine, financing expensive", tone: "caution" };
    else verdict = { label: "Neutral", tone: "neutral" };
    summary = `Durable-goods prices are ${d >= 0 ? "up" : "down"} ${pct(Math.abs(d))} from a year ago (${when(dur)})`
      + `${veh ? `, vehicle prices ${lastV(veh) >= 0 ? "up" : "down"} ${pct(Math.abs(lastV(veh)))}` : ""}. `
      + `The prime rate is ${pct(pr, 2)}, ${pr > med ? "above" : "below"} its 10-year median of ${pct(med, 2)} and ${prChg === 0 ? "unchanged" : `${signed(prChg, 2)} pts`} over the year.`;
  } else {
    verdict = pr > med + 0.5 ? { label: "Financing is expensive", tone: "caution" } : pr < med - 0.5 ? { label: "Financing is cheap", tone: "good" } : { label: "Financing about normal", tone: "neutral" };
    summary = `The prime rate is ${pct(pr, 2)} versus a 10-year median of ${pct(med, 2)}. Durable-goods price data will appear after the next data refresh.`;
  }
  return {
    ...base,
    verdict,
    summary,
    metrics: present([
      dur && { label: "Durable-goods inflation", value: pct(lastV(dur)), note: when(dur) },
      veh && { label: "Vehicle price inflation", value: pct(lastV(veh)), note: when(veh) },
      { label: "Prime rate", value: pct(pr, 2), note: `10-yr median ${pct(med, 2)}` },
    ]),
    chart: {
      kind: "line", unit: "%", zero: true,
      series: present([
        line("ca_cpi_durables", C.s4, 6, { label: "Durable goods prices, % y/y" }),
        line("ca_cpi_vehicles", C.s5, 6, { label: "Vehicle prices, % y/y" }),
        line("prime_rate", C.s3, 6, { label: "Prime rate, %", dash: "5 3" }),
      ]),
    },
    asOf: maxDate(dur, prime),
    pending: dur ? undefined : ["ca_cpi_durables", "ca_cpi_vehicles"],
  };
}

export const household = [mortgage, groceries, crossBorder, jobs, bigTicket];
