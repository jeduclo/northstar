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
      { title: "Real GDP per working-age person, year over year", series: ["ca_gdp_per_capita", "us_gdp_per_capita"], kind: "line", zeroLine: true,
        note: "Strips out population growth. Canada's rapid immigration-driven population gains can lift headline GDP while output per person falls." },
      { title: "Sahm-rule recession indicator", series: ["ca_sahm", "us_sahm"], kind: "line", refLine: 0.5,
        note: "Three-month average unemployment rate minus its low over the prior 12 months. Readings above 0.5 (dashed) have marked the start of every U.S. recession since 1970; the rule is noisier for Canada." },
      { title: "Industrial capacity utilization", series: ["ca_capacity_util", "us_capacity_util"], kind: "line", refLine: 80,
        note: "Share of industrial capacity in use (Canada quarterly, U.S. monthly). Readings well above 80% (dashed) signal cost pressure and a case for investment; falling readings signal slack." },
      { title: "U.S. recession probability", series: ["us_recession_prob"], kind: "line", yDomain: [0, 100],
        note: "Smoothed probability from a dynamic-factor Markov-switching model (Chauvet–Piger), published with a lag of about two months." },
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
    kpis: ["ca_unemployment", "us_unemployment", "ca_employment", "us_nonfarm_payrolls", "ca_avg_hourly_wages", "us_avg_hourly_earnings"],
    charts: [
      { title: "Unemployment rate", series: ["ca_unemployment", "us_unemployment"], kind: "line" },
      { title: "Participation rate", series: ["ca_participation", "us_participation_rate"], kind: "line", yDomain: [50, "auto"] },
      { title: "Monthly employment change (thousands)", series: ["ca_employment", "us_nonfarm_payrolls"], kind: "bar", zeroLine: true,
        note: "Canada: Labour Force Survey. U.S.: nonfarm payrolls. Pandemic months dominate the full history." },
      { title: "Wage growth, year over year", series: ["ca_avg_hourly_wages", "us_avg_hourly_earnings"], kind: "line",
        note: "Canada: LFS average hourly wages, all employees (unadjusted, so compare year over year only). U.S.: average hourly earnings, private payrolls. Both shift with the mix of jobs, not just pay rates." },
      { title: "Real wage growth", series: ["ca_real_wage_growth", "us_real_wage_growth"], kind: "line", zeroLine: true,
        note: "Wage growth minus headline CPI inflation, in percentage points. Positive readings support consumer spending." },
      { title: "Job openings per unemployed person", series: ["ca_openings_per_unemployed", "us_openings_per_unemployed"], kind: "line", refLine: 1,
        note: "Vacancies divided by unemployed persons (Canada: Job Vacancy and Wage Survey and LFS; U.S.: JOLTS). Above 1 (dashed) means more vacancies than job seekers." },
      { title: "U.S. quits rate vs wage growth", series: ["us_quits_rate", "us_avg_hourly_earnings"], kind: "line", right: ["us_avg_hourly_earnings"],
        note: "Workers quit more when they are confident of finding better pay; the quits rate tends to lead wage growth by a few months." },
      { title: "Jobless benefit claims", series: ["ca_ei_claims", "us_initial_claims"], kind: "line", right: ["us_initial_claims"],
        note: "Canada: EI initial and renewal claims received per month. U.S.: initial claims, average per week (right axis). The most timely layoff signals; a sustained rise usually precedes higher unemployment." },
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
    kpis: ["ca_cpi_all_items", "cpi_trim", "us_cpi", "us_core_cpi", "us_core_pce", "ca_ippi_total"],
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
      { title: "Bank of Canada preferred core measures", series: ["cpi_trim", "cpi_median", "cpi_common"], kind: "line",
        band: [1, 3], bandLabel: "Bank of Canada 1–3% target range",
        note: "The Bank watches all three. When they diverge, CPI-common (driven by broad, shared price moves) is the least noisy but is revised the most." },
      { title: "U.S. core PCE vs core CPI", series: ["us_core_pce", "us_core_cpi"], kind: "line", refLine: 2,
        note: "The Fed targets 2% PCE inflation (dashed), not CPI. PCE gives shelter a smaller weight, so it usually runs below CPI." },
      { title: "Core inflation momentum, 3-month annualized", series: ["ca_core_cpi_3m", "us_core_pce_3m", "us_core_cpi_3m"], kind: "line", refLine: 2,
        note: "Annualized change over the last three months in seasonally adjusted core prices (Canada: CPI excluding food and energy). Turns before the year-over-year rate, but is noisier. Dashed line: 2% target." },
      { title: "Market inflation expectations", series: ["us_breakeven_10y", "us_5y5y", "ca_breakeven_long"], kind: "line",
        note: "Nominal minus inflation-linked bond yields. The 5y5y rate is the one central banks watch for de-anchoring. Canada stopped issuing Real Return Bonds in 2022, so its thin market makes the Canadian measure a rough guide only." },
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
      { title: "Real policy rates", series: ["ca_real_policy_rate", "us_real_policy_rate"], kind: "line", zeroLine: true,
        note: "Policy rate minus core inflation (Canada: CPI-trim; U.S.: core PCE). A rough gauge of stance: the Bank of Canada puts the real neutral rate at about 0.25–1.25% and the Fed's longer-run estimate implies about 1%." },
      { title: "U.S. credit spreads and financial conditions", series: ["us_baa_spread", "us_nfci"], kind: "line", right: ["us_nfci"],
        note: "Baa corporate bond yield minus the 10-year Treasury (left). Chicago Fed NFCI (right): above zero means tighter-than-average conditions. Both widen ahead of and during downturns." },
      { title: "Mortgage rates", series: ["ca_mortgage_5y", "us_mortgage_30y"], kind: "line",
        note: "Canada: banks' posted 5-year fixed rate, which sets the mortgage stress test; discounted rates are lower. U.S.: Freddie Mac 30-year fixed. Canadian mortgages renew every few years, so rate changes reach households faster." },
      { title: "U.S. banks tightening business-loan standards", series: ["us_sloos_ci"], kind: "bar", zeroLine: true,
        note: "Fed Senior Loan Officer Survey: net share of banks tightening standards on loans to large and mid-sized firms. Sustained readings above zero preceded the 1990, 2001 and 2008 recessions." },
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
      { title: "Real retail sales, year over year", series: ["ca_real_retail_sales", "us_real_retail_sales"], kind: "line", zeroLine: true,
        note: "Volumes rather than dollars. Canada: nominal sales deflated by headline CPI. U.S.: Census retail sales deflated by CPI." },
      { title: "Housing starts and permits", series: ["ca_housing_starts", "us_housing_starts", "us_building_permits"], kind: "line",
        note: "Thousands of units, seasonally adjusted annual rate (Canada: CMHC starts). Housing is among the most rate-sensitive sectors; U.S. permits lead starts by a month or two." },
      { title: "New orders, year over year", series: ["ca_mfg_new_orders", "us_core_capex_orders"], kind: "line", zeroLine: true,
        note: "Canada: all manufacturing new orders. U.S.: nondefense capital goods excluding aircraft, the standard read on business investment plans. Nominal dollars." },
      { title: "Consumers' expected inflation, next 12 months", series: ["ca_consumer_infl_exp", "us_consumer_infl_exp"], kind: "line",
        note: "Canada: Bank of Canada Survey of Consumer Expectations (quarterly, from 2014). U.S.: University of Michigan (monthly). Rising household expectations make central banks slower to cut." },
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
      { title: "Commodity prices, year over year", series: ["bcpi_total", "bcpi_energy", "bcpi_ex_energy"], kind: "line", zeroLine: true,
        note: "Bank of Canada commodity price index in U.S. dollars, a proxy for Canada's terms of trade. Metals, forestry and farm goods (ex-energy) matter more outside the Prairies." },
      { title: "Canadian dollar vs the Canada–U.S. 2-year yield gap", series: ["cad_usd_combined", "ca_us_2y_spread"], kind: "line", right: ["ca_us_2y_spread"],
        note: "The 2-year gap reflects where markets expect each central bank's rate to go. A wider negative gap typically weighs on the loonie, independent of oil." },
      { title: "Canadian dollar vs the broad U.S. dollar", series: ["cad_usd_combined", "us_broad_dollar"], kind: "line", right: ["us_broad_dollar"],
        note: "Fed's trade-weighted U.S. dollar index (right). When both lines move against each other, the move is mostly about the U.S. dollar rather than Canada." },
      { title: "Canadian exports: U.S. vs rest of world, year over year", series: ["ca_exports_to_us", "ca_exports_non_us"], kind: "line", zeroLine: true,
        note: "Shows whether exporters are diversifying away from the U.S. market as tariffs change. Merchandise trade, customs basis." },
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
