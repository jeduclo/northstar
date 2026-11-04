"""Yahoo Finance sector ETFs (CA + US) -> data/raw/markets.parquet (long)."""
import pandas as pd
import yfinance as yf
from .common import save, summarize, failed

MARKET_START = "2006-01-01"  # aligned with macro start; ETFs begin when listed

CANADA = {"XIU.TO": "Benchmark", "XFN.TO": "Financials", "XEG.TO": "Energy",
          "XIT.TO": "Tech", "XST.TO": "Staples", "XUT.TO": "Utilities",
          "XMA.TO": "Materials"}
US = {"SPY": "Benchmark", "XLK": "Tech", "XLE": "Energy", "XLF": "Financials",
      "XLV": "HealthCare", "XLI": "Industrials", "XLU": "Utilities",
      "XLP": "Staples", "XLB": "Materials"}

# Cross-asset prices used by the investor questions (risk regime, inflation hedges).
# Stored as ordinary observations (date, name, value) so they flow through the catalog.
MACRO = {"GC=F": "gold", "HG=F": "copper", "XIC.TO": "tsx_composite"}

# Sectors present in both markets -> used for cross-border rotation in Tab 7
PAIRED_SECTORS = sorted(set(CANADA.values()) & set(US.values()))


def fetch(tickers: dict, market: str) -> pd.DataFrame:
    px = yf.download(list(tickers), start=MARKET_START, progress=False, timeout=60,
                     auto_adjust=True)["Close"]
    df = px.reset_index().melt(id_vars="Date", var_name="ticker",
                               value_name="close").dropna()
    df = df.rename(columns={"Date": "date"})
    df["sector"] = df["ticker"].map(tickers)
    df["market"] = market
    return df


def run():
    frames, report = [], []
    for market, tickers in (("CA", CANADA), ("US", US)):
        try:
            df = fetch(tickers, market)
            frames.append(df)
            first = df.groupby("ticker")["date"].min().dt.date.to_dict()
            missing = set(tickers) - set(df["ticker"])
            report.append(summarize(df, "yfinance", f"sectors_{market}", 7,
                                    note=f"first dates={first} missing={missing or 'none'}"))
        except Exception as e:
            report.append(failed("yfinance", f"sectors_{market}", e))
    if frames:
        save(pd.concat(frames, ignore_index=True), "markets")
    report += run_macro()
    return report


def run_macro():
    report = []
    try:
        px = yf.download(list(MACRO), start=MARKET_START, progress=False, timeout=60,
                         auto_adjust=True)["Close"]
        df = px.reset_index().melt(id_vars="Date", var_name="series_id", value_name="value").dropna()
        df = df.rename(columns={"Date": "date"})
        df["name"] = df["series_id"].map(MACRO)
        df = df[["date", "series_id", "name", "value"]]
        save(df, "markets_macro")
        for name, g in df.groupby("name"):
            report.append(summarize(g, "yfinance", name, 7, note=g.series_id.iloc[0]))
        for name in set(MACRO.values()) - set(df["name"]):
            report.append(failed("yfinance", name, "no data returned"))
    except Exception as e:
        report += [failed("yfinance", n, e) for n in MACRO.values()]
    return report
