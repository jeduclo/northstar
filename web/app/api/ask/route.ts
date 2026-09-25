import { NextResponse } from "next/server";
import { describeData, runQuery, validateSql } from "@/lib/server/sql";
import { answerPrompt, systemPrompt } from "@/lib/server/prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_URL = `${process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com"}/v1/messages`;
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";

// Simple per-instance rate limit: 8 questions per minute per IP
const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 8;
}

type Msg = { role: "user" | "assistant"; content: string };

async function claude(system: string, messages: Msg[], maxTokens = 1024): Promise<string> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages }),
  });
  if (!res.ok) throw new Error(`Model request failed (${res.status})`);
  const data = (await res.json()) as { content: { type: string; text?: string }[] };
  return data.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
}

interface Plan { sql: string | null; explanation: string; chart?: { type: string; x: string; y: string[] } }

function parsePlan(text: string): Plan {
  const json = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = json.indexOf("{"), end = json.lastIndexOf("}");
  return JSON.parse(json.slice(start, end + 1)) as Plan;
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "The assistant is not configured: set ANTHROPIC_API_KEY." }, { status: 503 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (limited(ip)) return NextResponse.json({ error: "Too many questions. Wait a minute and try again." }, { status: 429 });

  const body = (await req.json().catch(() => ({}))) as { question?: unknown };
  const question = typeof body.question === "string" ? body.question.trim().slice(0, 500) : "";
  if (question.length < 3) return NextResponse.json({ error: "Type a question first." }, { status: 400 });

  try {
    const system = systemPrompt(await describeData());
    const messages: Msg[] = [{ role: "user", content: question }];

    // Up to two attempts: if the SQL fails, send the error back once
    for (let attempt = 0; attempt < 2; attempt++) {
      const text = await claude(system, messages);
      let plan: Plan;
      try {
        plan = parsePlan(text);
      } catch {
        messages.push({ role: "assistant", content: text }, { role: "user", content: "Reply with the JSON object only." });
        continue;
      }
      if (!plan.sql) return NextResponse.json({ answer: plan.explanation, sql: null, columns: [], rows: [] });

      const check = validateSql(plan.sql);
      let error = check.ok ? null : check.reason;
      if (check.ok) {
        try {
          const { columns, rows } = await runQuery(check.sql);
          const sample = JSON.stringify(rows.slice(0, 40));
          const answer = rows.length
            ? await claude(answerPrompt, [{ role: "user", content: `Question: ${question}\nSQL: ${check.sql}\nRows (${rows.length} total): ${sample}` }], 300)
            : "The query ran but returned no rows. Try a different date range or series.";
          return NextResponse.json({ answer, explanation: plan.explanation, sql: check.sql, chart: plan.chart ?? null, columns, rows });
        } catch (e) {
          error = e instanceof Error ? e.message.split("\n")[0] : "Query failed.";
        }
      }
      messages.push(
        { role: "assistant", content: text },
        { role: "user", content: `That query failed: ${error}. Fix it and reply with the JSON object only.` },
      );
    }
    return NextResponse.json({ error: "Couldn't write a working query for that. Try rephrasing, or name the series." }, { status: 422 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "The assistant is unavailable right now. Try again shortly." }, { status: 502 });
  }
}
