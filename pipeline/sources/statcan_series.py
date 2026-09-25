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
    "ca_pop_15plus":            (2062809,    "M", 75,  "14-10-0287"),
    "ca_unemployed_level":      (2062814,    "M", 75,  "14-10-0287"),
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


# Series located by table + member names instead of a hard-coded vector ID.
# Each dimension takes the member matching one of the names (exact, then prefix, then
# unique substring); dimensions with no match take their first member (usually the total).
# The resolved member path is written to the audit note so it can be checked.
BY_MEMBERS = {  # name: (product id, member names, frequency, max lag days, table, divisor)
    "ca_capacity_util":    (16100109, ["Canada", "Total industrial"], "Q", 200, "16-10-0109", 1),
    "ca_housing_starts":   (34100158, ["Canada", "Housing starts", "Total units"], "M", 75, "34-10-0158", 1000),
    "ca_job_vacancies":    (14100432, ["Canada", "Job vacancies"], "M", 120, "14-10-0432", 1000),
    "ca_ei_claims":        (14100005, ["Canada", "Initial and renewal claims"], "M", 120, "14-10-0005", 1),
    "ca_core_cpi_sa":      (18100006, ["Canada", "All-items excluding food and energy"], "M", 75, "18-10-0006", 1),
    "ca_mfg_new_orders":   (16100047, ["Canada", "New orders", "Seasonally adjusted", "Manufacturing"], "M", 100, "16-10-0047", 1),
}
WDS = "https://www150.statcan.gc.ca/t1/wds/rest"


def _pick(members: list, wanted: list):
    names = [(m, m["memberNameEn"].strip().lower()) for m in members]
    for w in (w.lower() for w in wanted):
        exact = [m for m, n in names if n == w]
        if exact:
            return exact[0]
        prefix = sorted((m for m, n in names if n.startswith(w)), key=lambda m: len(m["memberNameEn"]))
        if prefix:
            return prefix[0]
        contains = [m for m, n in names if w in n]
        if len(contains) == 1:
            return contains[0]
    return None


def fetch_by_members(name: str, pid: int, wanted: list, freq: str, divisor: float):
    meta = HTTP.post(f"{WDS}/getCubeMetadata", json=[{"productId": pid}], timeout=60).json()[0]
    if meta.get("status") != "SUCCESS":
        raise ValueError(f"metadata status {meta.get('status')}")
    ids, path = [], []
    for dim in sorted(meta["object"]["dimension"], key=lambda d: d["dimensionPositionId"]):
        m = _pick(dim["member"], wanted) or dim["member"][0]
        ids.append(str(m["memberId"]))
        path.append(f'{dim["dimensionNameEn"]}={m["memberNameEn"]}')
    coord = ".".join(ids + ["0"] * (10 - len(ids)))
    r = HTTP.post(f"{WDS}/getDataFromCubePidCoordAndLatestNPeriods",
                  json=[{"productId": pid, "coordinate": coord, "latestN": LATEST_N[freq]}], timeout=60).json()[0]
    pts = (r.get("object") or {}).get("vectorDataPoint") or []
    if r.get("status") != "SUCCESS" or not pts:
        raise ValueError(f"no data at {coord} ({'; '.join(path)})")
    df = pd.DataFrame({
        "date": pd.to_datetime([p["refPer"] for p in pts]),
        "value": [None if p.get("value") is None else
                  float(p["value"]) * 10 ** int(p.get("scalarFactorCode") or 0) / divisor for p in pts],
    }).dropna()
    df["series_id"], df["name"] = f'v{r["object"].get("vectorId")}', name
    return df[["date", "series_id", "name", "value"]], "; ".join(path)


def run():
    report, frames = [], []
    for name, (pid, wanted, freq, lag, table, divisor) in BY_MEMBERS.items():
        try:
            df, path = fetch_by_members(name, pid, wanted, freq, divisor)
            frames.append(df)
            report.append(summarize(df, "statcan_series", name, lag,
                                    note=f"{table} {df.series_id.iloc[0]}: {path}"))
        except Exception as e:
            report.append(failed("statcan_series", name, e))
    try:
        data = fetch_all()
    except Exception as e:
        data = {}
        report.append(failed("statcan_series", "vector batch", e))
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
