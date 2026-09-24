"""FRED CSV endpoint (no key needed) -> data/raw/fred.parquet (long format)."""
import io
import pandas as pd
from .common import HTTP, START, save, summarize, failed

FRED_SERIES = {  # id: (name, max acceptable lag in days)
    "GDPC1": ("us_gdp", 200),
    "UNRATE": ("us_unemployment", 75),
    "CPIAUCSL": ("us_cpi", 75),
    "FEDFUNDS": ("us_fed_funds", 75),
    "CANLOLITOAASTSAM": ("canada_oecd_cli", 120),  # VERIFY: may be discontinued
}


def fetch_series(sid: str, name: str) -> pd.DataFrame:
    r = HTTP.get("https://fred.stlouisfed.org/graph/fredgraph.csv",
                 params={"id": sid}, timeout=30)
    r.raise_for_status()
    df = pd.read_csv(io.StringIO(r.text))
    df.columns = ["date", "value"]
    df["date"] = pd.to_datetime(df["date"])
    df["value"] = pd.to_numeric(df["value"], errors="coerce")
    df = df.dropna().query("date >= @START")
    df["series_id"], df["name"] = sid, name
    return df[["date", "series_id", "name", "value"]]


def run():
    frames, report = [], []
    for sid, (name, lag) in FRED_SERIES.items():
        try:
            df = fetch_series(sid, name)
            frames.append(df)
            report.append(summarize(df, "fred", name, lag, note=sid))
        except Exception as e:
            report.append(failed("fred", name, e))
    if frames:
        save(pd.concat(frames, ignore_index=True), "fred")
    return report
