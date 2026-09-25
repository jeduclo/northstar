export type Country = "CA" | "US";
export type Point = [string, number]; // [YYYY-MM-DD, value]

export interface Series {
  name: string;
  country: Country;
  description: string;
  unit: string;
  frequency: "D" | "W" | "M" | "Q";
  latest: { date: string; value: number };
  change: number | null;
  data: Point[];
}

export interface TabData {
  tab: string;
  series: Series[];
}

export interface Recession {
  country: Country;
  start_date: string;
  end_date: string;
  source: string;
}

export type ChartKind = "line" | "bar" | "step";

export interface ChartSpec {
  title: string;
  series: string[];
  kind: ChartKind;
  band?: [number, number]; // shaded target range, e.g. inflation 1–3%
  bandLabel?: string;
  zeroLine?: boolean;
  note?: string;
}

export interface TabSpec {
  slug: string;
  label: string;
  question: string;
  kpis: string[];
  charts: ChartSpec[];
  answer: (get: (name: string) => Series | undefined) => string;
}
