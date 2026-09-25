import rotationJson from "@/public/data/rotation.json";
import type { Country } from "./types";

export type Horizon = "3m" | "6m" | "12m";

export interface RotRow {
  month: string;
  market: Country;
  sector: string;
  ticker: string;
  close: number;
  ret_1m: number | null;
  ret_3m: number | null;
  ret_6m: number | null;
  ret_12m: number | null;
  rs_3m: number | null;
  rs_6m: number | null;
  rs_12m: number | null;
}

export interface RotationData {
  latest_month: string;
  rows: RotRow[];
}

export const rotation = rotationJson as RotationData;

export const rsKey = (h: Horizon) => `rs_${h}` as const;
export const retKey = (h: Horizon) => `ret_${h}` as const;

export const BENCHMARK_NAME: Record<Country, string> = { CA: "S&P/TSX 60", US: "S&P 500" };

export function latestRows(data: RotationData): RotRow[] {
  return data.rows.filter((r) => r.month === data.latest_month);
}

export function sectorsOf(data: RotationData, market?: Country): string[] {
  const set = new Set(
    data.rows.filter((r) => r.sector !== "Benchmark" && (!market || r.market === market)).map((r) => r.sector),
  );
  return [...set].sort();
}

export function pairedSectors(data: RotationData): string[] {
  const ca = new Set(sectorsOf(data, "CA"));
  return sectorsOf(data, "US").filter((s) => ca.has(s));
}

const signed = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(0)}`;

/** One-sentence answer for the page header, from the latest complete month. */
export function rotationAnswer(data: RotationData): string {
  const latest = latestRows(data).filter((r) => r.sector !== "Benchmark" && r.rs_12m !== null);
  const pick = (m: Country, dir: 1 | -1) =>
    latest.filter((r) => r.market === m).sort((a, b) => dir * ((b.rs_12m ?? 0) - (a.rs_12m ?? 0)))[0];
  const caTop = pick("CA", 1), usTop = pick("US", 1), caLow = pick("CA", -1);
  if (!caTop || !usTop || !caLow) return "";
  return `Over the past 12 months, ${caTop.sector} led in Canada (${signed(caTop.rs_12m!)} points vs the TSX 60) `
    + `and ${usTop.sector} led in the U.S. (${signed(usTop.rs_12m!)} vs the S&P 500); `
    + `${caLow.sector} lagged most in Canada (${signed(caLow.rs_12m!)}).`;
}
