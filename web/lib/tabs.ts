import type { TabSpec } from "./types";
import { fmtPeriod, pct } from "./format";

const growth = (v: number) => (v >= 0 ? `grew ${v.toFixed(1)}%` : `contracted ${Math.abs(v).toFixed(1)}%`);

export const TAB_SPECS: TabSpec[] = [
  {
    slug: "output",
    label: "Output",
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
    label: "Labour",
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
    label: "Prices",
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
    label: "Central banks",
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
  {
    slug: "sentiment",
    label: "Sentiment",
    question: "Where are consumer and business conditions pointing over the next 3 to 6 months?",
    kpis: ["canada_oecd_cli", "us_oecd_cli", "us_consumer_sentiment", "ca_retail_sales", "us_retail_sales"],
    charts: [
      { title: "OECD composite leading indicators", series: ["canada_oecd_cli", "us_oecd_cli"], kind: "line", refLine: 100,
        note: "100 is the long-term trend. Readings above 100 and rising point to expansion over the next six to nine months." },
      { title: "Leading indicators, change over 12 months", series: ["ca_cli_yoy", "us_cli_yoy"], kind: "line", zeroLine: true,
        note: "Turning points in this momentum measure tend to show up before turning points in GDP." },
      { title: "Retail sales, year over year", series: ["ca_retail_sales", "us_retail_sales"], kind: "line", zeroLine: true,
        note: "Nominal sales, so inflation lifts the growth rate. Canadian history in this table starts in 2017." },
      { title: "U.S. consumer sentiment (University of Michigan)", series: ["us_consumer_sentiment"], kind: "line",
        note: "Index, 1966 Q1 = 100. FRED publishes it with a one-month delay." },
    ],
    answer: (get) => {
      const ca = get("canada_oecd_cli"), us = get("us_oecd_cli");
      if (!ca || !us) return "";
      const side = (v: number) => (v >= 100 ? "above" : "below");
      return `Canada's OECD leading indicator is ${ca.latest.value.toFixed(1)}, ${side(ca.latest.value)} its long-term trend of 100; `
        + `the U.S. reading is ${us.latest.value.toFixed(1)} (${fmtPeriod(ca.latest.date, "M")}).`;
    },
  },
  {
    slug: "trade",
    label: "Trade & FX",
    question: "How sensitive is the Canadian economy to currency swings, oil prices and cross-border trade shocks?",
    kpis: ["cad_usd_combined", "wti_crude", "cad_oil_corr_12m", "ca_us_export_share", "ca_trade_balance"],
    charts: [
      { title: "Canadian dollar vs crude oil", series: ["cad_usd_combined", "wti_crude"], kind: "line", right: ["wti_crude"],
        note: "Monthly averages. Canada is a large oil exporter, so the loonie often moves with crude." },
      { title: "How closely the loonie tracks oil", series: ["cad_oil_corr_12m", "cad_oil_corr_36m"], kind: "line",
        zeroLine: true, yDomain: [-1, 1],
        note: "Rolling correlation of monthly percentage changes in CAD/USD and WTI. 1 means they move together perfectly." },
      { title: "Share of Canadian merchandise exports going to the U.S.", series: ["ca_us_export_share"], kind: "line",
        note: "A simple gauge of exposure to U.S. trade policy, including tariffs under CUSMA." },
      { title: "Trade balances", series: ["ca_trade_balance", "us_trade_balance"], kind: "line", zeroLine: true,
        right: ["us_trade_balance"],
        note: "Canada: merchandise trade, CAD millions. U.S.: goods and services, USD millions (right axis)." },
    ],
    answer: (get) => {
      const cad = get("cad_usd_combined"), wti = get("wti_crude"), c = get("cad_oil_corr_12m");
      if (!cad || !wti) return "";
      const corr = c ? ` Over the past year, their monthly moves had a correlation of ${c.latest.value.toFixed(2)}.` : "";
      return `The Canadian dollar is averaging ${(cad.latest.value * 100).toFixed(1)} U.S. cents this month, with WTI crude near $${wti.latest.value.toFixed(0)}.${corr}`;
    },
  },
];

export const getSpec = (slug: string) => TAB_SPECS.find((t) => t.slug === slug);
