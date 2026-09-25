import type { TabSpec } from "./types";
import { fmtPeriod, pct } from "./format";

const growth = (v: number) => (v >= 0 ? `grew ${v.toFixed(1)}%` : `contracted ${Math.abs(v).toFixed(1)}%`);

export const TAB_SPECS: TabSpec[] = [
  {
    slug: "output",
    label: "Output & growth",
    question: "Are the Canadian and U.S. economies expanding or entering contraction?",
    kpis: ["ca_gdp_quarterly", "us_gdp", "ca_gdp_monthly", "ca_industrial_production", "us_industrial_production"],
    charts: [
      { title: "Real GDP growth, quarter over quarter (annualized)", series: ["ca_gdp_quarterly", "us_gdp"], kind: "bar", zeroLine: true },
      { title: "Industrial production, year over year", series: ["ca_industrial_production", "us_industrial_production"], kind: "line", zeroLine: true },
      { title: "Real GDP, year over year", series: ["ca_gdp_yoy", "us_gdp_yoy"], kind: "line", zeroLine: true,
        note: "Smoother than annualized quarterly rates: growth over the same quarter a year earlier." },
      { title: "Canada monthly real GDP, year over year", series: ["ca_gdp_monthly"], kind: "line", zeroLine: true,
        note: "Monthly GDP by industry gives an earlier read than the quarterly accounts." },
    ],
    answer: (get) => {
      const ca = get("ca_gdp_quarterly"), us = get("us_gdp");
      if (!ca || !us) return "";
      return `In ${fmtPeriod(ca.latest.date, "Q")}, Canada's real GDP ${growth(ca.latest.value)} at an annual rate; `
        + `the U.S. ${growth(us.latest.value)} in ${fmtPeriod(us.latest.date, "Q")}.`;
    },
  },
  {
    slug: "labour",
    label: "Labour markets",
    question: "Is labour utilization tightening or softening, and how are wage pressures evolving?",
    kpis: ["ca_unemployment", "us_unemployment", "ca_employment", "us_nonfarm_payrolls", "us_avg_hourly_earnings"],
    charts: [
      { title: "Unemployment rate", series: ["ca_unemployment", "us_unemployment"], kind: "line" },
      { title: "Participation rate", series: ["ca_participation", "us_participation_rate"], kind: "line", yDomain: [50, "auto"] },
      { title: "Monthly employment change (thousands)", series: ["ca_employment", "us_nonfarm_payrolls"], kind: "bar", zeroLine: true,
        note: "Canada: Labour Force Survey. U.S.: nonfarm payrolls. Pandemic months dominate the full history." },
      { title: "U.S. average hourly earnings, year over year", series: ["us_avg_hourly_earnings"], kind: "line" },
    ],
    answer: (get) => {
      const ca = get("ca_unemployment"), us = get("us_unemployment");
      if (!ca || !us) return "";
      return `Unemployment is ${pct(ca)} in Canada and ${pct(us)} in the U.S. as of ${fmtPeriod(ca.latest.date, "M")}.`;
    },
  },
  {
    slug: "prices",
    label: "Prices & inflation",
    question: "Where are cost-push pressures relative to consumer inflation, and are central banks hitting their targets?",
    kpis: ["ca_cpi_all_items", "cpi_trim", "us_cpi", "us_core_cpi", "ca_ippi_total"],
    charts: [
      { title: "Headline CPI, year over year", series: ["ca_cpi_all_items", "us_cpi"], kind: "line",
        band: [1, 3], bandLabel: "Bank of Canada 1–3% target range" },
      { title: "Core inflation", series: ["cpi_trim", "us_core_cpi"], kind: "line",
        band: [1, 3], bandLabel: "Bank of Canada 1–3% target range",
        note: "Canada: CPI-trim, the Bank of Canada's preferred core measure. U.S.: CPI excluding food and energy." },
      { title: "Producer vs consumer prices in Canada, year over year", series: ["ca_ippi_total", "ca_cpi_all_items"], kind: "line", zeroLine: true,
        note: "Industrial product prices (IPPI) tend to lead consumer prices when input costs move." },
      { title: "Oil prices vs Canadian producer prices, year over year", series: ["wti_crude_yoy", "ca_ippi_total"], kind: "line", zeroLine: true,
        note: "Energy is a large share of the IPPI, so swings in crude oil feed through to producer prices quickly." },
    ],
    answer: (get) => {
      const ca = get("ca_cpi_all_items"), us = get("us_cpi"), trim = get("cpi_trim");
      if (!ca || !us) return "";
      return `Headline inflation is ${pct(ca)} in Canada and ${pct(us)} in the U.S.; `
        + `the Bank of Canada's CPI-trim core measure is ${pct(trim)}.`;
    },
  },
  {
    slug: "money",
    label: "Money & central banks",
    question: "What is the monetary policy stance, and what is the yield curve signalling about credit conditions?",
    kpis: ["overnight_rate", "us_fed_funds", "ca_spread_10_2", "us_spread_10_2", "prime_rate"],
    charts: [
      { title: "Policy rates", series: ["overnight_rate", "us_fed_funds"], kind: "step" },
      { title: "Yield curve spread, 10-year minus 2-year", series: ["ca_spread_10_2", "us_spread_10_2"], kind: "line", zeroLine: true,
        note: "A negative spread (inverted curve) has preceded most recessions." },
      { title: "Government of Canada benchmark yields", series: ["yield_2yr", "yield_5yr", "yield_10yr"], kind: "line" },
      { title: "Money supply growth, year over year", series: ["m1_gross", "m2pp_gross", "us_m2"], kind: "line", zeroLine: true },
    ],
    answer: (get) => {
      const onr = get("overnight_rate"), ff = get("us_fed_funds"), sp = get("ca_spread_10_2");
      if (!onr || !ff) return "";
      const curve = sp ? ` Canada's 10-year yield sits ${Math.abs(sp.latest.value).toFixed(2)} points ${sp.latest.value >= 0 ? "above" : "below"} the 2-year.` : "";
      return `The Bank of Canada's policy rate is ${onr.latest.value.toFixed(2)}%, against ${ff.latest.value.toFixed(2)}% for U.S. fed funds.${curve}`;
    },
  },
];

export const getSpec = (slug: string) => TAB_SPECS.find((t) => t.slug === slug);
