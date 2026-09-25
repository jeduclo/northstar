# NorthStar — 3-minute demo script

**Setup:** live site open on the home page (click the NorthStar name), a second tab on the GitHub repo. Country filter on "Both".
Rehearse once so each segment lands on time. Times are cumulative.

---

### 0:00–0:20 · The hook (home page)
> "NorthStar tracks where Canada and the U.S. are in the business cycle, and how that shows up in sector
> returns. Every section answers one question, and the answer at the top is written from today's data.
> It refreshes itself every weekday morning; nobody downloads a spreadsheet."

*Point at the "Data refreshed" timestamp.*

### 0:20–0:55 · The economics (Prices, then Money)
Open **Prices**.
> "Headline inflation against the Bank of Canada's 1–3% band, core inflation, and producer prices. That
> producer-price spike lines up with oil. The fourth chart shows it directly."

Open **Central banks**, switch the range to **Since 2006**.
> "Policy rates back to 2006, including the 2008 cuts I backfilled from the Bank's rate history, and the yield
> curve. Both inverted in 2022–23, the classic recession signal."

### 0:55–1:25 · Cross-border markets (Trade & FX, Sector rotation)
Open **Trade & FX**.
> "How tightly the loonie tracks oil, as a rolling correlation, and Canada's exposure to U.S. trade."

Open **Sector rotation**.
> "Relative strength by sector and month, for both markets. The quadrant shows which sectors are leading,
> weakening or improving. Energy is a good example of the same sector behaving differently across the border."

### 1:25–2:05 · The models (Forecast & scenarios)
Open **Forecast & scenarios**.
> "Forecasts come from Chronos-2, a time-series foundation model used zero-shot. The cone is the 80% range.
> Under it I report a backtest against a no-change forecast, because a forecast without an error record isn't
> worth much."

Drag the **rate slider** to +0.50.
> "DoubleML estimates how a Bank of Canada move relates to sector returns after controlling for U.S. rates,
> oil and the currency. Most effects aren't significant, and the page says so. Markets tend to price moves
> before they happen. That's a finding, not a failure."

### 2:05–2:40 · Ask the data
Open **Ask the data**, click *"When was Canada's 10-year minus 2-year spread last negative?"*
> "Plain-English questions become one SQL query against the same warehouse. The answer comes only from the
> returned rows, and the SQL is always shown. The database is locked: read-only, no file or network access."

Expand **How this was answered**.

### 2:40–3:00 · The engineering (GitHub tab)
Show `refresh.yml` and the `data: refresh` commits.
> "Four public APIs, a DuckDB warehouse with data-quality gates that block bad deploys, static Next.js on
> Vercel. I hit real production problems, like FRED throttling cloud IPs and a native-module issue on
> Vercel, and the methodology page documents how I fixed them. Happy to go deeper on any layer."

---

## Likely questions

**Why DuckDB instead of Postgres?** Analytical, columnar, embedded: the whole warehouse is one file built in
seconds in CI, with no server to run. The same engine answers the assistant's queries.

**Why pre-computed JSON instead of a live API?** The data changes once a day. Static pages are instant, free
to host and can't go down with a database.

**Is the forecast any good?** It's reported honestly: each series shows its 12-month holdout error against a
no-change forecast. Foundation models are a strong baseline, not an oracle, and they miss turning points.

**Is the causal estimate really causal?** Only under the assumption that the controls capture the confounders.
With few policy moves and anticipation effects, I treat it as exploratory, and the page says so.

**What would you build next?** Scheduled model runs in CI, data vintages for real-time backtests, provincial
data, and alerts when leading indicators turn.
