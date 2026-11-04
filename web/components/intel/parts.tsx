import Link from "next/link";
import type { Answer, Call, LensId, RiskAlert, SectorCall, Tone } from "@/lib/intel-types";
import QChart from "./QChart";

const TONE: Record<Tone, { cls: string; icon: string; sr: string }> = {
  good: { cls: "border-up/40 bg-up/10 text-up", icon: "▲", sr: "Favourable" },
  bad: { cls: "border-down/40 bg-down/10 text-down", icon: "▼", sr: "Unfavourable" },
  caution: { cls: "border-warn/40 bg-warn/10 text-warn", icon: "◆", sr: "Caution" },
  neutral: { cls: "border-line bg-canvas text-muted", icon: "●", sr: "Neutral" },
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
    <span className="inline-flex items-center gap-1.5 rounded border border-line px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted">
      {ai ? `AI analysis · ${name}` : "Automated summary"}{date && ` · ${date}`}
    </span>
  );
}

const METRIC_COLS: Record<number, string> = {
  1: "grid-cols-1 max-w-xs",
  2: "grid-cols-2 max-w-lg",
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

export function QuestionCard({ a, note, index }: { a: Answer; note?: string; index: number }) {
  const asOf = a.asOf ? new Date(`${a.asOf}T00:00:00Z`).toLocaleDateString("en-CA", { month: "short", year: "numeric", timeZone: "UTC" }) : "";
  return (
    <section id={a.id} className="rounded-xl border border-line bg-surface p-5 sm:p-7">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">Question {index + 1}</p>
      <h2 className="mt-1 font-serif text-2xl leading-snug font-semibold">{a.question}</h2>
      <div className="mt-3"><VerdictChip label={a.verdict.label} tone={a.verdict.tone} /></div>
      <p className="mt-4 max-w-3xl text-[15px] leading-relaxed">{a.summary}</p>

      {a.metrics.length > 0 && (
        <dl className={`mt-5 grid gap-px overflow-hidden rounded-lg border border-line bg-line ${METRIC_COLS[Math.min(a.metrics.length, 5)]}`}>
          {a.metrics.slice(0, 5).map((m) => (
            <div key={m.label} className="bg-surface p-3">
              <dt className="text-xs text-muted">{m.label}</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums">{m.value}</dd>
              {m.note && <dd className="text-xs text-muted">{m.note}</dd>}
            </div>
          ))}
        </dl>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <figure className="min-w-0">
          <figcaption className="mb-2 text-sm font-medium">{a.chartTitle}</figcaption>
          {a.chart ? <QChart chart={a.chart} /> : <p className="py-10 text-center text-sm text-muted">Chart available after the next data refresh.</p>}
        </figure>
        <aside className="space-y-4 text-sm leading-relaxed">
          {note && (
            <div className="rounded-lg border-l-2 border-us bg-canvas p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{NOTE_TITLE[a.lens]}</h3>
              <p className="mt-1.5">{note}</p>
            </div>
          )}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{a.lens === "student" ? "The theory" : "How to read this"}</h3>
            <p className="mt-1.5 text-muted">{a.explain}</p>
          </div>
        </aside>
      </div>

      <p className="mt-5 border-t border-line pt-3 text-xs text-muted">
        Sources: {a.sources.join("; ")}.{asOf && ` Latest data: ${asOf}.`}
        {a.pending?.length ? ` More detail (${a.pending.join(", ")}) appears once the data pipeline delivers it.` : ""}
      </p>
    </section>
  );
}

const SEV: Record<RiskAlert["severity"], { cls: string; label: string }> = {
  high: { cls: "bg-down text-surface", label: "High" },
  medium: { cls: "bg-warn text-surface", label: "Medium" },
  low: { cls: "bg-line text-ink", label: "Low" },
};

export function AlertList({ alerts }: { alerts: RiskAlert[] }) {
  if (!alerts.length) return <p className="text-sm text-muted">No risk flags are raised right now.</p>;
  return (
    <ul className="divide-y divide-line">
      {alerts.map((a) => (
        <li key={a.id} className="flex gap-3 py-3">
          <span className={`mt-0.5 h-fit shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase ${SEV[a.severity].cls}`}>{SEV[a.severity].label}</span>
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
          <h3 className="mb-2 text-sm font-semibold">{m === "US" ? "United States (vs S&P 500)" : "Canada (vs TSX 60)"}</h3>
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
    <ul className="space-y-2.5">
      {answers.map((a) => (
        <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <Link href={`/${lens}#${a.id}`} className="text-sm hover:underline">{a.question}</Link>
          <VerdictChip size="sm" label={a.verdict.label} tone={a.verdict.tone} />
        </li>
      ))}
    </ul>
  );
}
