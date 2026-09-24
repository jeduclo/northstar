"""Statistics Canada WDS full-table downloads -> data/raw/statcan_<id>.parquet."""
import io
import zipfile
import pandas as pd
from .common import HTTP, save, summarize, failed

TABLES = {
    "18100004": "cpi_monthly",
    "14100287": "labour_force_survey",
    "18100265": "ippi",
    "20100056": "retail_trade",
}
STANDARD_COLS = {"REF_DATE", "GEO", "DGUID", "UOM", "UOM_ID", "SCALAR_FACTOR",
                 "SCALAR_ID", "VECTOR", "COORDINATE", "VALUE", "STATUS",
                 "SYMBOL", "TERMINATED", "DECIMALS"}


def fetch_table(table_id: str) -> pd.DataFrame:
    url = f"https://www150.statcan.gc.ca/t1/wds/rest/getFullTableDownloadCSV/{table_id}/en"
    meta = HTTP.get(url, timeout=30).json()
    if meta.get("status") != "SUCCESS":
        raise ValueError(f"WDS status: {meta.get('status')}")
    z = zipfile.ZipFile(io.BytesIO(HTTP.get(meta["object"], timeout=300).content))
    fname = [f for f in z.namelist()
             if f.endswith(".csv") and "MetaData" not in f][0]
    df = pd.read_csv(z.open(fname), low_memory=False, encoding="utf-8-sig")
    df.columns = [c.strip() for c in df.columns]
    df["date"] = pd.to_datetime(df["REF_DATE"], errors="coerce")
    # Cast mixed-type text columns so Parquet writes cleanly
    for c in df.columns:
        if df[c].dtype == object:
            df[c] = df[c].astype(str)
    return df


def dimension_columns(df: pd.DataFrame) -> dict:
    """Table-specific dimensions (what you filter on) and their cardinality."""
    return {c: df[c].nunique() for c in df.columns
            if c not in STANDARD_COLS and c != "date"}


def run():
    report = []
    for tid, name in TABLES.items():
        try:
            df = fetch_table(tid)
            save(df, f"statcan_{tid}")
            dims = dimension_columns(df)
            report.append(summarize(df.dropna(subset=["date"]), "statcan",
                                    name, 90, note=f"{tid} dims={dims}"))
        except Exception as e:
            report.append(failed("statcan", name, e))
    return report
