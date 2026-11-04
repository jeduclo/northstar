import Link from "next/link";
import type { Answer, Call, LensId, RiskAlert, SectorCall, Tone } from "@/lib/intel-types";
import QChart from "./QChart";

const TONE: Record<Tone, { cls: string; icon: string; sr: string }> = {
  good: { cls: "border-up/30 bg-up/[0.07] text-up", icon: "▲", sr: "Favourable" },
  bad: { cls: "border-down/30 bg-down/[0.07] text-down", icon: "▼", sr: "Unfavourable" },
  caution: { cls: "border-warn/30 bg-warn/[0.07] text-warn", icon: "◆", sr: "Caution" },
  neutral: { cls: "border-line bg-panel text-muted", icon: "●", sr: "Neutral" },
};

export function VerdictChip({ label, tone, size = "md" }: { label: string; tone: Tone; size?: "sm" | "md" }) {
  const t = TONE[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${t.cls} ${size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"}`}>
      <span aria-hidden className="text-[0.7em]">{t.icon}</span>
      <span className="sr-only">{t.sr}: </span>
      {label}
    </span>
  );
}

export function AiBadge({ by, at }: { by: string; at?: string }) {
  const ai = by !== "rules";
  const name = by.startsWith("claude") ? "Claude" : by.startsWith("gemini") ? "Gemini" : by;
  const date = at ? new Date(at).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "America/Toronto" }) : "";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs text-accent">
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden><path d="M5 0 L6 4 L10 5 L6 6 L5 10 L4 6 L0 5 L4 4 Z" fill="currentColor" /></svg>
      {ai ? `Written by ${name}` : "Automated summary"}{date && `, ${date}`}
    </span>
  );
}

const METRIC_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2 max-w-xl",
  3: "grid-cols-2 sm:grid-cols-3 max-w-3xl",
  4: "grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
};

const NOTE_TITLE: Record<LensId, string> = {
  household: "What this means for you",
  investor: "Strategist's take",
  policy: "Analyst's assessment",
  student: "Tutor's note",
};

