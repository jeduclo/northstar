"""Lightweight ingest for CI: every source except full StatCan tables.

Usage (from repo root):  python -m pipeline.ingest
Writes data/audit_report.csv (used by the manifest). Exits 1 if any source FAILED.
For deep inspection of StatCan tables, run `python -m pipeline.audit` locally.
"""
import sys
import time
import pandas as pd
from pipeline.sources import boc, fred, statcan_series, markets
from pipeline.sources.common import RAW_DIR


def main():
    report = []
    for mod in (boc, fred, statcan_series, markets):
        name, t0 = mod.__name__.split(".")[-1], time.time()
        print(f"Running {name} ...", flush=True)
        report += mod.run()
        print(f"  done in {time.time() - t0:.0f}s", flush=True)
    df = pd.DataFrame(report)
    df.to_csv(RAW_DIR.parent / "audit_report.csv", index=False)
    print(df[["source", "dataset", "rows", "end", "status"]].to_string(index=False))
    bad = df[df.status == "FAILED"]
    if len(bad):
        print("FAILED:\n" + bad[["dataset", "note"]].to_string(index=False))
        sys.exit(1)
    print(f"INGEST OK ({len(df)} datasets)")


if __name__ == "__main__":
    main()
