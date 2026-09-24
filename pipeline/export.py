"""Day 4: DuckDB marts -> web/public/data (JSON for charts, Parquet for DuckDB-WASM).

Usage (from repo root):  python -m pipeline.export
"""
import json
import sys
from datetime import datetime, timezone

import duckdb
import pandas as pd
from pipeline.build import DB_PATH
from pipeline.sources.common import ROOT

OUT = ROOT / "web" / "public" / "data"
MAX_DATA_AGE_DAYS = 120      # newest monthly observation must be this recent
MIN_SERIES_PER_TAB = 3


def records(df: pd.DataFrame) -> list:
    df = df.copy()
    for c in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[c]):
            df[c] = df[c].dt.strftime("%Y-%m-%d")
    return json.loads(df.to_json(orient="records", double_precision=4))


def write_json(name: str, obj) -> None:
    path = OUT / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, separators=(",", ":")), encoding="utf-8")


def export_tabs(con) -> dict:
    ts = con.execute("SELECT * FROM mart.tab_series ORDER BY tab, country, name, date").df()
    summary = {}
    for tab, g in ts.groupby("tab"):
        series = []
        for name, s in g.groupby("name", sort=False):
            s = s.sort_values("date")
            last, prev = s.iloc[-1], (s.iloc[-2] if len(s) > 1 else None)
            series.append({
                "name": name, "country": last.country, "description": last.description,
                "unit": last.display_unit, "frequency": last.frequency,
                "latest": {"date": last.date.strftime("%Y-%m-%d"), "value": round(float(last.value), 4)},
                "change": None if prev is None else round(float(last.value - prev.value), 4),
                "data": [[d.strftime("%Y-%m-%d"), round(float(v), 4)] for d, v in zip(s.date, s.value)],
            })
        write_json(f"tabs/{tab}.json", {"tab": tab, "series": series})
        summary[tab] = {"series": len(series), "latest": g.date.max().strftime("%Y-%m-%d")}
    return summary


def export_extras(con) -> None:
    write_json("recessions.json", records(con.execute(
        "SELECT * FROM mart.recessions ORDER BY country, start_date").df()))
    write_json("fx_oil.json", records(con.execute(
        "SELECT * FROM mart.fx_oil ORDER BY month").df()))
    rot = con.execute("""
        SELECT * EXCLUDE (is_partial_month) FROM mart.rotation
        WHERE NOT is_partial_month
          AND month >= (SELECT max(month) FROM mart.rotation WHERE NOT is_partial_month) - INTERVAL 35 MONTH
        ORDER BY market, sector, month
    """).df()
    write_json("rotation.json", {"latest_month": rot.month.max().strftime("%Y-%m-%d"),
                                 "rows": records(rot)})
    # Parquet copies for in-browser SQL (DuckDB-WASM + NL assistant)
    for table in ("mart.tab_series", "mart.rotation", "mart.recessions", "mart.fx_oil", "ref.catalog"):
        path = (OUT / "parquet" / f"{table.split('.')[1]}.parquet")
        path.parent.mkdir(parents=True, exist_ok=True)
        con.execute(f"COPY (SELECT * FROM {table}) TO '{path.as_posix()}' (FORMAT parquet)")


def source_status() -> dict:
    audit = ROOT / "data" / "audit_report.csv"
    if not audit.exists():
        return {}
    df = pd.read_csv(audit)
    return {"datasets": len(df), "ok": int((df.status == "ok").sum()),
            "attention": df.loc[df.status != "ok", "dataset"].tolist()}


def validate(tabs: dict) -> list:
    problems = []
    newest = max(pd.Timestamp(t["latest"]) for t in tabs.values())
    age = (pd.Timestamp.today() - newest).days
    if age > MAX_DATA_AGE_DAYS:
        problems.append(f"newest data is {age} days old")
    for tab, t in tabs.items():
        if t["series"] < MIN_SERIES_PER_TAB:
            problems.append(f"tab '{tab}' has only {t['series']} series")
    return problems


def main():
    con = duckdb.connect(str(DB_PATH), read_only=True)
    tabs = export_tabs(con)
    export_extras(con)
    con.close()
    problems = validate(tabs)
    files = {p.relative_to(OUT).as_posix(): p.stat().st_size
             for p in sorted(OUT.rglob("*")) if p.is_file() and p.name != "manifest.json"}
    write_json("manifest.json", {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "tabs": tabs, "sources": source_status(), "files": files,
    })
    for f, size in files.items():
        print(f"  {f:<32} {size / 1024:8.1f} KB")
    print(f"  total {sum(files.values()) / 1024:.0f} KB -> {OUT}")
    if problems:
        print("EXPORT FAILED VALIDATION:", "; ".join(problems))
        sys.exit(1)
    print("EXPORT OK")


if __name__ == "__main__":
    main()
