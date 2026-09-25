"""Bank of Canada Valet API -> data/raw/boc.parquet (long format)."""
import pandas as pd
from .common import HTTP, START, save, summarize, failed

BASE = "https://www.bankofcanada.ca/valet"

BOC_SERIES = {
    "V39079": "overnight_rate",
    "FXCADUSD": "cad_usd",
    "BD.CDN.2YR.DQ.YLD": "yield_2yr",
    "BD.CDN.5YR.DQ.YLD": "yield_5yr",
    "BD.CDN.10YR.DQ.YLD": "yield_10yr",
    "BD.CDN.LONG.DQ.YLD": "ca_long_bond",
    "BD.CDN.RRB.DQ.YLD": "ca_rrb_yield",
    "CPI_TRIM": "cpi_trim",
    "CPI_MEDIAN": "cpi_median",
    "CPI_COMMON": "cpi_common",
    "M.BCPI": "bcpi_total",          # Bank of Canada commodity price index, monthly
    "M.ENER": "bcpi_energy",
    "M.BCNE": "bcpi_ex_energy",
    "CES_C1_SHORT_TERM": "ca_consumer_infl_exp",   # CSCE, quarterly
}
MONTHLY = {"ca_consumer_infl_exp", "cpi_trim", "cpi_median", "cpi_common", "bcpi_total", "bcpi_energy", "bcpi_ex_energy"}


def fetch_series(code: str, name: str) -> pd.DataFrame:
    r = HTTP.get(f"{BASE}/observations/{code}/json",
                 params={"start_date": START}, timeout=30)
    r.raise_for_status()
    rows = [{"date": o["d"], "value": (o.get(code) or {}).get("v")}
            for o in r.json()["observations"]]
    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["date"])
    df["value"] = pd.to_numeric(df["value"], errors="coerce")
    df = df.dropna(subset=["value"])
    df["series_id"], df["name"] = code, name
    return df[["date", "series_id", "name", "value"]]


def series_label(code: str) -> str:
    """Official label/description, used to verify what a series really is."""
    try:
        d = HTTP.get(f"{BASE}/series/{code}/json", timeout=20).json()
        det = d.get("seriesDetails", {})
        return f"{det.get('label', '?')} | {det.get('description', '')}"[:150]
    except Exception as e:
        return f"label lookup failed: {e}"


def run():
    frames, report = [], []
    for code, name in BOC_SERIES.items():
        try:
            df = fetch_series(code, name)
            frames.append(df)
            report.append(summarize(df, "boc", name,
                                    (220 if name == "ca_consumer_infl_exp" else 75) if name in MONTHLY else 7,
                                    note=f"{code}: {series_label(code)}"))
        except Exception as e:
            report.append(failed("boc", name, e))
    if frames:
        save(pd.concat(frames, ignore_index=True), "boc")
    return report
