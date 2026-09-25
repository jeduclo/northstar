import { getTab, manifest } from "@/lib/data";
import { fmtPeriod, fmtRefreshed } from "@/lib/format";
import { TAB_SPECS } from "@/lib/tabs";
import type { Series } from "@/lib/types";

export const metadata = { title: "Methodology | NorthStar" };

const FREQ = { D: "Daily", W: "Weekly", M: "Monthly", Q: "Quarterly" } as const;

const SOURCES = [
  { name: "Bank of Canada Valet API", what: "Policy rate, benchmark and Real Return Bond yields, CAD/USD, CPI-trim/median/common, commodity price index (BCPI)", freq: "Daily / monthly", lag: "1–2 days" },
  { name: "Statistics Canada (WDS vector API)", what: "CPI, Labour Force Survey (incl. wages), IPPI, retail trade, GDP, merchandise trade, M1+/M2++, prime and 5-year mortgage rates", freq: "Weekly / monthly / quarterly", lag: "3–8 weeks" },
  { name: "FRED, St. Louis Fed (official API)", what: "U.S. GDP, jobs, JOLTS, claims, CPI, PCE, breakevens, rates, credit spreads, NFCI, loan-officer survey, housing, orders, sentiment, trade, broad dollar, WTI, OECD leading indicators", freq: "Daily / monthly / quarterly", lag: "1 day to 3 months" },
  { name: "Yahoo Finance (yfinance)", what: "Canadian iShares and U.S. Select Sector SPDR ETF prices", freq: "Daily", lag: "1 day" },
];

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-12 font-serif text-2xl font-semibold">{children}</h2>;
}

