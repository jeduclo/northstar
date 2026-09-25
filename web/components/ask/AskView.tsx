"use client";

import { useState } from "react";
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

const EXAMPLES = [
  "How has the Bank of Canada policy rate compared with the Fed funds rate since 2020?",
  "Which Canadian sector had the best 12-month return last month?",
  "When was Canada's 10-year minus 2-year spread last negative?",
  "Compare Canadian and U.S. unemployment over the last 5 years",
  "What was headline inflation in each country in the latest month?",
  "How did Canadian energy stocks do during the 2020 recession?",
];

/** Canada-like columns get reds, U.S.-like columns blues, each shade counted within its own country. */
function palette(cols: string[]): Record<string, string> {
  const ca = ["var(--ca)", "var(--ca-2)", "var(--ca-3)"], us = ["var(--us)", "var(--us-2)", "var(--us-3)"];
  const other = ["var(--ca)", "var(--us)", "var(--ca-2)", "var(--us-2)", "var(--ca-3)", "var(--us-3)"];
  const n = { ca: 0, us: 0, other: 0 };
  return Object.fromEntries(cols.map((c) => {
    if (/^(ca|canad)/i.test(c)) return [c, ca[n.ca++ % 3]];
    if (/^(us|u_s|united)/i.test(c)) return [c, us[n.us++ % 3]];
    return [c, other[n.other++ % 6]];
  }));
}

function ResultChart({ chart, rows }: { chart: NonNullable<Result["chart"]>; rows: Record<string, unknown>[] }) {
  const y = chart.y.filter((c) => rows.some((r) => typeof r[c] === "number"));
  if (!y.length || !rows.length || chart.type === "none") return null;
  const colors = palette(y);
  const common = { data: rows, margin: { top: 4, right: 8, bottom: 0, left: -8 } };
  const axes = (
    <>
      <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" vertical={false} />
      <XAxis dataKey={chart.x} stroke="var(--muted)" fontSize={11} tickLine={false} minTickGap={24}
        tickFormatter={(v) => (typeof v === "string" && /^\d{4}-\d{2}/.test(v) ? v.slice(0, 7) : String(v))} />
      <YAxis stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} width={52} domain={["auto", "auto"]} />
      <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, fontSize: 12 }}
        labelStyle={{ color: "var(--ink)" }} />
    </>
  );
  return (
    <div className="mt-5 h-72">
      <ResponsiveContainer width="100%" height="100%">
        {chart.type === "bar" ? (
          <BarChart {...common}>{axes}{y.map((c) => <Bar key={c} dataKey={c} fill={colors[c]} isAnimationActive={false} />)}</BarChart>
        ) : (
          <LineChart {...common}>{axes}{y.map((c) => (
            <Line key={c} dataKey={c} stroke={colors[c]} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
          ))}</LineChart>
        )}
      </ResponsiveContainer>
      <p className="mt-1 flex flex-wrap gap-x-4 text-xs text-muted">
        {y.map((c) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className="h-0.5 w-4" style={{ background: colors[c] }} aria-hidden />{c}
          </span>
        ))}
      </p>
    </div>
  );
}

const cell = (v: unknown) =>
  v === null || v === undefined ? "–" : typeof v === "number" ? v.toLocaleString("en-CA", { maximumFractionDigits: 2 }) : String(v).slice(0, 40);

export default function AskView() {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function ask(q: string) {
    const text = q.trim();
    if (text.length < 3 || loading) return;
    setQuestion(text); setAsked(text); setLoading(true); setResult(null);
    try {
      const res = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: text }) });
      setResult((await res.json()) as Result);
    } catch {
      setResult({ error: "Couldn't reach the assistant. Check your connection and try again." });
    } finally {
      setLoading(false);
    }
  }

  const rows = result?.rows ?? [];
  const columns = result?.columns ?? [];

  return (
    <>
      <form className="mt-6 flex flex-col gap-3 sm:flex-row" onSubmit={(e) => { e.preventDefault(); ask(question); }}>
        <label htmlFor="q" className="sr-only">Your question</label>
        <input id="q" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500}
          placeholder="e.g. How has Canadian inflation compared with U.S. inflation since 2021?"
          className="flex-1 rounded-md border border-line bg-surface px-4 py-2.5 text-base placeholder:text-muted" />
        <button type="submit" disabled={loading || question.trim().length < 3}
          className="rounded-md bg-ink px-5 py-2.5 font-medium text-surface disabled:opacity-50">
          {loading ? "Working…" : "Ask"}
        </button>
      </form>

      {!result && !loading && (
        <ul className="mt-5 flex flex-wrap gap-2 text-sm">
          {EXAMPLES.map((e) => (
            <li key={e}>
              <button onClick={() => ask(e)} className="rounded-full border border-line bg-surface px-3 py-1.5 text-left text-muted hover:text-ink">{e}</button>
            </li>
          ))}
        </ul>
      )}

      {loading && <p className="mt-8 text-sm text-muted" role="status">Writing and running a query for “{asked}”…</p>}

      {result && (
        <section className="mt-8 rounded-lg border border-line bg-surface p-5" aria-live="polite">
          <p className="text-xs text-muted">{asked}</p>
          {result.error ? (
            <p className="mt-2 text-down">{result.error}</p>
          ) : (
            <>
              <p className="mt-2 max-w-3xl font-serif text-xl leading-snug">{result.answer}</p>
              {result.chart && <ResultChart chart={result.chart} rows={rows} />}
              {rows.length > 0 && (
                <div className="mt-5 max-h-80 overflow-auto rounded border border-line">
                  <table className="w-full text-left text-xs tabular-nums">
                    <thead className="sticky top-0 bg-surface">
                      <tr>{columns.map((c) => <th key={c} className="border-b border-line px-3 py-2 font-medium">{c}</th>)}</tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 200).map((r, i) => (
                        <tr key={i} className="border-b border-line/60">
                          {columns.map((c) => <td key={c} className="px-3 py-1.5 whitespace-nowrap">{cell(r[c])}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {rows.length > 200 && <p className="mt-2 text-xs text-muted">Showing 200 of {rows.length} rows.</p>}
              {result.sql && (
                <details className="mt-4 text-sm">
                  <summary className="cursor-pointer text-muted hover:text-ink">How this was answered</summary>
                  <p className="mt-2 text-muted">{result.explanation}</p>
                  <pre className="mt-2 overflow-x-auto rounded bg-canvas p-3 text-xs"><code>{result.sql}</code></pre>
                </details>
              )}
            </>
          )}
          <button onClick={() => { setResult(null); setQuestion(""); }} className="mt-5 text-sm text-muted underline hover:text-ink">
            Ask something else
          </button>
        </section>
      )}
    </>
  );
}
