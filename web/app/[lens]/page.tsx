import Link from "next/link";
import { notFound } from "next/navigation";
import { AiBadge, AlertList, QuestionCard, SectorTable, VerdictList } from "@/components/intel/parts";
import { briefings } from "@/lib/data";
import { LENSES, answersFor, baselineSectors, getLens, riskAlerts } from "@/lib/intel";
import type { LensId } from "@/lib/intel-types";

export const dynamicParams = false;

export function generateStaticParams() {
  return LENSES.map((l) => ({ lens: l.id }));
}

export async function generateMetadata({ params }: PageProps<"/[lens]">) {
  const { lens } = await params;
  const l = getLens(lens);
  return l ? { title: `${l.label} | MacroIntelligence`, description: `${l.question} ${l.blurb}` } : {};
}

const BRIEF_TITLE: Record<LensId, string> = {
  household: "Your household briefing",
  investor: "Strategist's briefing",
  policy: "Policy briefing",
  student: "This week's lesson",
};

export default async function LensPage({ params }: PageProps<"/[lens]">) {
  const { lens } = await params;
  const l = getLens(lens);
  if (!l) notFound();
  const answers = answersFor(l.id);
  const brief = briefings?.personas?.[l.id];
  const hasBrief = !!brief?.headline;

  return (
    <article className="space-y-14">
      <header className="max-w-4xl">
        <p className="text-[15px] text-muted">{l.label} lens: {l.focus.toLowerCase()}</p>
        <h1 className="mt-3 font-serif text-[40px] leading-[1.1] font-semibold tracking-[-0.02em] sm:text-[48px]">“{l.question}”</h1>
        <nav aria-label="Questions on this page" className="mt-7 flex flex-wrap gap-2">
          {answers.map((a) => (
            <a key={a.id} href={`#${a.id}`} className="rounded-full border border-line px-3.5 py-1.5 text-sm text-muted transition-colors hover:border-accent hover:text-accent">
              {a.short}
            </a>
          ))}
        </nav>
      </header>

      <section className="rounded-xl bg-panel p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-[26px] font-semibold">{hasBrief ? BRIEF_TITLE[l.id] : "At a glance"}</h2>
          {briefings && hasBrief && <AiBadge by={briefings.generated_by} at={briefings.generated_at} />}
        </div>
        {hasBrief ? (
          <>
            <p className="mt-4 max-w-[70ch] font-serif text-[21px] leading-snug">{brief!.headline}</p>
            <ul className="mt-4 max-w-[75ch] space-y-2 text-[15.5px] leading-relaxed">
              {brief!.bullets.map((b) => (
                <li key={b} className="flex gap-3"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />{b}</li>
              ))}
            </ul>
          </>
        ) : (
          <div className="mt-5"><VerdictList answers={answers} lens={l.id} /></div>
        )}
      </section>

      {answers.map((a) => <QuestionCard key={a.id} a={a} note={brief?.notes?.[a.id]} />)}

      {l.id === "investor" && (
        <>
          <section className="border-t border-line pt-10">
            <h2 className="font-serif text-[28px] font-semibold">Sector positioning</h2>
            <p className="mb-6 mt-2 max-w-[70ch] text-[15px] text-muted">
              Cycle position plus 3- and 6-month relative strength (percentage points against the benchmark). General information, not a recommendation.
            </p>
            <SectorTable calls={briefings?.sectors?.length ? briefings.sectors : baselineSectors()} />
          </section>
          <section className="border-t border-line pt-10">
            <h2 className="font-serif text-[28px] font-semibold">Risk monitor</h2>
            <div className="mt-6 max-w-3xl"><AlertList alerts={briefings?.alerts?.length ? briefings.alerts : riskAlerts()} /></div>
          </section>
        </>
      )}

      <footer className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-line p-6">
        <span className="text-muted">See the economy through another lens:</span>
        {LENSES.filter((x) => x.id !== l.id).map((x) => (
          <Link key={x.id} href={`/${x.id}`} className="font-medium text-accent hover:underline">{x.label}</Link>
        ))}
        <Link href={`/ask?lens=${l.id}`} className="ml-auto rounded-full bg-accent px-4 py-2 text-sm font-medium text-surface hover:opacity-90">
          Ask your own question
        </Link>
      </footer>
    </article>
  );
}
