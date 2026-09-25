"""Shared helpers: paths, HTTP session with retries, save + summary."""
import os
import pathlib
import pandas as pd
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

ROOT = pathlib.Path(__file__).resolve().parents[2]
RAW_DIR = pathlib.Path(os.getenv("NORTHSTAR_RAW", ROOT / "data" / "raw"))
RAW_DIR.mkdir(parents=True, exist_ok=True)
START = os.getenv("NORTHSTAR_START", "2006-01-01")


def _session() -> requests.Session:
    s = requests.Session()
    retry = Retry(total=4, backoff_factor=1.5,
                  status_forcelist=[429, 500, 502, 503, 504],
                  allowed_methods=["GET"])
    s.mount("https://", HTTPAdapter(max_retries=retry))
    s.headers["User-Agent"] = "NorthStar/0.1 (research project)"
    return s


HTTP = _session()


def save(df: pd.DataFrame, name: str) -> pathlib.Path:
    path = RAW_DIR / f"{name}.parquet"
    df.to_parquet(path, index=False)
    return path


def summarize(df, source, dataset, max_lag_days, date_col="date", note=""):
    end = pd.to_datetime(df[date_col]).max()
    lag = (pd.Timestamp.today().normalize() - end).days
    return {"source": source, "dataset": dataset, "rows": len(df),
            "start": pd.to_datetime(df[date_col]).min().date(), "end": end.date(),
            "lag_days": lag, "status": "STALE" if lag > max_lag_days else "ok",
            "note": note}


def _optional_names() -> set:
    """Catalog rows flagged optional=1: a failure there is reported but does not block the refresh."""
    cat = pd.read_csv(ROOT / "pipeline" / "reference" / "catalog.csv", dtype=str).fillna("")
    return set(cat.loc[cat.get("optional", "") == "1", "name"])


OPTIONAL = _optional_names()


def failed(source, dataset, err):
    return {"source": source, "dataset": dataset, "rows": 0, "start": None,
            "end": None, "lag_days": None,
            "status": "MISSING_OPTIONAL" if dataset in OPTIONAL else "FAILED",
            "note": str(err)[:200]}
