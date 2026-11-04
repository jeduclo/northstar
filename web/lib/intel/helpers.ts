import { series as getSeries, recessions } from "../data";
import type { Series } from "../types";
import type { LineSeries, TimePoint } from "../intel-types";

export const C = {
  ca: "var(--c-ca)",
  us: "var(--c-us)",
  s3: "var(--c-3)",
  s4: "var(--c-4)",
  s5: "var(--c-5)",
} as const;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const T = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

export function get(name: string): Series | undefined {
  const s = getSeries(name);
  return s && s.data.length ? s : undefined;
}

export const lastV = (s: Series) => s.latest.value;

/** Value at (or just before) `months` months before the series' latest observation. */
export function ago(s: Series, months: number): number | undefined {
  const d = new Date(T(s.latest.date));
  d.setUTCMonth(d.getUTCMonth() - months);
  const cutoff = d.getTime();
  let found: number | undefined;
  for (const [iso, v] of s.data) {
    if (T(iso) <= cutoff) found = v;
    else break;
  }
  return found;
}

export function change(s: Series, months: number): number | undefined {
  const a = ago(s, months);
  return a === undefined ? undefined : lastV(s) - a;
}

export function windowPts(s: Series, years: number): TimePoint[] {
  const start = T(s.latest.date) - years * 365.25 * 86_400_000;
  return s.data.filter(([d]) => T(d) >= start).map(([d, v]) => [T(d), v]);
}

export function values(s: Series, years: number): number[] {
  return windowPts(s, years).map(([, v]) => v);
}

/** Share (0–100) of the window's observations at or below `v`. */
export function percentile(s: Series, years: number, v = lastV(s)): number {
  const vals = values(s, years);
  return Math.round((100 * vals.filter((x) => x <= v).length) / Math.max(vals.length, 1));
}

export const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(xs.length, 1);

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function corr(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 6) return null;
  const ma = mean(a.slice(0, n)), mb = mean(b.slice(0, n));
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : null;
}

/** OLS slope of y on x. */
export function slope(xs: number[], ys: number[]): number | null {
  if (xs.length < 6) return null;
  const mx = mean(xs), my = mean(ys);
  let num = 0, den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den ? num / den : null;
}

export function line(name: string, color: string, years: number, opts: { label?: string; dash?: string } = {}): LineSeries | null {
  const s = get(name);
  if (!s) return null;
  const who = s.country === "CA" ? "Canada" : "U.S.";
  return { key: name, label: opts.label ?? `${who}: ${s.description}`, color, dash: opts.dash, data: windowPts(s, years) };
}

export const present = <T,>(xs: (T | null | undefined | false | "" | 0)[]): T[] => xs.filter((x): x is T => !!x);

export function recessionSpans(countries: ("CA" | "US")[], fromMs: number): [number, number][] {
  return recessions
    .filter((r) => countries.includes(r.country) && T(r.end_date) >= fromMs)
    .map((r) => [Math.max(T(r.start_date), fromMs), T(r.end_date)] as [number, number]);
}

export function period(iso: string, freq: Series["frequency"] = "M"): string {
  const d = new Date(T(iso));
  if (freq === "Q") return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export const when = (s: Series) => period(s.latest.date, s.frequency);

export const pct = (v: number, d = 1) => `${v.toFixed(d)}%`;
export const num = (v: number, d = 2) => v.toFixed(d);
export const signed = (v: number, d = 1, unit = "") =>
  `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(d)}${unit}`;
export const pp = (v: number, d = 2) => signed(v, d, " pts");

export function maxDate(...ss: (Series | undefined)[]): string {
  return ss.filter((s): s is Series => !!s).map((s) => s.latest.date).sort().at(-1) ?? "";
}

export function upDown(v: number, up = "up", down = "down") {
  return v >= 0 ? up : down;
}
