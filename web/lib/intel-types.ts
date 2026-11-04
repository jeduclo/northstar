/** Client-safe types shared by the question engine, the briefing script and the UI. */

export type LensId = "household" | "investor" | "policy" | "student";
export type Tone = "good" | "bad" | "caution" | "neutral";

export interface Verdict {
  label: string;
  tone: Tone;
}

export interface Metric {
  label: string;
  value: string;
  note?: string;
}

/** Points are [epoch ms, value]. */
export type TimePoint = [number, number];

export interface LineSeries {
  key: string;
  label: string;
  color: string;           // CSS colour (var(--c-…))
  dash?: string;
  data: TimePoint[];
}

export type ChartData =
  | {
      kind: "line" | "bar";
      unit: string;
      series: LineSeries[];
      band?: [number, number];
      bandLabel?: string;
      zero?: boolean;
      ref?: { y: number; label: string };
      recessions?: [number, number][];
      step?: boolean;
    }
  | {
      kind: "scatter";
      xLabel: string;
      yLabel: string;
      groups: { key: string; label: string; color: string; points: { x: number; y: number; date: string }[] }[];
      latest?: { x: number; y: number; date: string };
    }
  | {
      kind: "curve";
      unit: string;
      series: { key: string; label: string; color: string; dash?: string; points: { tenor: string; years: number; y: number }[] }[];
    }
  | {
      kind: "hbar";
      unit: string;
      rows: { label: string; value: number; color: string; group?: string }[];
      ref?: { value: number; label: string };
    };

export interface Answer {
  id: string;
  lens: LensId;
  question: string;
  short: string;            // short label for navigation
  verdict: Verdict;
  summary: string;          // one or two sentences with the numbers
  metrics: Metric[];
  chart: ChartData | null;
  chartTitle: string;
  explain: string;          // how to read it / the theory (static, plain language)
  sources: string[];
  asOf: string;             // latest data date used, YYYY-MM-DD
  pending?: string[];       // series the answer would use once the pipeline delivers them
}

export interface CycleReading {
  country: "CA" | "US";
  phase: "Early cycle" | "Mid cycle" | "Late cycle" | "Contraction";
  level: number;           // OECD CLI minus 100
  momentum: number;        // 3-month change in CLI
  trail: { date: string; level: number; momentum: number }[];
  asOf: string;
}

export type Call = "Overweight" | "Market weight" | "Underweight";

export interface SectorCall {
  market: "CA" | "US";
  sector: string;
  ticker: string;
  call: Call;
  score: number;
  momentum3m: number | null;   // relative strength vs benchmark, pp
  momentum6m: number | null;
  rationale: string;
}

export interface RiskAlert {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
}

export interface MomentumRow {
  market: string;
  sector: string;
  ticker: string;
  date: string;
  close: number;
  r1w: number | null;
  r1m: number | null;
  r3m: number | null;
  rytd: number | null;
  r12m: number | null;
}

export interface Momentum {
  as_of: string;
  rows: MomentumRow[];
}

export interface PersonaBriefing {
  headline: string;
  bullets: string[];
  notes: Record<string, string>;   // question id -> analyst/tutor note
}

export interface Briefings {
  generated_at: string;
  generated_by: string;            // e.g. "claude-sonnet-5-5", "gemini-2.5-flash" or "rules"
  data_as_of: string;
  executive_summary: string;
  personas: Record<LensId, PersonaBriefing>;
  sectors: SectorCall[];
  alerts: RiskAlert[];
}
