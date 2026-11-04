/**
 * Generates public/data/briefings.json: an executive summary, four persona briefings, sector calls and risk alerts.
 *
 * The facts come from the same question engine the website renders (lib/intel), so the AI only interprets numbers
 * the site already shows. Provider is chosen by environment:
 *   ANTHROPIC_API_KEY  -> Claude  (model: BRIEFING_MODEL, default claude-sonnet-5-5)
 *   GEMINI_API_KEY     -> Gemini  (model: BRIEFING_MODEL, default gemini-2.5-flash)
 *   neither            -> rules-based briefing (no AI), so the site always has content
 * Set LLM_PROVIDER=anthropic|gemini|rules to force one. The script never fails the refresh: any error falls back to rules.
 *
 * Run from web/:  npm run briefings
 */
import fs from "node:fs";
import path from "node:path";
import { LENSES, allAnswers, answersFor, baselineSectors, cycle, riskAlerts } from "@/lib/intel";
import { manifest } from "@/lib/data";
import type { Answer, Briefings, Call, LensId, PersonaBriefing, RiskAlert, SectorCall } from "@/lib/intel-types";

const OUT = path.join(process.cwd(), "public", "data", "briefings.json");

type Provider = "anthropic" | "gemini" | "rules";
const provider: Provider = (process.env.LLM_PROVIDER as Provider)
  || (process.env.ANTHROPIC_API_KEY ? "anthropic" : process.env.GEMINI_API_KEY ? "gemini" : "rules");
const MODEL = process.env.BRIEFING_MODEL || (provider === "gemini" ? "gemini-2.5-flash" : "claude-sonnet-5-5");

// ---------- facts ----------

const compact = (a: Answer) => ({
  id: a.id, question: a.question, verdict: a.verdict.label, summary: a.summary,
  metrics: a.metrics.map((m) => `${m.label}: ${m.value}${m.note ? ` (${m.note})` : ""}`), as_of: a.asOf,
});

const cyc = cycle();
const alerts = riskAlerts();
const baseline = baselineSectors();
const facts = {
  data_refreshed: manifest.generated_at,
  business_cycle: cyc.map((c) => ({ country: c.country, phase: c.phase, cli_minus_100: c.level, cli_3m_change: c.momentum, as_of: c.asOf })),
  rule_based_alerts: alerts,
  questions: Object.fromEntries(LENSES.map((l) => [l.id, answersFor(l.id).map(compact)])),
};

// ---------- LLM ----------

