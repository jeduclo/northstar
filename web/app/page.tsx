import Link from "next/link";
import CycleMap from "@/components/intel/CycleMap";
import { AiBadge, AlertList, SectorTable, VerdictChip } from "@/components/intel/parts";
import { briefings, manifest } from "@/lib/data";
import { LENSES, PHASE_NOTES, answersFor, baselineSectors, cycle, riskAlerts } from "@/lib/intel";

function Section({ title, kicker, children, action }: { title: string; kicker?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          {kicker && <p className="text-xs font-medium uppercase tracking-wider text-muted">{kicker}</p>}
          <h2 className="font-serif text-2xl font-semibold">{title}</h2>
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function Overview() {
  const cyc = cycle();
  const alerts = briefings?.alerts?.length ? briefings.alerts : riskAlerts();
  const sectors = briefings?.sectors?.length ? briefings.sectors : baselineSectors();
  const ai = briefings && briefings.generated_by !== "rules";

  return (
    <div className="space-y-8">
      <header className="pt-2">
        <h1 className="max-w-4xl font-serif text-4xl leading-tight font-semibold sm:text-5xl">
          The Canadian and U.S. economies, answered.
        </h1>
        <p className="mt-4 max-w-3xl text-lg text-muted">
          Twenty questions that matter to households, investors, policy analysts and students, answered every weekday from
          Bank of Canada, Statistics Canada, FRED and market data, with charts you can check and an AI analyst that explains what changed.
        </p>
      </header>

      <section aria-labelledby="lens-h">
        <h2 id="lens-h" className="text-sm font-medium text-muted">I&apos;m looking at this as a…</h2>
        <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {LENSES.map((l) => {
            const top = answersFor(l.id).slice(0, 3);
            return (
              <li key={l.id}>
                <Link href={`/${l.id}`} className="group flex h-full flex-col rounded-xl border border-line bg-surface p-5 transition-colors hover:border-ink">
                  <span className="text-lg font-semibold group-hover:text-ca">{l.label} →</span>
                  <span className="mt-1 font-serif text-[17px] leading-snug">“{l.question}”</span>
                  <span className="mt-2 text-sm text-muted">{l.blurb}</span>
                  <span className="mt-4 flex flex-col items-start gap-1.5 border-t border-line pt-3">
                    {top.map((a) => (
                      <span key={a.id} className="flex w-full flex-wrap items-center justify-between gap-1 text-xs">
                        <span className="text-muted">{a.short}</span>
                        <VerdictChip size="sm" label={a.verdict.label} tone={a.verdict.tone} />
                      </span>
                    ))}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <Section kicker="This week" title="Executive summary"
        action={briefings && <AiBadge by={briefings.generated_by} at={briefings.generated_at} />}>
        <p className="max-w-4xl text-[17px] leading-relaxed">{briefings?.executive_summary ?? "The summary is generated with each data refresh."}</p>
        {!ai && (
          <p className="mt-3 text-xs text-muted">
            Automated from the verdicts below. Add an Anthropic or Gemini API key to the data refresh for a written analyst briefing.
          </p>
        )}
      </Section>

      <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr]">
        <Section kicker="Business cycle" title="Where are we in the cycle?">
          <CycleMap readings={cyc} />
          <ul className="mt-4 space-y-2 text-sm">
            {cyc.map((c) => (
              <li key={c.country}>
                <span className="font-semibold">{c.country === "CA" ? "Canada" : "U.S."}: {c.phase}.</span>{" "}
                <span className="text-muted">{PHASE_NOTES[c.phase]}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section kicker="Risk monitor" title="Alerts"
          action={briefings && ai && <AiBadge by={briefings.generated_by} at={briefings.generated_at} />}>
          <AlertList alerts={alerts} />
        </Section>
      </div>

      <Section kicker="Sector rotation" title="Overweight, market weight, underweight"
        action={<Link href="/rotation" className="text-sm text-muted underline hover:text-ink">Full rotation dashboard</Link>}>
        <p className="mb-5 max-w-3xl text-sm text-muted">
          A starting point that combines where each economy sits in the cycle with each sector&apos;s 3- and 6-month strength against its
          benchmark{ai ? ", reviewed by the AI strategist" : ""}. Columns show relative strength in percentage points. Not a recommendation to buy or sell.
        </p>
        <SectorTable calls={sectors} />
      </Section>

      <Section kicker="All questions" title="Twenty questions, one dashboard">
        <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
          {LENSES.map((l) => (
            <div key={l.id}>
              <h3 className="font-semibold"><Link href={`/${l.id}`} className="hover:underline">{l.label}</Link> <span className="font-normal text-muted">· {l.focus}</span></h3>
              <ul className="mt-2 space-y-2">
                {answersFor(l.id).map((a) => (
                  <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line pb-2">
                    <Link href={`/${l.id}#${a.id}`} className="text-sm hover:underline">{a.question}</Link>
                    <VerdictChip size="sm" label={a.verdict.label} tone={a.verdict.tone} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <p className="text-xs text-muted">
        {Object.values(manifest.tabs).reduce((a, t) => a + t.series, 0)} indicators. Explore them all in the{" "}
        <Link href="/data" className="underline">indicator library</Link> or <Link href="/ask" className="underline">ask the data</Link> a question of your own.
      </p>
    </div>
  );
}
