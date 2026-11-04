import type { Answer, LensId } from "../intel-types";
import { household } from "./household";
import { investor } from "./investor";
import { policy } from "./policy";
import { student } from "./student";

export { cycle, baselineSectors, riskAlerts, PHASE_NOTES } from "./cycle";

export interface Lens {
  id: LensId;
  label: string;
  who: string;
  focus: string;
  question: string;
  blurb: string;
}

export const LENSES: Lens[] = [
  { id: "household", label: "Household", who: "Households", focus: "Cost of living, debt and purchasing power",
    question: "How does this affect my wallet and my mortgage?",
    blurb: "Plain answers on mortgages, groceries, jobs, the loonie and big purchases." },
  { id: "investor", label: "Investor", who: "Investors", focus: "Sector rotation, risk regime and capital preservation",
    question: "Where should I deploy capital right now?",
    blurb: "Risk-on or risk-off, sector momentum, recession odds, inflation hedges, U.S. vs Canada." },
  { id: "policy", label: "Policy analyst", who: "Policy analysts", focus: "Systemic health and structural shifts",
    question: "Is the economy's structure healthy?",
    blurb: "BoC–Fed divergence, inflation drivers, productivity, housing fragility, job quality." },
  { id: "student", label: "Student", who: "Students", focus: "Textbook theory, tested on live data",
    question: "How do these concepts actually work?",
    blurb: "Yield curves, the Phillips curve, petrocurrencies, core inflation, monetary transmission." },
];

const BUILDERS: Record<LensId, (() => Answer)[]> = { household, investor, policy, student };

const cache = new Map<LensId, Answer[]>();

export function answersFor(lens: LensId): Answer[] {
  if (!cache.has(lens)) {
    cache.set(lens, BUILDERS[lens].map((build) => {
      try {
        return build();
      } catch (e) {
        console.error(`question builder failed (${lens})`, e);
        return null;
      }
    }).filter((a): a is Answer => a !== null));
  }
  return cache.get(lens)!;
}

export function allAnswers(): Answer[] {
  return LENSES.flatMap((l) => answersFor(l.id));
}

export const getLens = (id: string) => LENSES.find((l) => l.id === id);