async function callLLM(system: string, user: string): Promise<string> {
  if (provider === "anthropic") {
    const res = await fetch(`${process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com"}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 2500, system, messages: [{ role: "user", content: user }] }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as { content: { type: string; text?: string }[] };
    return data.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 4000, temperature: 0.4 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
}

function parseJson<T>(text: string): T {
  const t = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  return JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)) as T;
}

async function ask<T>(system: string, user: string, check: (v: T) => boolean): Promise<T | null> {
  if (provider === "rules") return null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const v = parseJson<T>(await callLLM(system, user));
      if (check(v)) return v;
      console.warn(`  attempt ${attempt}: response failed validation`);
    } catch (e) {
      console.warn(`  attempt ${attempt}: ${e instanceof Error ? e.message : e}`);
    }
  }
  return null;
}

const RULES = `Rules:
- Use only numbers that appear in the data provided. Never invent figures, dates or forecasts.
- Canadian spelling. Plain language. No hype, no exclamation marks.
- This is general information, not personalized financial advice; never tell a specific person to buy or sell.
- Reply with a single JSON object and nothing else.`;

const PERSONA_SYSTEM: Record<LensId, string> = {
  household: "Act as a personal finance journalist writing for Canadian households. Explain how this week's data affects the cost of living, mortgages, debt and job security, in everyday language without jargon.",
  investor: "Act as a quantitative macro-strategist. Interpret the risk regime, business-cycle position and sector momentum for portfolio positioning across Canadian and U.S. equities.",
  policy: "Act as a central bank analyst. Evaluate structural economic shifts, policy divergence between the Bank of Canada and the Federal Reserve, and whether current policy tools fit the problem.",
  student: "Act as an economics professor. Connect this data to standard macroeconomic theory, defining each key term the first time you use it, as you would for a first-year undergraduate.",
};

// ---------- rules fallback ----------

function rulesPersona(): PersonaBriefing {
  // The page shows each question's verdict as an "at a glance" list when no AI briefing exists.
  return { headline: "", bullets: [], notes: {} };
}

function rulesExecutive(): string {
  const ca = cyc.find((c) => c.country === "CA"), us = cyc.find((c) => c.country === "US");
  const pick = (id: string) => allAnswers().find((a) => a.id === id);
  const drivers = pick("inflation-drivers"), div = pick("divergence"), rec = pick("recession");
  const parts = [
    ca && us ? `Leading indicators place Canada in the ${ca.phase.toLowerCase()} and the U.S. in the ${us.phase.toLowerCase()}.` : "",
    drivers ? `Inflation: ${drivers.verdict.label.toLowerCase()}. ${drivers.summary.split(/(?<=\.)\s/)[0]}` : "",
    div ? `Policy: ${div.verdict.label.toLowerCase()} between the Bank of Canada and the Fed.` : "",
    rec ? `Recession risk: ${rec.verdict.label.toLowerCase()}.` : "",
    alerts[0] ? `Top risk: ${alerts[0].title.toLowerCase()}.` : "",
  ];
  return parts.filter(Boolean).join(" ");
}

// ---------- main ----------

async function main() {
  console.log(`Briefings via ${provider}${provider === "rules" ? "" : ` (${MODEL})`}`);
  const data = JSON.stringify(facts);
  const lensIds = LENSES.map((l) => l.id);

  const overview = await ask<{ executive_summary: string; alerts: RiskAlert[] }>(
    `You are the chief economist of an independent Canada–U.S. economic intelligence service. ${RULES}`,
    `Data (JSON):\n${data}\n\nWrite:\n1. "executive_summary": one paragraph of 90–130 words summarizing the most important macro shifts in Canada and the U.S. right now and what they mean.\n`
      + `2. "alerts": 3–6 risk alerts, most severe first. Start from rule_based_alerts (keep their ids); you may rephrase details, drop weak ones, or add up to two new ones that combine signals (e.g. "copper falling while yields rise suggests stagflation risk"), each with a new short kebab-case id. `
      + `Each: {"id","severity":"high"|"medium"|"low","title" (≤8 words),"detail" (≤40 words, cite numbers)}.\n`
      + `Return {"executive_summary": string, "alerts": [...]}.`,
    (v) => typeof v.executive_summary === "string" && v.executive_summary.length > 40 && Array.isArray(v.alerts)
      && v.alerts.every((a) => a.id && a.title && a.detail && ["high", "medium", "low"].includes(a.severity)),
  );

  const personas = {} as Record<LensId, PersonaBriefing>;
  let sectors: SectorCall[] = baseline;
  for (const lens of lensIds) {
    console.log(`  persona: ${lens}`);
    const qs = answersFor(lens);
    const investorExtra = lens === "investor"
      ? `\n4. "sectors": review this rules-based sector table (cycle tilt + 3/6-month relative strength):\n${JSON.stringify(baseline.map(({ market, sector, call, momentum3m, momentum6m }) => ({ market, sector, call, momentum3m, momentum6m })))}\n`
        + `Return one entry for EVERY row: {"market","sector","call":"Overweight"|"Market weight"|"Underweight","rationale" (≤25 words, cite the macro reason)}. Change a call only with a clear macro reason.`
      : "";
    const res = await ask<{ headline: string; bullets: string[]; notes: Record<string, string>; sectors?: { market: string; sector: string; call: Call; rationale: string }[] }>(
      `${PERSONA_SYSTEM[lens]} ${RULES}`,
      `Data (JSON):\n${data}\n\nYour audience is the "${lens}" lens. Its questions are:\n${JSON.stringify(qs.map(compact))}\n\nWrite:\n`
        + `1. "headline": one sentence (≤20 words) answering what matters most for this audience right now.\n`
        + `2. "bullets": exactly 3 bullets (≤35 words each).\n`
        + `3. "notes": an object keyed by question id (${qs.map((q) => q.id).join(", ")}), each 40–80 words: ${lens === "student" ? "a tutor's explanation of the concept using this week's exact numbers" : "your interpretation of what the answer means and what to watch next"}.`
        + investorExtra,
      (v) => typeof v.headline === "string" && Array.isArray(v.bullets) && v.bullets.length >= 2 && typeof v.notes === "object"
        && (lens !== "investor" || (Array.isArray(v.sectors) && v.sectors.length >= baseline.length * 0.8)),
    );
    if (res) {
      personas[lens] = { headline: res.headline, bullets: res.bullets.slice(0, 3), notes: Object.fromEntries(Object.entries(res.notes).filter(([k, v]) => qs.some((q) => q.id === k) && typeof v === "string")) };
      if (lens === "investor" && res.sectors) {
        sectors = baseline.map((b) => {
          const r = res.sectors!.find((s) => s.market === b.market && s.sector === b.sector);
          return r && ["Overweight", "Market weight", "Underweight"].includes(r.call) ? { ...b, call: r.call, rationale: r.rationale || b.rationale } : b;
        });
      }
    } else {
      personas[lens] = rulesPersona();
    }
  }

  const anyAI = !!overview || lensIds.some((l) => Object.keys(personas[l].notes).length > 0);
  const out: Briefings = {
    generated_at: new Date().toISOString(),
    generated_by: anyAI ? MODEL : "rules",
    data_as_of: manifest.generated_at,
    executive_summary: overview?.executive_summary ?? rulesExecutive(),
    personas,
    sectors,
    alerts: overview?.alerts?.slice(0, 6) ?? alerts,
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(`Wrote ${OUT} (${out.generated_by})`);
}

main().catch((e) => {
  console.error("Briefing generation failed; keeping previous file.", e);
  process.exit(0);
});
