"""StatCan series extraction (Day 2) -> data/raw/statcan_series.parquet.

Separate from statcan.py on purpose: statcan.py (your Day-1 version) keeps
downloading/refreshing the core tables and vectors; this module reuses those
cached table files and downloads only the NEW tables below.

Each SERIES spec must match exactly ONE StatCan vector. Filter keys match
column names by substring; values match exactly first, else by substring.
Set NORTHSTAR_USE_CACHE=1 to reuse all downloaded tables while tuning specs.
"""
import os
import pandas as pd
from .common import RAW_DIR, save, summarize, failed
from .statcan import fetch_table, dimension_columns

NEW_TABLES = {
    "36100434": "gdp_by_industry_monthly",
    "36100104": "gdp_expenditure_quarterly",
    "12100011": "merchandise_trade",
}

CA = {"GEO": "Canada"}
LFS = {**CA, "Gender": "Total - Gender", "Age group": "15 years and over",
       "Statistics": "Estimate", "Data type": "Seasonally adjusted"}

SERIES = {  # name: (table, filters, max lag days)
    "ca_cpi_all_items": ("18100004", {**CA, "Products": "All-items"}, 75),
    "ca_unemployment": ("14100287", {**LFS, "Labour force characteristics": "Unemployment rate"}, 45),
    "ca_participation": ("14100287", {**LFS, "Labour force characteristics": "Participation rate"}, 45),
    "ca_employment": ("14100287", {**LFS, "Labour force characteristics": "Employment"}, 45),
    "ca_ippi_total": ("18100265", {**CA, "Product": "Total, Industrial product price index"}, 75),
    "ca_retail_sales": ("20100056", {**CA, "Industry": "Retail trade", "Adjustments": "Seasonally adjusted"}, 90),
    "ca_gdp_monthly": ("36100434", {**CA, "Seasonal adjustment": "Seasonally adjusted at annual rates",
                                    "Prices": "Chained", "Industry": "All industries"}, 120),
    "ca_industrial_production": ("36100434", {**CA, "Seasonal adjustment": "Seasonally adjusted at annual rates",
                                              "Prices": "Chained", "Industry": "Industrial production"}, 120),
    "ca_gdp_quarterly": ("36100104", {**CA, "Prices": "Chained", "Seasonal adjustment": "Seasonally adjusted at annual rates",
                                      "Estimates": "Gross domestic product at market prices"}, 200),
    "ca_exports": ("12100011", {**CA, "Trade": "Export", "Basis": "Balance of payments",
                                "Seasonal adjustment": "Seasonally adjusted", "partners": "All countries"}, 90),
    "ca_imports": ("12100011", {**CA, "Trade": "Import", "Basis": "Balance of payments",
                                "Seasonal adjustment": "Seasonally adjusted", "partners": "All countries"}, 90),
    "ca_exports_to_us": ("12100011", {**CA, "Trade": "Export", "Basis": "Balance of payments",
                                      "Seasonal adjustment": "Seasonally adjusted", "partners": "United States"}, 90),
}


def load_table(table_id: str) -> pd.DataFrame:
    path = RAW_DIR / f"statcan_{table_id}.parquet"
    use_cache = os.getenv("NORTHSTAR_USE_CACHE") == "1" or table_id not in NEW_TABLES
    if use_cache and path.exists():
        return pd.read_parquet(path)
    df = fetch_table(table_id)
    save(df, f"statcan_{table_id}")
    return df


def _col(df, key):
    cols = [c for c in df.columns if key.lower() in c.lower() and c != "DGUID"]
    if len(cols) != 1:
        raise KeyError(f"filter key '{key}' matched columns {cols}; "
                       f"available dims: {list(dimension_columns(df))}")
    return cols[0]


def apply_spec(df, filters):
    mask = pd.Series(True, index=df.index)
    for key, val in filters.items():
        s = df[_col(df, key)].str.strip()
        exact = s.str.lower() == val.lower()
        mask &= exact if exact.any() else s.str.contains(val, case=False, regex=False)
    return df[mask]


def _explain(df, sub, filters):
    if len(sub):
        return {c: sorted(sub[c].unique())[:6] for c in dimension_columns(sub)
                if sub[c].nunique() > 1}
    return {_col(df, k): sorted(df[_col(df, k)].unique())[:8] for k in filters}


def run():
    tables, report = {}, []
    for tid in sorted({t for t, _, _ in SERIES.values()}):
        try:
            tables[tid] = load_table(tid)
        except Exception as e:
            report.append(failed("statcan_series", f"table {tid}", e))
    frames = []
    for name, (tid, filters, lag) in SERIES.items():
        try:
            if tid not in tables:
                raise ValueError(f"table {tid} not loaded")
            sub = apply_spec(tables[tid], filters)
            vectors = sub["VECTOR"].unique()
            if len(vectors) != 1:
                raise ValueError(f"{len(vectors)} vectors matched -> "
                                 f"{_explain(tables[tid], sub, filters)}")
            out = pd.DataFrame({
                "date": sub["date"], "series_id": vectors[0], "name": name,
                "value": pd.to_numeric(sub["VALUE"], errors="coerce"),
                "uom": sub["UOM"]}).dropna(subset=["date", "value"])
            frames.append(out)
            report.append(summarize(out, "statcan_series", name, lag,
                                    note=f"{tid} {vectors[0]} [{out.uom.iloc[0]}]"))
        except Exception as e:
            report.append(failed("statcan_series", name, e))
    if frames:
        save(pd.concat(frames, ignore_index=True), "statcan_series")
    return report
