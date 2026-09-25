"""FRED CSV endpoint (no key needed) -> data/raw/fred.parquet (long format)."""
import io
import os
import pandas as pd
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from .common import START, save, summarize, failed

FRED_SERIES = {  # id: (name, max acceptable lag in days)
    # Output & activity
    "GDPC1": ("us_gdp", 200),
    "INDPRO": ("us_industrial_production", 75),
    "USREC": ("us_recession_flag", 120),
    # Labour
    "UNRATE": ("us_unemployment", 75),
    "PAYEMS": ("us_nonfarm_payrolls", 75),
    "CIVPART": ("us_participation_rate", 75),
    "CES0500000003": ("us_avg_hourly_earnings", 75),
    # Prices
    "CPIAUCSL": ("us_cpi", 75),
    "CPILFESL": ("us_core_cpi", 75),
    # Money & rates
    "FEDFUNDS": ("us_fed_funds", 75),
    "GS2": ("us_yield_2yr", 75),
    "GS10": ("us_yield_10yr", 75),
    "M2SL": ("us_m2", 75),
    # Sentiment & leading
    "UMCSENT": ("us_consumer_sentiment", 100),
    "CANLOLITOAASTSAM": ("canada_oecd_cli", 120),
    "USALOLITOAASTSAM": ("us_oecd_cli", 120),
    "RSAFS": ("us_retail_sales", 75),
    # Trade & commodities
    "BOPGSTB": ("us_trade_balance", 110),
    "DCOILWTICO": ("wti_crude", 10),
    "DEXCAUS": ("usdcad_fred", 10),  # CAD per USD; backfills BoC FX before 2017
}


API = "https://api.stlouisfed.org/fred/series/observations"
CSV = "https://fred.stlouisfed.org/graph/fredgraph.csv"
API_KEY = os.getenv("FRED_API_KEY", "").strip()

# Fail fast: FRED's CSV endpoint can stall from cloud IPs, so no long retry chains
FAST = requests.Session()
FAST.mount("https://", HTTPAdapter(max_retries=Retry(
    total=2, backoff_factor=2, status_forcelist=[429, 500, 502, 503, 504],
    allowed_methods=["GET"])))
TIMEOUT = (10, 30)   # (connect, read) seconds


def fetch_series(sid: str, name: str) -> pd.DataFrame:
    if API_KEY:   # official API: reliable from CI
        r = FAST.get(API, timeout=TIMEOUT, params={
            "series_id": sid, "api_key": API_KEY, "file_type": "json",
            "observation_start": START})
        r.raise_for_status()
        df = pd.DataFrame(r.json()["observations"])[["date", "value"]]
    else:         # no key: public CSV link (fine locally, unreliable in CI)
        r = FAST.get(CSV, params={"id": sid}, timeout=TIMEOUT)
        r.raise_for_status()
        df = pd.read_csv(io.StringIO(r.text))
        df.columns = ["date", "value"]
    df["date"] = pd.to_datetime(df["date"])
    df["value"] = pd.to_numeric(df["value"], errors="coerce")   # "." -> NaN
    df = df.dropna().query("date >= @START")
    df["series_id"], df["name"] = sid, name
    return df[["date", "series_id", "name", "value"]]


def run():
    print(f"  FRED via {'API (key)' if API_KEY else 'public CSV (no key)'}", flush=True)
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