export default function Methodology() {
  const series: (Series & { tab: string })[] = TAB_SPECS.flatMap(
    (t) => (getTab(t.slug)?.series ?? []).map((s) => ({ ...s, tab: t.label })),
  );

  return (
    <article className="max-w-3xl leading-relaxed">
      <h1 className="font-serif text-3xl leading-tight font-semibold sm:text-4xl">How NorthStar works</h1>
      <p className="mt-3 text-lg text-muted">
        Where the numbers come from, how they are transformed, what the models do, and where their limits are.
        Data last refreshed {fmtRefreshed(manifest.generated_at)} ET.
      </p>

      <H2>Data sources</H2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b border-line text-muted">
            <th className="py-2 pr-4 font-medium">Source</th><th className="py-2 pr-4 font-medium">What</th>
            <th className="py-2 pr-4 font-medium">Frequency</th><th className="py-2 font-medium">Typical lag</th>
          </tr></thead>
          <tbody>{SOURCES.map((s) => (
            <tr key={s.name} className="border-b border-line/60 align-top">
              <td className="py-2 pr-4 font-medium">{s.name}</td><td className="py-2 pr-4">{s.what}</td>
              <td className="py-2 pr-4 whitespace-nowrap">{s.freq}</td><td className="py-2 whitespace-nowrap">{s.lag}</td>
            </tr>))}
          </tbody>
        </table>
      </div>

      <H2>Pipeline and refresh</H2>
      <p className="mt-4">
        A GitHub Actions job runs at 10:00 ET every weekday, after the 8:30 ET statistical releases. It ingests all
        sources, builds a DuckDB warehouse in three layers (raw, clean, marts), exports JSON and Parquet files, and
        commits them. The commit triggers a new Vercel deployment, so every page is pre-rendered with the latest data.
        The run stops before deploying if any source fails or if a data-quality check fails (missing series, duplicate
        rows, data older than 120 days), so the site keeps showing the last good data instead of a broken update.
      </p>

      <H2>Transformations</H2>
      <ul className="mt-4 list-disc space-y-2 pl-5">
        <li><strong>Frequencies.</strong> Daily and weekly series are averaged to monthly. Policy and prime rates use the rate in force at month end. Dates mark the start of each month or quarter.</li>
        <li><strong>Month to date.</strong> Series built from daily data include the current, incomplete month; the dashboard labels these readings &quot;Month to date&quot;.</li>
        <li><strong>Growth rates.</strong> Year-over-year change compares with the same period a year earlier. Quarterly GDP growth is annualized: ((this quarter ÷ last quarter)⁴ − 1) × 100.</li>
        <li><strong>Spliced exchange rate.</strong> The Bank of Canada CAD/USD series starts in 2017; earlier months use FRED&apos;s USD/CAD rate, inverted.</li>
        <li><strong>Policy rate before April 2009.</strong> Filled from the Bank of Canada&apos;s published rate decisions, entered by hand.</li>
        <li><strong>Recessions.</strong> U.S. dates follow the NBER (FRED series USREC). Canadian dates follow the C.D. Howe Institute Business Cycle Council and are entered by hand.</li>
        <li><strong>Relative strength.</strong> A sector ETF&apos;s return minus its market benchmark&apos;s return over the same window (S&amp;P/TSX 60 via XIU for Canada, S&amp;P 500 via SPY for the U.S.), in percentage points.</li>
        <li><strong>Derived indicators.</strong> Real policy rates subtract core inflation (CPI-trim; core PCE) from the policy rate. Real wage growth subtracts headline CPI inflation from wage growth. GDP per working-age person divides real GDP by the quarterly average of the LFS population aged 15+ (Canada) or the civilian population aged 16+ (U.S.). The Sahm rule is the 3-month average unemployment rate minus its lowest 3-month average over the previous 12 months. Canada&apos;s breakeven inflation is the long-term benchmark yield minus the Real Return Bond yield.</li>
        <li><strong>3-month annualized rates.</strong> ((this month ÷ three months earlier)⁴ − 1) × 100.</li>
        <li><strong>CAD–oil correlation.</strong> Rolling correlation of monthly percentage changes, computed only over complete 12- or 36-month windows.</li>
      </ul>

      <H2>Models</H2>
      <ul className="mt-4 list-disc space-y-2 pl-5">
        <li><strong>Forecasts (Amazon Chronos-2).</strong> A pretrained time-series foundation model used zero-shot, without training on this data. It produces 12-month paths at the 10th, 50th and 90th percentiles. Each series is back-tested on its last 12 months against a no-change forecast, and the result is shown next to the chart.</li>
        <li><strong>Rate-shock effects (DoubleML).</strong> A partially linear model estimates how a Bank of Canada rate change relates to same-month sector returns, after removing what U.S. inflation and rates, oil, the Canadian dollar, unemployment and recent returns explain. Random forests handle the controls, with 5-fold cross-fitting. Effects are reported per 0.25 percentage point with 95% confidence intervals.</li>
        <li><strong>Macro radar.</strong> Not a model: each pillar is today&apos;s reading as a percentile of its own history since 2006.</li>
      </ul>
      <p className="mt-4">
        Model outputs are refreshed by re-running the Colab notebook, not daily. The date of the last run appears on the Forecast &amp; scenarios page.
      </p>

      <H2>Ask the data</H2>
      <p className="mt-4">
        The assistant sends your question and a data dictionary to Claude, which writes one SQL query. The query runs in an
        in-memory DuckDB database holding only the dashboard&apos;s tables, with file, network and settings access switched off.
        Only single read-only SELECT statements are accepted, results are capped at 1,000 rows, and a second model call
        summarizes the rows it returned. The SQL is always shown so answers can be checked.
      </p>

      <H2>Limitations</H2>
      <ul className="mt-4 list-disc space-y-2 pl-5">
        <li>Canadian retail sales in this table start in 2017. The Staples and Utilities ETFs in Canada start in 2012.</li>
        <li>Canadian ETFs are priced in Canadian dollars and U.S. ETFs in U.S. dollars, so cross-border return gaps include currency moves.</li>
        <li>Retail sales are nominal, so inflation lifts their growth rates.</li>
        <li>The causal estimates rest on about 20 years of monthly data and relatively few policy moves, and markets often price moves before they happen. Most effects are not statistically significant; treat them as exploratory.</li>
        <li>Chronos-2 forecasts carry no economic structure. They extrapolate patterns and can miss turning points.</li>
        <li>Statistical agencies revise past data. The dashboard always shows the latest vintage, not what was known at the time.</li>
        <li>Nothing on this site is investment advice.</li>
      </ul>

      <H2>Series catalog</H2>
      <p className="mt-4 text-muted">Every series on the dashboard, generated from the live data.</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead><tr className="border-b border-line text-muted">
            <th className="py-2 pr-3 font-medium">Section</th><th className="py-2 pr-3 font-medium">Series</th>
            <th className="py-2 pr-3 font-medium">Country</th><th className="py-2 pr-3 font-medium">Shown as</th>
            <th className="py-2 pr-3 font-medium">Frequency</th><th className="py-2 font-medium">Latest</th>
          </tr></thead>
          <tbody>{series.map((s) => (
            <tr key={`${s.tab}-${s.name}`} className="border-b border-line/60">
              <td className="py-1.5 pr-3 whitespace-nowrap">{s.tab}</td>
              <td className="py-1.5 pr-3">{s.description} <span className="text-muted">({s.name})</span></td>
              <td className="py-1.5 pr-3">{s.country === "CA" ? "Canada" : "U.S."}</td>
              <td className="py-1.5 pr-3 whitespace-nowrap">{s.unit}</td>
              <td className="py-1.5 pr-3">{FREQ[s.frequency]}</td>
              <td className="py-1.5 whitespace-nowrap">{fmtPeriod(s.latest.date, s.frequency)}</td>
            </tr>))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
