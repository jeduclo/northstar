"""Day-1 data audit: run every source, report coverage/freshness, flag issues.

Usage (from repo root):  python -m pipeline.audit
"""
import pandas as pd
from pipeline.sources import boc, fred, statcan, statcan_series, markets
from pipeline.sources.common import RAW_DIR

pd.set_option("display.width", 200)
pd.set_option("display.max_colwidth", 90)


def ippi_check():
    """Show the real IPPI dimension labels so the 'Total' filter can be fixed."""
    path = RAW_DIR / "statcan_18100265.parquet"
    if not path.exists():
        return
    df = pd.read_parquet(path)
    print("\nIPPI dimension columns:", statcan.dimension_columns(df))
    for col in statcan.dimension_columns(df):
        totals = sorted(v for v in df[col].unique() if "total" in v.lower())
        if totals:
            print(f"  '{col}' values containing 'total':")
            for v in totals[:10]:
                print(f"     - {v}")


def main():
    report = []
    for mod in (boc, fred, statcan, statcan_series, markets):
        print(f"Running {mod.__name__.split('.')[-1]} ...")
        report += mod.run()

    df = pd.DataFrame(report)
    out = RAW_DIR.parent / "audit_report.csv"
    df.to_csv(out, index=False)

    print("\n=== AUDIT SUMMARY ===")
    print(df[["source", "dataset", "rows", "start", "end", "lag_days", "status"]]
          .to_string(index=False))
    print("\n=== NOTES (series labels / table dimensions) ===")
    for _, r in df.iterrows():
        print(f"[{r.source}/{r.dataset}] {r.note}")
    ippi_check()

    problems = df[df.status != "ok"]
    print(f"\n{len(df) - len(problems)}/{len(df)} datasets ok. Report: {out}")
    if len(problems):
        print("Needs attention:", ", ".join(problems.dataset))


if __name__ == "__main__":
    main()
