/**
 * Server-side data access. Reads the pipeline's exported JSON from public/data at build time.
 * Files are read from disk (not imported) so that optional outputs — momentum.json, briefings.json,
 * new tabs — can be absent without breaking the build.
 * Server-only: never import this from a "use client" component.
 */
import fs from "node:fs";
import path from "node:path";
import type { Recession, Series, TabData } from "./types";
import type { RotationData } from "./rotation";
import type { Causal, Forecasts } from "./outlook";
import type { Briefings, Momentum } from "./intel-types";

const DIR = path.join(process.cwd(), "public", "data");
const cache = new Map<string, unknown>();

export function readJson<T>(rel: string, fallback: T): T {
  if (cache.has(rel)) return cache.get(rel) as T;
  let value: T = fallback;
  try {
    value = JSON.parse(fs.readFileSync(path.join(DIR, rel), "utf8")) as T;
  } catch {
    /* missing or unreadable: use fallback */
  }
  cache.set(rel, value);
  return value;
}

export interface Manifest {
  generated_at: string;
  tabs: Record<string, { series: number; latest: string }>;
  sources?: { datasets: number; ok: number; attention: string[] };
}

export const manifest = readJson<Manifest>("manifest.json", { generated_at: new Date(0).toISOString(), tabs: {} });

export const TAB_FILES = ["output", "labour", "prices", "money", "sentiment", "trade", "markets"] as const;

export function getTab(slug: string): TabData | undefined {
  const t = readJson<TabData | null>(`tabs/${slug}.json`, null);
  return t ?? undefined;
}

let index: Map<string, Series> | null = null;
/** Any exported series by name, across all tabs. */
export function series(name: string): Series | undefined {
  if (!index) {
    index = new Map();
    for (const slug of TAB_FILES) for (const s of getTab(slug)?.series ?? []) index.set(s.name, s);
  }
  return index.get(name);
}

export const recessions = readJson<Recession[]>("recessions.json", []);
export const rotation = readJson<RotationData>("rotation.json", { latest_month: "", rows: [] });
export const fxOil = readJson<{ month: string; cad: number; wti: number; corr_12m: number | null; corr_36m: number | null }[]>("fx_oil.json", []);
export const forecasts = readJson<Forecasts | null>("forecasts.json", null);
export const causal = readJson<Causal | null>("causal_effects.json", null);
export const momentum = readJson<Momentum | null>("momentum.json", null);
export const briefings = readJson<Briefings | null>("briefings.json", null);
