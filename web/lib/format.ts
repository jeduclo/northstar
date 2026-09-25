import type { Series } from "./types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const toTime = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

export function fmtPeriod(iso: string, frequency: Series["frequency"]): string {
  const d = new Date(toTime(iso));
  const y = d.getUTCFullYear();
  if (frequency === "Q") return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${y}`;
  return `${MONTHS[d.getUTCMonth()]} ${y}`;
}

export function fmtNumber(v: number, unit = ""): string {
  const abs = Math.abs(v);
  const digits = abs >= 1000 ? 0 : abs >= 100 ? 1 : 2;
  return v.toLocaleString("en-CA", { minimumFractionDigits: digits, maximumFractionDigits: digits })
    + (unit.startsWith("%") ? "%" : "");
}

/** Unit shown after the number (the % sign is already attached by fmtNumber). */
export function unitSuffix(unit: string): string {
  if (unit === "%") return "";
  if (unit.startsWith("% ")) return unit.slice(2);
  return unit;
}

export function fmtSigned(v: number, unit: string): string {
  const pts = unit.startsWith("%") || unit === "pp";
  const s = Math.abs(v).toLocaleString("en-CA", { maximumFractionDigits: 2 });
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${s}${pts ? " pp" : ""}`;
}

/** Daily/weekly series averaged into the current month are month-to-date. */
export function isMonthToDate(s: Series, generatedAt: string): boolean {
  if (s.frequency !== "D" && s.frequency !== "W") return false;
  return s.latest.date.slice(0, 7) === generatedAt.slice(0, 7);
}

export function fmtRefreshed(iso: string): string {
  return new Date(iso).toLocaleString("en-CA", {
    timeZone: "America/Toronto", dateStyle: "medium", timeStyle: "short",
  });
}

export const pct = (s?: Series) => (s ? `${s.latest.value.toFixed(1)}%` : "n/a");
