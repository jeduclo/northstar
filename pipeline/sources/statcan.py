"""Statistics Canada WDS: full tables -> statcan_<id>.parquet,
single vectors -> statcan_vectors.parquet (long format)."""
import io
import zipfile
import pandas as pd
from .common import HTTP, START, save, summarize, failed

WDS = "https://www150.statcan.gc.ca/t1/wds/rest"

TABLES = {
    "18100004": "cpi_monthly",
    "14100287": "labour_force_survey",
    "18100265": "ippi",
    "20100056": "retail_trade",
}
VECTORS = {  # vector: (name, max acceptable lag in days)
    "v37258":    ("m1_gross", 100),
    "v41552790": ("m2pp_gross", 100),
    "v80691311": ("prime_rate", 45),   # VERIFY label in audit notes
}
STANDARD_COLS = {"REF_DATE", "GEO", "DGUID", "UOM", "UOM_ID", "SCALAR_FACTOR",
                 "SCALAR_ID", "VECTOR", "COORDINATE", "VALUE", "STATUS",
                 "SYMBOL", "TERMINATED", "DECIMALS"}


def fetch_table(table_id: str) -> pd.DataFrame:
    url = f"{WDS}/getFullTableDownloadCSV/{table_id}/en"
    meta = HTTP.get(url, timeout=30).json()
    if meta.get("status") != "SUCCESS":
        raise ValueError(f"WDS status: {meta.get('status')}")
    z = zipfile.ZipFile(io.BytesIO(HTTP.get(meta["object"], timeout=300).content))
    fname = [f for f in z.namelist()
             if f.endswith(".csv") and "MetaData" not in f][0]
    df = pd.read_csv(z.open(fname), low_memory=False, encoding="utf-8-sig")
    df.columns = [c.strip() for c in df.columns]
    df["date"] = pd.to_datetime(df["REF_DATE"], errors="coerce")
    for c in df.columns:
        if df[c].dtype == object:
            df[c] = df[c].astype(str)
    return df


def dimension_columns(df: pd.DataFrame) -> dict:
    return {c: df[c].nunique() for c in df.columns
            if c not in STANDARD_COLS and c != "date"}


def vector_label(vid: str) -> str:
    """Series title from StatCan, so the audit notes show what we actually pulled."""
    try:
        r = HTTP.post(f"{WDS}/getSeriesInfoFromVector",
                      json=[{"vectorId": int(vid.lstrip("vV"))}], timeout=30)
        return r.json()[0]["object"]["SeriesTitleEn"]
    except Exception:
        return "label lookup failed"


def fetch_vector(vid: str, name: str) -> pd.DataFrame:
    r = HTTP.get(f"{WDS}/getDataFromVectorByReferencePeriodRange",
                 params={"vectorIds": f'"{vid.lstrip("vV")}"',
                         "startRefPeriod": str(START)[:10],
                         "endReferencePeriod": "2100-12-01"}, timeout=30)
    r.raise_for_status()
    pts = r.json()[0]["object"]["vectorDataPoint"]
    df = pd.DataFrame(pts)[["refPer", "value"]].rename(columns={"refPer": "date"})
    df["date"] = pd.to_datetime(df["date"])
    df["value"] = pd.to_numeric(df["value"], errors="coerce")
    df = df.dropna()
    df["series_id"], df["name"] = vid, name
    return df[["date", "series_id", "name", "value"]]


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

    frames = []
    for vid, (name, lag) in VECTORS.items():
        try:
            df = fetch_vector(vid, name)
            frames.append(df)
            report.append(summarize(df, "statcan", name, lag,
                                    note=f"{vid}: {vector_label(vid)}"))
        except Exception as e:
            report.append(failed("statcan", name, e))
    if frames:
        save(pd.concat(frames, ignore_index=True), "statcan_vectors")

    return report