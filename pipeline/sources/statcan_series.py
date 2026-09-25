"""StatCan series via the WDS *vector* API -> data/raw/statcan_series.parquet.

Vector IDs were resolved from the full tables during the Day-2 audit, so CI no
longer downloads multi-million-row tables. One POST fetches all series.
To add a series: find its vector in the StatCan table ("Add/Remove data" ->
show vector IDs, or the VECTOR column of the full table) and add it here.
"""
import pandas as pd
from .common import HTTP, save, summarize, failed

URL = "https://www150.statcan.gc.ca/t1/wds/rest/getDataFromVectorsAndLatestNPeriods"
LATEST_N = {"M": 280, "Q": 95, "W": 1200}      # reaches back to ~2004

VECTORS = {  # name: (vector id, frequency, max lag days, source table)
    "ca_cpi_all_items":         (41690973,   "M", 75,  "18-10-0004"),
    "ca_unemployment":          (2062815,    "M", 75,  "14-10-0287"),
    "ca_participation":         (2062816,    "M", 75,  "14-10-0287"),
    "ca_employment":            (2062811,    "M", 75,  "14-10-0287"),
    "ca_ippi_total":            (1230995983, "M", 75,  "18-10-0265"),
    "ca_retail_sales":          (1446859483, "M", 90,  "20-10-0056"),
    "ca_gdp_monthly":           (65201210,   "M", 120, "36-10-0434"),
    "ca_industrial_production": (65201219,   "M", 120, "36-10-0434"),
    "ca_gdp_quarterly":         (62305752,   "Q", 200, "36-10-0104"),
    "ca_exports":               (87008955,   "M", 90,  "12-10-0011"),
    "ca_imports":               (87008839,   "M", 90,  "12-10-0011"),
    "ca_exports_to_us":         (87008956,   "M", 90,  "12-10-0011"),
    "m1_gross":                 (37258,      "M", 100, "10-10-0116"),
    "m2pp_gross":               (41552790,   "M", 100, "10-10-0116"),
    "prime_rate":               (80691311,   "W", 14,  "10-10-0145"),
    "ca_mortgage_5y":           (80691335,   "W", 14,  "10-10-0145"),
    "ca_avg_hourly_wages":      (2132579,    "M", 75,  "14-10-0063"),
    "ca_pop_15plus":            (2062809,    "M", 75,  "14-10-0287"),   # optional: check label in audit
}


def fetch_all() -> dict:
    body = [{"vectorId": vid, "latestN": LATEST_N[freq]}
            for vid, freq, _, _ in VECTORS.values()]
    r = HTTP.post(URL, json=body, timeout=60)
    r.raise_for_status()
    out = {}
    for item in r.json():
        obj = item.get("object") or {}
        if item.get("status") == "SUCCESS" and obj.get("vectorId"):
            out[int(obj["vectorId"])] = obj.get("vectorDataPoint", [])
    return out


def run():
    report, frames = [], []
    try:
        data = fetch_all()
    except Exception as e:
        return [failed("statcan_series", "vector batch", e)]
    for name, (vid, _, lag, table) in VECTORS.items():
        try:
            points = data.get(vid)
            if not points:
                raise ValueError(f"no data returned for v{vid}")
            df = pd.DataFrame({
                "date": pd.to_datetime([p["refPer"] for p in points]),
                "series_id": f"v{vid}", "name": name,
                "value": pd.to_numeric([p.get("value") for p in points], errors="coerce"),
            }).dropna(subset=["value"])
            frames.append(df)
            report.append(summarize(df, "statcan_series", name, lag, note=f"{table} v{vid}"))
        except Exception as e:
            report.append(failed("statcan_series", name, e))
    if frames:
        save(pd.concat(frames, ignore_index=True), "statcan_series")
    return report
