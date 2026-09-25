"""Double/debiased ML: effect of Bank of Canada rate changes on sector returns -> causal_effects.json.

Usage:  python -m pipeline.models.causal
Partially linear regression (DoubleMLPLR), per sector ETF:
  outcome   y = sector return in month t (%)
  treatment d = change in the BoC target overnight rate in month t (percentage points)
  controls  X = global/U.S. conditions and lagged market state (confounders of both)
Effects are reported per +0.25 pp, the usual size of one BoC move. Exploratory: monthly data,
few policy moves, and serial correlation that standard cross-fitting ignores.
"""
import os

import numpy as np
import pandas as pd

from .data import monthly_panel, now_iso, rotation, write_json

SEED = 42
STEP = 0.25   # report effects per +25 bp
N_REP = int(os.getenv("NORTHSTAR_DML_REPS", "5"))

CONTROL_SERIES = ["us_cpi", "ca_cpi_all_items", "us_fed_funds", "us_yield_10yr",
                  "wti_crude", "cad_usd_combined", "ca_unemployment", "us_unemployment"]


def build_frame() -> tuple[pd.DataFrame, list[str]]:
    macro = monthly_panel(CONTROL_SERIES + ["overnight_rate"])
    X = pd.DataFrame(index=macro.index)
    X["d"] = macro["overnight_rate"].diff()
    X["us_cpi"] = macro["us_cpi"]
    X["ca_cpi"] = macro["ca_cpi_all_items"]
    X["d_fed_funds"] = macro["us_fed_funds"].diff()
    X["d_us10y"] = macro["us_yield_10yr"].diff()
    X["wti_ret"] = 100 * macro["wti_crude"].pct_change()
    X["cad_ret"] = 100 * macro["cad_usd_combined"].pct_change()
    X["ca_unemp"] = macro["ca_unemployment"]
    X["us_unemp"] = macro["us_unemployment"]
    X["onr_lag"] = macro["overnight_rate"].shift(1)       # policy level before the move
    controls = [c for c in X.columns if c != "d"]
    return X, controls


def estimate(frame: pd.DataFrame, controls: list[str]) -> dict:
    import doubleml as dml
    from sklearn.ensemble import RandomForestRegressor

    data = dml.DoubleMLData(frame, y_col="y", d_cols="d", x_cols=controls)
    learner = RandomForestRegressor(n_estimators=200, max_depth=4, min_samples_leaf=5, random_state=SEED, n_jobs=-1)
    np.random.seed(SEED)
    model = dml.DoubleMLPLR(data, ml_l=learner, ml_m=learner, n_folds=5, n_rep=N_REP)
    model.fit()
    s = model.summary.iloc[0]
    lo, hi = model.confint(level=0.95).iloc[0]
    return {"coef": s["coef"] * STEP, "se": s["std err"] * STEP, "ci_low": lo * STEP,
            "ci_high": hi * STEP, "p_value": s["P>|t|"]}


def main():
    X, controls = build_frame()
    rot = rotation()
    effects = []
    for tk, g in rot.groupby("ticker"):
        g = g.set_index("month")
        frame = X.copy()
        frame["y"] = g["ret_1m"]
        frame["ret_lag"] = g["ret_1m"].shift(1)            # momentum control
        frame = frame.dropna()
        if len(frame) < 60:
            print(f"  skip {tk}: only {len(frame)} months"); continue
        r = estimate(frame, controls + ["ret_lag"])
        row = {"market": g["market"].iloc[0], "sector": g["sector"].iloc[0], "ticker": tk, "n_obs": len(frame),
               **{k: round(float(v), 4) for k, v in r.items()}}
        effects.append(row)
        print(f"  {tk:<8} {row['sector']:<12} {row['coef']:+6.2f}% per +25bp  "
              f"[{row['ci_low']:+.2f}, {row['ci_high']:+.2f}]  p={row['p_value']:.2f}  n={len(frame)}")

    write_json("causal_effects.json", {
        "generated_at": now_iso(),
        "method": "DoubleML partially linear regression, random forest nuisance models, 5-fold cross-fitting, repeated sample splits",
        "treatment": "Monthly change in the Bank of Canada target overnight rate",
        "outcome": "Same-month sector ETF total return (%)",
        "scale": "per +0.25 percentage point",
        "controls": controls + ["ret_lag"],
        "policy_moves": int((X["d"].abs() > 0).sum()),
        "effects": sorted(effects, key=lambda r: (r["market"], r["sector"])),
    })


if __name__ == "__main__":
    main()
