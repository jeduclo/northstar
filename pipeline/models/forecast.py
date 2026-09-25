"""Zero-shot probabilistic forecasts with Amazon Chronos-2 -> forecasts.json.

Usage (Colab, GPU optional):  python -m pipeline.models.forecast
Macro series: 12-month P10/P50/P90 paths, plus a 12-month holdout backtest vs a naive forecast.
Sectors: forecast monthly log price 12 steps ahead -> 12-month cumulative return quantiles.
"""
import math

import numpy as np
import pandas as pd

from .data import monthly_panel, now_iso, rotation, series_long, write_json

MODEL_ID = "amazon/chronos-2"
H = 12
QUANTILES = [0.1, 0.5, 0.9]
HISTORY_MONTHS = 60        # history shipped with each macro forecast for the chart

MACRO = [  # monthly series (display values, e.g. CPI already y/y)
    "ca_cpi_all_items", "us_cpi", "cpi_trim",
    "ca_unemployment", "us_unemployment",
    "overnight_rate", "us_fed_funds",
    "ca_spread_10_2", "us_spread_10_2",
    "cad_usd_combined", "wti_crude", "canada_oecd_cli",
]


def load_pipeline():
    import torch
    from chronos import Chronos2Pipeline
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"  loading {MODEL_ID} on {device}")
    return Chronos2Pipeline.from_pretrained(MODEL_ID, device_map=device)


def predict(pipe, context: pd.DataFrame) -> pd.DataFrame:
    """context: columns id, timestamp, target (monthly). Returns id, timestamp, q0.1, q0.5, q0.9."""
    pred = pipe.predict_df(context, prediction_length=H, quantile_levels=QUANTILES,
                           id_column="id", timestamp_column="timestamp", target="target")
    cols = {}
    for q in QUANTILES:   # quantile columns are named like "0.1" (string) or 0.1
        match = [c for c in pred.columns if str(c) == str(q)]
        if not match:
            raise KeyError(f"quantile column {q} not in Chronos output: {list(pred.columns)}")
        cols[match[0]] = f"q{q}"
    return pred.rename(columns=cols)[["id", "timestamp"] + [f"q{q}" for q in QUANTILES]]


def to_context(wide: pd.DataFrame) -> pd.DataFrame:
    long = wide.reset_index().melt(id_vars="date", var_name="id", value_name="target").dropna()
    long = long.rename(columns={"date": "timestamp"})
    # Chronos needs a regular grid: complete month-start index per series, interpolating rare gaps
    frames = []
    for sid, g in long.groupby("id"):
        g = g.set_index("timestamp").asfreq("MS")
        g["target"] = g["target"].interpolate(limit_direction="both")
        g["id"] = sid
        frames.append(g.reset_index())
    return pd.concat(frames, ignore_index=True)[["id", "timestamp", "target"]]


def macro_forecasts(pipe) -> list[dict]:
    meta = series_long().drop_duplicates("name").set_index("name")
    wide = monthly_panel(MACRO)
    # Drop the current (partial) month so every series ends on a complete month
    wide = wide[wide.index < pd.Timestamp.today().normalize().replace(day=1)]
    ctx = to_context(wide)

    fc = predict(pipe, ctx)
    # Backtest: hide the last 12 months, forecast them, compare with naive last value
    cut = ctx.groupby("id")["timestamp"].transform("max") - pd.DateOffset(months=H)
    bt_ctx = ctx[ctx.timestamp <= cut]
    bt = predict(pipe, bt_ctx)
    actual = ctx.set_index(["id", "timestamp"])["target"]

    out = []
    for sid in MACRO:
        if sid not in wide:
            print(f"  skip {sid}: no data"); continue
        hist = ctx[ctx.id == sid].tail(HISTORY_MONTHS)
        f = fc[fc.id == sid]
        b = bt[bt.id == sid].set_index("timestamp")
        truth = actual.loc[sid].reindex(b.index)
        naive = bt_ctx[bt_ctx.id == sid].target.iloc[-1]
        mae_model = float((b["q0.5"] - truth).abs().mean())
        mae_naive = float((naive - truth).abs().mean())
        m = meta.loc[sid]
        out.append({
            "name": sid, "country": m.country, "description": m.description, "unit": m.display_unit,
            "history": [[d.strftime("%Y-%m-%d"), round(float(v), 4)] for d, v in zip(hist.timestamp, hist.target)],
            "forecast": [[d.strftime("%Y-%m-%d"), *(round(float(r[f"q{q}"]), 4) for q in QUANTILES)]
                         for d, (_, r) in zip(f.timestamp, f.iterrows())],
            "backtest": {"mae_model": round(mae_model, 4), "mae_naive": round(mae_naive, 4)},
        })
        print(f"  {sid:<22} P50 in 12m: {f['q0.5'].iloc[-1]:8.2f}   backtest MAE {mae_model:.2f} vs naive {mae_naive:.2f}")
    return out


def sector_forecasts(pipe) -> list[dict]:
    rot = rotation()
    wide = rot.pivot_table(index="month", columns="ticker", values="close").apply(np.log)
    wide.index.name = "date"
    ctx = to_context(wide)
    fc = predict(pipe, ctx)
    last = ctx.groupby("id")["target"].last()
    info = rot.drop_duplicates("ticker").set_index("ticker")
    out = []
    for tk, g in fc.groupby("id"):
        end = g.iloc[-1]
        # Quantiles of the 12-step log level, converted to cumulative % return
        q = {f"p{int(qq * 100)}": round(100 * (math.exp(end[f"q{qq}"] - last[tk]) - 1), 2) for qq in QUANTILES}
        out.append({"market": info.loc[tk, "market"], "sector": info.loc[tk, "sector"], "ticker": tk, **q})
    return sorted(out, key=lambda r: (r["market"], r["sector"]))


def main():
    pipe = load_pipeline()
    print("Macro forecasts ...")
    macro = macro_forecasts(pipe)
    print("Sector forecasts ...")
    sectors = sector_forecasts(pipe)
    write_json("forecasts.json", {
        "generated_at": now_iso(), "model": MODEL_ID, "horizon_months": H,
        "quantiles": QUANTILES, "macro": macro, "sectors": sectors,
    })


if __name__ == "__main__":
    main()
