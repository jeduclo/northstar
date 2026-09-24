"""Day 3: raw Parquet -> DuckDB warehouse (raw -> clean -> mart).

Usage (from repo root):  python -m pipeline.build
"""
import sys
import duckdb
from pipeline.sources.common import RAW_DIR, ROOT

DB_PATH = ROOT / "data" / "northstar.duckdb"
SQL_DIR = ROOT / "pipeline" / "sql"
REF_DIR = ROOT / "pipeline" / "reference"


def load_raw(con):
    con.execute("CREATE SCHEMA IF NOT EXISTS raw; CREATE SCHEMA IF NOT EXISTS ref;")
    parts = []
    for p in sorted(RAW_DIR.glob("*.parquet")):
        stem, path = p.stem, p.as_posix()
        if stem.startswith("statcan_") and stem[8:].isdigit():
            continue                                  # full StatCan tables
        if stem == "markets":
            con.execute(f"CREATE OR REPLACE TABLE raw.markets AS SELECT CAST(date AS DATE) AS date, "
                        f"market, sector, ticker, close FROM read_parquet('{path}')")
            print(f"  raw.markets        <- {p.name}")
            continue
        cols = {r[0] for r in con.execute(f"DESCRIBE SELECT * FROM read_parquet('{path}')").fetchall()}
        if {"date", "name", "value"} <= cols:
            parts.append(f"SELECT CAST(date AS DATE) AS date, CAST(name AS VARCHAR) AS name, "
                         f"CAST(value AS DOUBLE) AS value, '{stem}' AS source FROM read_parquet('{path}')")
            print(f"  raw.observations   <- {p.name}")
        else:
            print(f"  SKIPPED {p.name}: needs date/name/value columns, has {sorted(cols)}")
    con.execute("CREATE OR REPLACE TABLE raw.observations AS " + " UNION ALL ".join(parts))
    for ref in REF_DIR.glob("*.csv"):
        con.execute(f"CREATE OR REPLACE TABLE ref.{ref.stem} AS "
                    f"SELECT * FROM read_csv_auto('{ref.as_posix()}', header=true)")
        print(f"  ref.{ref.stem:<16}<- {ref.name}")


def run_sql(con):
    for f in sorted(SQL_DIR.glob("*.sql")):
        con.execute(f.read_text(encoding="utf-8"))
        print(f"  ran {f.name}")


def checks(con):
    print("\n=== CHECKS ===")
    missing = con.execute("""
        SELECT name FROM ref.catalog
        WHERE name NOT IN (SELECT name FROM clean.monthly UNION SELECT name FROM clean.quarterly)
    """).fetchall()
    dupes = con.execute("""
        SELECT count(*) FROM (SELECT tab, name, date FROM mart.tab_series
                              GROUP BY ALL HAVING count(*) > 1)
    """).fetchone()[0]
    print(f"Catalog series with no data: {[m[0] for m in missing] or 'none'}")
    print(f"Duplicate rows in mart.tab_series: {dupes}")
    print("\nPer tab (series, first, latest):")
    print(con.sql("""
        SELECT tab, count(DISTINCT name) AS series, min(date) AS first, max(date) AS latest
        FROM mart.tab_series GROUP BY tab ORDER BY tab
    """))
    print("Latest readings:")
    con.sql("""
        SELECT tab, name, arg_max(date, date) AS date, round(arg_max(value, date), 2) AS value,
               any_value(display_unit) AS unit
        FROM mart.tab_series GROUP BY tab, name ORDER BY tab, name
    """).show(max_rows=60)
    print(con.sql("SELECT * FROM mart.recessions ORDER BY start_date"))
    print(con.sql("""
        SELECT market, sector, round(rs_12m, 1) AS rs_12m_vs_benchmark
        FROM mart.rotation WHERE NOT is_partial_month
          AND month = (SELECT max(month) FROM mart.rotation WHERE NOT is_partial_month)
          AND sector <> 'Benchmark' ORDER BY market, rs_12m DESC
    """))
    return not missing and dupes == 0


def main():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(str(DB_PATH))
    print("Loading raw + reference ...")
    load_raw(con)
    print("Transforming ...")
    run_sql(con)
    ok = checks(con)
    con.close()
    print(f"\n{'BUILD OK' if ok else 'BUILD HAS ISSUES'} -> {DB_PATH}")
    if not ok:
        sys.exit(1)


if __name__ == "__main__":
    main()
