import Link from "next/link";
import CycleMap from "@/components/intel/CycleMap";
import { AiBadge, AlertList, SectorTable, VerdictChip } from "@/components/intel/parts";
import { briefings } from "@/lib/data";
import { LENSES, PHASE_NOTES, answersFor, baselineSectors, cycle, riskAlerts } from "@/lib/intel";
import { change, get, period } from "@/lib/intel/helpers";

function Section({ title, intro, children, action }: { title: string; intro?: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-serif text-[28px] leading-tight font-semibold tracking-[-0.01em]">{title}</h2>
        {action}
      </div>
      {intro && <p className="mt-2 max-w-[70ch] text-[15px] text-muted">{intro}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** Side-by-side headline readings for the two economies. */
function Pulse() {
  const rows: { label: string; ca: string; us: string; unit: string; dir?: [number | undefined, number | undefined] }[] = [];
  const pair = (label: string, ca: string, us: string, unit = "%", d = 2) => {
    const a = get(ca), b = get(us);
    if (!a || !b) return;
    rows.push({
      label, unit,
      ca: a.latest.value.toFixed(d), us: b.latest.value.toFixed(d),
      dir: [change(a, 3), change(b, 3)],
    });
  };
  pair("Policy rate", "overnight_rate", "us_fed_funds");
  pair("Inflation (CPI, y/y)", "ca_cpi_all_items", "us_cpi", "%", 1);
  pair("Core inflation", "cpi_trim", "us_core_pce", "%", 1);
  pair("Unemployment", "ca_unemployment", "us_unemployment", "%", 1);
  pair("10-year yield", "yield_10yr", "us_yield_10yr");
  const fx = get("cad_usd_combined");
  const arrow = (v?: number) => (v === undefined || Math.abs(v) < 0.05 ? "" : v > 0 ? "▲" : "▼");
  return (
    <figure className="rounded-xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(27,39,51,0.04),0_8px_24px_-12px_rgba(27,39,51,0.12)]">
      <figcaption className="flex items-baseline justify-between">
        <span className="font-semibold">Today&apos;s readings</span>
        <span className="text-xs text-muted">Arrows: change over 3 months</span>
      </figcaption>
      <table className="mt-3 w-full text-[14.5px] tabular-nums">
        <thead>
          <tr className="text-xs text-muted">
            <th className="pb-2 text-left font-normal" />
            <th className="pb-2 text-right font-medium"><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-ca" aria-hidden />Canada</th>
            <th className="pb-2 text-right font-medium"><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-us" aria-hidden />U.S.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-line">
              <th scope="row" className="py-2.5 text-left font-normal text-muted">{r.label}</th>
              <td className="py-2.5 text-right font-semibold">
                <span className="mr-1 text-[10px] text-muted">{arrow(r.dir?.[0])}</span>{r.ca}{r.unit}
              </td>
              <td className="py-2.5 text-right font-semibold">
                <span className="mr-1 text-[10px] text-muted">{arrow(r.dir?.[1])}</span>{r.us}{r.unit}
              </td>
            </tr>
          ))}
          {fx && (
            <tr className="border-t border-line">
              <th scope="row" className="py-2.5 text-left font-normal text-muted">Canadian dollar</th>
              <td colSpan={2} className="py-2.5 text-right font-semibold">US${fx.latest.value.toFixed(3)}</td>
            </tr>
          )}
        </tbody>
      </table>
      {fx && <p className="mt-2 text-xs text-muted">Latest available readings, to {period(fx.latest.date)}.</p>}
    </figure>
  );
}

