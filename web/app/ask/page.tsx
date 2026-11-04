import AskView from "@/components/ask/AskView";
import { manifest } from "@/lib/data";

export const metadata = { title: "Ask the data | MacroIntelligence" };

export default async function AskPage({ searchParams }: PageProps<"/ask">) {
  const { lens } = await searchParams;
  const series = Object.values(manifest.tabs).reduce((a, t) => a + t.series, 0);
  return (
    <article className="mx-auto max-w-4xl">
      <h1 className="max-w-[20ch] font-serif text-[40px] leading-[1.1] font-semibold tracking-[-0.02em] sm:text-[48px]">
        What would you like to know about the two economies?
      </h1>
      <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-muted">
        Ask in plain language. The assistant searches {series} indicators and 14 sector funds, runs a read-only query,
        and shows you the numbers behind its answer.
      </p>
      <AskView initialLens={typeof lens === "string" ? lens : undefined} />
    </article>
  );
}
