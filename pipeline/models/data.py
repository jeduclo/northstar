"""Model inputs, read from the Parquet files CI already commits to the repo.

No database or API keys needed: works in Colab straight after `git clone`.
"""
import json
from datetime import datetime, timezone

import pandas as pd
from pipeline.sources.common import ROOT

PARQUET = ROOT / "web" / "public" / "data" / "parquet"
OUT = ROOT / "web" / "public" / "data"


def series_long() -> pd.DataFrame:
    """mart.tab_series: tab, country, name, description, frequency, display_unit, date, value, level."""
    df = pd.read_parquet(PARQUET / "tab_series.parquet")
    df["date"] = pd.to_datetime(df["date"])
    return df


def monthly_panel(names: list[str], column: str = "value") -> pd.DataFrame:
    """Wide monthly frame (month-start index) for the given series names."""
    df = series_long()
    wide = df[df.name.isin(names)].pivot_table(index="date", columns="name", values=column)
    return wide.sort_index()


def rotation() -> pd.DataFrame:
    df = pd.read_parquet(PARQUET / "rotation.parquet")
    df["month"] = pd.to_datetime(df["month"])
    return df[~df["is_partial_month"]].sort_values(["ticker", "month"])


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def write_json(name: str, obj) -> None:
    (OUT / name).write_text(json.dumps(obj, separators=(",", ":"), allow_nan=False), encoding="utf-8")
    print(f"  wrote {OUT / name}")
