import type { Series } from "@/lib/types";

const PALETTE = {
  CA: ["var(--ca)", "var(--ca-2)", "var(--ca-3)"],
  US: ["var(--us)", "var(--us-2)", "var(--us-3)"],
};

/** Colour by country; later series of the same country get a lighter/darker shade and a dash. */
export function styleFor(series: Series[]) {
  const seen = { CA: 0, US: 0 };
  return series.map((s) => {
    const i = seen[s.country]++;
    return { color: PALETTE[s.country][i % 3], dash: i === 0 ? undefined : i === 1 ? "6 3" : "2 3" };
  });
}