export default function Overview() {
  const cyc = cycle();
  const alerts = briefings?.alerts?.length ? briefings.alerts : riskAlerts();
  const sectors = briefings?.sectors?.length ? briefings.sectors : baselineSectors();
  const ai = briefings && briefings.generated_by !== "rules";

  return (
    <div className="space-y-16">
      <header className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="pt-2">
          <h1 className="max-w-[16ch] font-serif text-[44px] leading-[1.06] font-semibold tracking-[-0.02em] sm:text-[56px]">
            The Canadian and U.S. economies, answered.
          </h1>
          <p className="mt-6 max-w-[56ch] text-lg leading-relaxed text-muted">
            Twenty questions that matter to households, investors, policy analysts and students, answered every weekday from
            Bank of Canada, Statistics Canada and Federal Reserve data, with the evidence on the page.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/household" className="rounded-full bg-accent px-5 py-2.5 text-[15px] font-medium text-surface hover:opacity-90">
              Start with your household
            </Link>
            <Link href="/ask" className="rounded-full border border-line px-5 py-2.5 text-[15px] font-medium hover:border-ink">
              Ask your own question
            </Link>
          </div>
        </div>
        <Pulse />
      </header>

      <section aria-labelledby="lens-h">
        <h2 id="lens-h" className="font-serif text-[28px] font-semibold tracking-[-0.01em]">Choose your lens</h2>
        <ul className="mt-6 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {LENSES.map((l) => {
            const top = answersFor(l.id).slice(0, 3);
            return (
              <li key={l.id} className="bg-surface">
                <Link href={`/${l.id}`} className="group flex h-full flex-col p-6 transition-colors hover:bg-panel">
                  <span className="text-[17px] font-semibold group-hover:text-accent">{l.label}</span>
                  <span className="mt-2 font-serif text-[18px] leading-snug">“{l.question}”</span>
                  <span className="mt-4 flex flex-1 flex-col justify-end gap-2">
                    {top.map((a) => (
                      <span key={a.id} className="flex flex-col items-start gap-1 text-[13px]">
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

      <Section title="This week in brief" action={briefings && <AiBadge by={briefings.generated_by} at={briefings.generated_at} />}>
        <p className="max-w-[72ch] font-serif text-[21px] leading-[1.6]">
          {briefings?.executive_summary ?? "The summary is written with each data refresh."}
        </p>
      </Section>

      <div className="grid gap-16 lg:grid-cols-[1.2fr_1fr] lg:gap-12">
        <Section title="Where are we in the cycle?">
          <CycleMap readings={cyc} />
          <ul className="mt-5 space-y-2 text-[15px]">
            {cyc.map((c) => (
              <li key={c.country}>
                <span className="font-semibold">{c.country === "CA" ? "Canada" : "U.S."}: {c.phase.toLowerCase()}.</span>{" "}
                <span className="text-muted">{PHASE_NOTES[c.phase]}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Risk monitor" action={ai && briefings && <AiBadge by={briefings.generated_by} at={briefings.generated_at} />}>
          <AlertList alerts={alerts} />
        </Section>
      </div>

      <Section title="Sector positioning"
        intro={<>Cycle position combined with each sector&apos;s 3- and 6-month strength against its benchmark{ai ? ", reviewed by the AI strategist" : ""}. Figures are percentage points of relative return. General information, not a recommendation.</>}
        action={<Link href="/rotation" className="text-sm text-accent hover:underline">Full rotation dashboard</Link>}>
        <SectorTable calls={sectors} />
      </Section>

      <Section title="All twenty questions">
        <div className="grid gap-x-12 gap-y-10 md:grid-cols-2">
          {LENSES.map((l) => (
            <div key={l.id}>
              <h3 className="text-[17px] font-semibold"><Link href={`/${l.id}`} className="hover:text-accent">{l.label}</Link></h3>
              <p className="text-sm text-muted">{l.focus}</p>
              <ul className="mt-3 divide-y divide-line border-y border-line">
                {answersFor(l.id).map((a) => (
                  <li key={a.id}>
                    <Link href={`/${l.id}#${a.id}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 hover:text-accent">
                      <span className="text-[15px]">{a.question}</span>
                      <VerdictChip size="sm" label={a.verdict.label} tone={a.verdict.tone} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