export function QuestionCard({ a, note }: { a: Answer; note?: string; index?: number }) {
  const asOf = a.asOf ? new Date(`${a.asOf}T00:00:00Z`).toLocaleDateString("en-CA", { month: "long", year: "numeric", timeZone: "UTC" }) : "";
  return (
    <section id={a.id} className="border-t border-line pt-10">
      <div className="grid gap-x-12 gap-y-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0">
          <h2 className="font-serif text-[28px] leading-tight font-semibold tracking-[-0.01em]">{a.question}</h2>
          <div className="mt-4"><VerdictChip label={a.verdict.label} tone={a.verdict.tone} /></div>
          <p className="mt-4 max-w-[68ch] text-[16px] leading-relaxed text-ink/90">{a.summary}</p>
        </div>
        {note && (
          <aside className="self-start rounded-lg bg-accent-soft/70 p-5 text-[14.5px] leading-relaxed">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-accent">{NOTE_TITLE[a.lens]}</h3>
            <p className="mt-2">{note}</p>
          </aside>
        )}
      </div>

      {a.metrics.length > 0 && (
        <dl className={`mt-7 grid gap-x-8 gap-y-5 ${METRIC_COLS[Math.min(a.metrics.length, 5)]}`}>
          {a.metrics.slice(0, 5).map((m) => (
            <div key={m.label} className="border-l-2 border-line pl-4">
              <dt className="text-[13px] text-muted">{m.label}</dt>
              <dd className="mt-1 text-[22px] font-semibold tabular-nums tracking-tight">{m.value}</dd>
              {m.note && <dd className="text-xs text-muted">{m.note}</dd>}
            </div>
          ))}
        </dl>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <figure className="min-w-0 rounded-xl border border-line bg-surface p-5">
          <figcaption className="mb-3 text-[15px] font-medium">{a.chartTitle}</figcaption>
          {a.chart ? <QChart chart={a.chart} /> : <p className="py-10 text-center text-sm text-muted">The chart appears after the next data refresh.</p>}
        </figure>
        <div className="text-[14.5px] leading-relaxed">
          <h3 className="text-sm font-semibold">{a.lens === "student" ? "The theory" : "How to read this"}</h3>
          <p className="mt-2 text-muted">{a.explain}</p>
        </div>
      </div>

      <p className="mt-6 text-xs text-muted">
        Source: {a.sources.join("; ")}.{asOf && ` Latest data: ${asOf}.`}
        {a.pending?.length ? " Some detail is still being added to the data feed." : ""}
      </p>
    </section>
  );
}

const SEV: Record<RiskAlert["severity"], { cls: string; label: string }> = {
  high: { cls: "bg-down/10 text-down", label: "High" },
  medium: { cls: "bg-warn/10 text-warn", label: "Medium" },
  low: { cls: "bg-panel text-muted", label: "Low" },
};

export function AlertList({ alerts }: { alerts: RiskAlert[] }) {
  if (!alerts.length) return <p className="text-sm text-muted">No risk flags are raised right now.</p>;
  return (
    <ul className="divide-y divide-line [&>li:first-child]:pt-0">
      {alerts.map((a) => (
        <li key={a.id} className="flex gap-4 py-4">
          <span className={`mt-0.5 h-fit w-16 shrink-0 rounded-full py-0.5 text-center text-xs font-medium ${SEV[a.severity].cls}`}>{SEV[a.severity].label}</span>
          <div>
            <p className="font-medium">{a.title}</p>
            <p className="mt-0.5 text-sm text-muted">{a.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

const CALL_TONE: Record<Call, Tone> = { Overweight: "good", "Market weight": "neutral", Underweight: "bad" };
const SECTOR_NAME: Record<string, string> = { HealthCare: "Health care", Tech: "Technology" };

export function SectorTable({ calls }: { calls: SectorCall[] }) {
  const markets = (["US", "CA"] as const).filter((m) => calls.some((c) => c.market === m));
  const rs = (v: number | null) => (v == null ? "–" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}`);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {markets.map((m) => (
        <div key={m} className="overflow-x-auto">
          <h3 className="mb-3 flex items-center gap-2 font-semibold"><span className={`h-2 w-2 rounded-full ${m === "US" ? "bg-us" : "bg-ca"}`} aria-hidden />{m === "US" ? "United States, vs the S&P 500" : "Canada, vs the TSX 60"}</h3>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th className="py-1.5 pr-3 font-medium">Sector</th>
                <th className="py-1.5 pr-3 font-medium">Call</th>
                <th className="py-1.5 pr-3 text-right font-medium" title="Relative strength vs benchmark, percentage points">3m</th>
                <th className="py-1.5 text-right font-medium">6m</th>
              </tr>
            </thead>
            <tbody>
              {calls.filter((c) => c.market === m).map((c) => (
                <tr key={c.ticker} className="border-b border-line align-top">
                  <td className="py-2 pr-3">
                    <span className="font-medium">{SECTOR_NAME[c.sector] ?? c.sector}</span> <span className="text-xs text-muted">{c.ticker}</span>
                    <p className="text-xs text-muted">{c.rationale}</p>
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap"><VerdictChip size="sm" label={c.call} tone={CALL_TONE[c.call]} /></td>
                  <td className="py-2 pr-3 text-right tabular-nums">{rs(c.momentum3m)}</td>
                  <td className="py-2 text-right tabular-nums">{rs(c.momentum6m)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

export function VerdictList({ answers, lens }: { answers: Answer[]; lens: LensId }) {
  return (
    <ul className="divide-y divide-line">
      {answers.map((a) => (
        <li key={a.id}>
          <Link href={`/${lens}#${a.id}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-3 hover:text-accent">
            <span className="text-[15.5px]">{a.question}</span>
            <VerdictChip size="sm" label={a.verdict.label} tone={a.verdict.tone} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
