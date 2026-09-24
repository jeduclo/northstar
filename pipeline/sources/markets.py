"""Yahoo Finance sector ETFs (CA + US) -> data/raw/markets.parquet (long)."""
import pandas as pd
import yfinance as yf
from .common import save, summarize, failed

MARKET_START = "2006-01-01"  # aligned with macro start; ETFs begin when listed

CANADA = {"XIU.TO": "Benchmark", "XFN.TO": "Financials", "XEG.TO": "Energy",
          "XIT.TO": "Tech", "XST.TO": "Staples", "XUT.TO": "Utilities"}
US = {"SPY": "Benchmark", "XLK": "Tech", "XLE": "Energy", "XLF": "Financials",
      "XLV": "HealthCare", "XLI": "Industrials", "XLU": "Utilities"}


def fetch(tickers: dict, market: str) -> pd.DataFrame:
    px = yf.download(list(tickers), start=MARKET_START, progress=False,
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
    return report
