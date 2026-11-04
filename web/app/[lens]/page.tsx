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
    <article className="space-y-8">
      <header>
        <p className="text-sm font-medium uppercase tracking-wider text-muted">{l.label} lens · {l.focus}</p>
        <h1 className="mt-2 max-w-4xl font-serif text-4xl leading-tight font-semibold">“{l.question}”</h1>
        <nav aria-label="Questions on this page" className="mt-5 flex flex-wrap gap-2">
          {answers.map((a, i) => (
            <a key={a.id} href={`#${a.id}`} className="rounded-full border border-line bg-surface px-3 py-1 text-sm text-muted hover:border-ink hover:text-ink">
              {i + 1}. {a.short}
            </a>
          ))}
        </nav>
      </header>

      <section className="rounded-xl border border-line bg-surface p-5 sm:p-7">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-serif text-2xl font-semibold">{hasBrief ? BRIEF_TITLE[l.id] : "At a glance"}</h2>
          {briefings && hasBrief && <AiBadge by={briefings.generated_by} at={briefings.generated_at} />}
        </div>
        {hasBrief ? (
          <>
            <p className="mt-3 max-w-4xl text-lg font-medium leading-snug">{brief!.headline}</p>
            <ul className="mt-3 max-w-4xl list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed">
              {brief!.bullets.map((b) => <li key={b}>{b}</li>)}
            </ul>
          </>
        ) : (
          <div className="mt-4"><VerdictList answers={answers} lens={l.id} /></div>
        )}
      </section>

      {answers.map((a, i) => <QuestionCard key={a.id} a={a} index={i} note={brief?.notes?.[a.id]} />)}

      {l.id === "investor" && (
        <>
          <section className="rounded-xl border border-line bg-surface p-5 sm:p-7">
            <h2 className="font-serif text-2xl font-semibold">Sector calls</h2>
            <p className="mb-5 mt-2 max-w-3xl text-sm text-muted">
              Cycle position plus 3- and 6-month relative strength (percentage points vs benchmark). General information, not a recommendation.
            </p>
            <SectorTable calls={briefings?.sectors?.length ? briefings.sectors : baselineSectors()} />
          </section>
          <section className="rounded-xl border border-line bg-surface p-5 sm:p-7">
            <h2 className="font-serif text-2xl font-semibold">Risk alerts</h2>
            <div className="mt-3"><AlertList alerts={briefings?.alerts?.length ? briefings.alerts : riskAlerts()} /></div>
          </section>
        </>
      )}

      <footer className="flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-5 text-sm">
        <span className="text-muted">Other lenses:</span>
        {LENSES.filter((x) => x.id !== l.id).map((x) => (
          <Link key={x.id} href={`/${x.id}`} className="underline hover:text-ca">{x.label}</Link>
        ))}
        <Link href={`/ask?lens=${l.id}`} className="ml-auto underline hover:text-ca">Ask your own question →</Link>
      </footer>
    </article>
  );
}
