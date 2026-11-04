"use client";

import { useRef, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

interface Result {
  answer?: string;
  explanation?: string;
  sql?: string | null;
  chart?: { type: string; x: string; y: string[] } | null;
  columns?: string[];
  rows?: Record<string, unknown>[];
  error?: string;
}

const LENSES = [
  { id: "general", label: "General" },
  { id: "household", label: "Household" },
  { id: "investor", label: "Investor" },
  { id: "policy", label: "Policy analyst" },
  { id: "student", label: "Student" },
];

const EXAMPLES: { theme: string; items: string[] }[] = [
  { theme: "Rates and bonds", items: [
    "How has the Bank of Canada policy rate compared with the Fed funds rate since 2020?",
    "When was Canada's 10-year minus 2-year spread last negative?",
  ] },
  { theme: "Prices and jobs", items: [
    "What was headline inflation in each country in the latest month?",
    "Compare Canadian and U.S. unemployment over the last 5 years",
  ] },
  { theme: "Markets and sectors", items: [
    "Which Canadian sector had the best 12-month return last month?",
    "How did Canadian energy stocks do during the 2020 recession?",
  ] },
];

/** Canada-like columns get the Canada colour, U.S.-like columns the U.S. colour; others take the remaining chart slots. */
function palette(cols: string[]): Record<string, string> {
  const ca = ["var(--c-ca)", "var(--ca-3)", "var(--ca-2)"], us = ["var(--c-us)", "var(--us-3)", "var(--us-2)"];
  const other = ["var(--c-3)", "var(--c-4)", "var(--c-5)", "var(--c-ca)", "var(--c-us)"];
  const n = { ca: 0, us: 0, other: 0 };
  return Object.fromEntries(cols.map((c) => {
    if (/^(ca|canad)/i.test(c)) return [c, ca[n.ca++ % 3]];
    if (/^(us|u_s|united)/i.test(c)) return [c, us[n.us++ % 3]];
    return [c, other[n.other++ % other.length]];
  }));
}

const pretty = (c: string) =>
  c.replace(/_/g, " ").replace(/\bus\b/gi, "U.S.").replace(/\bca\b/gi, "Canada").replace(/^./, (x) => x.toUpperCase());

function ResultChart({ chart, rows }: { chart: NonNullable<Result["chart"]>; rows: Record<string, unknown>[] }) {
  const y = chart.y.filter((c) => rows.some((r) => typeof r[c] === "number"));
  if (!y.length || !rows.length || chart.type === "none") return null;
  const colors = palette(y);
  const common = { data: rows, margin: { top: 8, right: 8, bottom: 0, left: -8 } };
  const axes = (
    <>
      <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" vertical={false} />
      <XAxis dataKey={chart.x} stroke="var(--muted)" fontSize={11} tickLine={false} minTickGap={28}
        tickFormatter={(v) => (typeof v === "string" && /^\d{4}-\d{2}/.test(v) ? v.slice(0, 7) : String(v))} />
      <YAxis stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} width={52} domain={["auto", "auto"]} />
      <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12, color: "var(--ink)" }}
        labelStyle={{ color: "var(--ink)", fontWeight: 500 }} formatter={(v, k) => [typeof v === "number" ? v.toLocaleString("en-CA", { maximumFractionDigits: 2 }) : String(v), pretty(String(k))]} />
    </>
  );
  return (
    <div>
      {y.length > 1 && (
        <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
          {y.map((c) => (
            <li key={c} className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded" style={{ background: colors[c] }} aria-hidden />{pretty(c)}
            </li>
          ))}
        </ul>
      )}
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          {chart.type === "bar" ? (
            <BarChart {...common}>{axes}{y.map((c) => <Bar key={c} dataKey={c} fill={colors[c]} radius={[3, 3, 0, 0]} isAnimationActive={false} />)}</BarChart>
          ) : (
            <LineChart {...common}>{axes}{y.map((c) => (
              <Line key={c} dataKey={c} stroke={colors[c]} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
            ))}</LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const cell = (v: unknown) =>
  v === null || v === undefined ? "–" : typeof v === "number" ? v.toLocaleString("en-CA", { maximumFractionDigits: 2 }) : String(v).slice(0, 40);

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type Tab = "chart" | "data" | "query";

export default function AskView({ initialLens }: { initialLens?: string }) {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState("");
  const [askedLens, setAskedLens] = useState("general");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [tab, setTab] = useState<Tab>("chart");
  const [history, setHistory] = useState<string[]>([]);
  const [lens, setLens] = useState(LENSES.some((x) => x.id === initialLens) ? initialLens! : "general");
  const box = useRef<HTMLTextAreaElement>(null);

  async function ask(q: string) {
    const text = q.trim();
    if (text.length < 3 || loading) return;
    setQuestion(text); setAsked(text); setAskedLens(lens); setLoading(true); setResult(null);
    setHistory((h) => [text, ...h.filter((x) => x !== text)].slice(0, 5));
    try {
      const res = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: text, lens }) });
      const r = (await res.json()) as Result;
      setResult(r);
      setTab(r.chart && r.chart.type !== "none" ? "chart" : "data");
    } catch {
      setResult({ error: "The request didn't reach the server. Check your connection, then ask again." });
    } finally {
      setLoading(false);
    }
  }

  const rows = result?.rows ?? [];
  const columns = result?.columns ?? [];
  const hasChart = !!(result?.chart && result.chart.type !== "none" && rows.length);
  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: "chart", label: "Chart", show: hasChart },
    { id: "data", label: `Data${rows.length ? ` (${rows.length} rows)` : ""}`, show: rows.length > 0 },
    { id: "query", label: "How this was answered", show: !!result?.sql },
  ];
  const lensLabel = LENSES.find((l) => l.id === askedLens)?.label;

  return (
    <div className="mt-10">
      <form
        onSubmit={(e) => { e.preventDefault(); ask(question); }}
        className="rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(27,39,51,0.04),0_12px_32px_-16px_rgba(27,39,51,0.18)] transition-colors focus-within:border-accent">
        <label htmlFor="q" className="sr-only">Your question</label>
        <textarea id="q" ref={box} rows={3} value={question} maxLength={500}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(question); } }}
          placeholder="How has Canadian inflation compared with U.S. inflation since 2021?"
          className="block w-full resize-none rounded-t-2xl bg-transparent px-6 pt-5 text-[19px] leading-relaxed placeholder:text-muted/70 focus:outline-none" />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
          <div role="radiogroup" aria-label="Write the answer for" className="flex flex-wrap items-center gap-1 rounded-full bg-panel p-1 text-[13.5px]">
            {LENSES.map((l) => (
              <button key={l.id} type="button" role="radio" aria-checked={lens === l.id} onClick={() => setLens(l.id)}
                className={`rounded-full px-3 py-1 transition-colors ${lens === l.id ? "bg-surface font-medium text-ink shadow-sm" : "text-muted hover:text-ink"}`}>
                {l.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-xs text-muted sm:inline">Press Enter to ask</span>
            <button type="submit" disabled={loading || question.trim().length < 3}
              className="flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-[15px] font-medium text-surface transition-opacity disabled:opacity-40">
              <SendIcon />{loading ? "Working" : "Ask"}
            </button>
          </div>
        </div>
      </form>

      {history.length > 1 && !loading && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Recent:</span>
          {history.slice(1).map((h) => (
            <button key={h} onClick={() => ask(h)} className="max-w-xs truncate rounded-full border border-line px-3 py-1 text-muted hover:border-accent hover:text-accent">{h}</button>
          ))}
        </div>
      )}

      {!result && !loading && (
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {EXAMPLES.map((g) => (
            <div key={g.theme}>
              <h2 className="text-sm font-semibold">{g.theme}</h2>
              <ul className="mt-3 space-y-1">
                {g.items.map((e) => (
                  <li key={e}>
                    <button onClick={() => ask(e)}
                      className="group -mx-3 flex w-[calc(100%+1.5rem)] gap-3 rounded-lg px-3 py-2.5 text-left text-[15px] leading-snug transition-colors hover:bg-panel">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent/50 group-hover:bg-accent" aria-hidden />
                      <span className="group-hover:text-accent">{e}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="mt-10 rounded-2xl border border-line p-6 sm:p-8" role="status">
          <p className="flex items-center gap-3 text-[15px] text-muted">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent/25 border-t-accent" aria-hidden />
            Finding the right series, writing a query and running it
          </p>
          <p className="mt-2 text-sm text-muted">“{asked}”</p>
          <div className="mt-6 space-y-3" aria-hidden>
            <div className="h-5 w-11/12 animate-pulse rounded bg-panel" />
            <div className="h-5 w-3/4 animate-pulse rounded bg-panel" />
            <div className="mt-6 h-48 animate-pulse rounded-xl bg-panel" />
          </div>
        </div>
      )}

      {result && (
        <article className="mt-10 rounded-2xl border border-line p-6 sm:p-8" aria-live="polite">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span>{asked}</span>
            {askedLens !== "general" && <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs text-accent">For: {lensLabel}</span>}
          </div>

          {result.error ? (
            <div className="mt-5 flex gap-3 rounded-xl border border-down/25 bg-down/[0.05] p-5">
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden className="mt-0.5 shrink-0 text-down">
                <circle cx="10" cy="10" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <path d="M10 5.5v5.5M10 13.6v.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <div>
                <p className="font-medium">{result.error}</p>
                <p className="mt-1 text-sm text-muted">Every chart and answer on the lens pages still works; this only affects custom questions.</p>
              </div>
            </div>
          ) : (
            <>
              <p className="mt-4 max-w-[68ch] font-serif text-[24px] leading-[1.45]">{result.answer}</p>

              {tabs.some((t) => t.show) && (
                <div className="mt-8">
                  <div role="tablist" aria-label="Answer details" className="flex gap-6 border-b border-line text-sm">
                    {tabs.filter((t) => t.show).map((t) => (
                      <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                        className={`-mb-px border-b-2 pb-2.5 transition-colors ${tab === t.id ? "border-accent font-medium text-ink" : "border-transparent text-muted hover:text-ink"}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <div className="pt-6">
                    {tab === "chart" && hasChart && <ResultChart chart={result.chart!} rows={rows} />}
                    {tab === "data" && rows.length > 0 && (
                      <div className="max-h-96 overflow-auto rounded-lg border border-line">
                        <table className="w-full text-left text-[13px] tabular-nums">
                          <thead className="sticky top-0 bg-panel">
                            <tr>{columns.map((c) => <th key={c} className="px-3 py-2 font-medium">{pretty(c)}</th>)}</tr>
                          </thead>
                          <tbody>
                            {rows.slice(0, 200).map((r, i) => (
                              <tr key={i} className="border-t border-line">
                                {columns.map((c) => <td key={c} className="whitespace-nowrap px-3 py-1.5">{cell(r[c])}</td>)}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {rows.length > 200 && <p className="border-t border-line px-3 py-2 text-xs text-muted">Showing 200 of {rows.length} rows.</p>}
                      </div>
                    )}
                    {tab === "query" && result.sql && (
                      <div>
                        <p className="max-w-[70ch] text-[15px] text-muted">{result.explanation}</p>
                        <pre className="mt-4 overflow-x-auto rounded-lg bg-panel p-4 text-[12.5px] leading-relaxed"><code>{result.sql}</code></pre>
                        <p className="mt-3 text-xs text-muted">The query is read-only and runs on the same data the site&apos;s charts use.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="mt-8 flex flex-wrap gap-3 border-t border-line pt-5">
            <button onClick={() => { setQuestion(""); box.current?.focus(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-surface hover:opacity-90">
              Ask a follow-up
            </button>
            <button onClick={() => { setResult(null); setQuestion(""); }} className="rounded-full border border-line px-4 py-2 text-sm hover:border-ink">
              Clear
            </button>
          </div>
        </article>
      )}
    </div>
  );
}
