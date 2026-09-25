import path from "node:path";
import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";

const PARQUET_DIR = path.join(process.cwd(), "public", "data", "parquet");
export const TABLES = ["tab_series", "rotation", "recessions", "fx_oil", "catalog"] as const;
export const MAX_ROWS = 1000;

let connPromise: Promise<DuckDBConnection> | null = null;

/** In-memory DuckDB with the dashboard tables loaded, then locked: no file, network or config access. */
export function getConnection(): Promise<DuckDBConnection> {
  connPromise ??= (async () => {
    const instance = await DuckDBInstance.create(":memory:");
    const conn = await instance.connect();
    for (const t of TABLES) {
      const file = path.join(PARQUET_DIR, `${t}.parquet`).replaceAll("\\", "/");
      await conn.run(`CREATE TABLE ${t} AS SELECT * FROM read_parquet('${file}')`);
    }
    await conn.run("SET threads = 2");
    await conn.run("SET memory_limit = '256MB'");
    await conn.run("SET enable_external_access = false");
    await conn.run("SET lock_configuration = true");
    return conn;
  })().catch((e) => {
    connPromise = null;
    throw e;
  });
  return connPromise;
}

const FORBIDDEN = /\b(attach|detach|copy|install|load|pragma|set|reset|create|insert|update|delete|drop|alter|export|import|call|checkpoint|vacuum|getenv|read_\w+|glob|httpfs)\b/i;

/** Single read-only SELECT/WITH statement, or an explanation of why not. */
export function validateSql(raw: string): { ok: true; sql: string } | { ok: false; reason: string } {
  const sql = raw.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").trim().replace(/;+\s*$/, "");
  if (!sql) return { ok: false, reason: "Empty query." };
  if (sql.includes(";")) return { ok: false, reason: "Only one statement is allowed." };
  if (!/^(select|with)\b/i.test(sql)) return { ok: false, reason: "Only SELECT queries are allowed." };
  const bad = sql.match(FORBIDDEN);
  if (bad) return { ok: false, reason: `The keyword "${bad[0]}" is not allowed.` };
  return { ok: true, sql };
}

export async function runQuery(sql: string) {
  const conn = await getConnection();
  const reader = await conn.runAndReadAll(`SELECT * FROM (${sql}) AS q LIMIT ${MAX_ROWS}`);
  const columns = reader.columnNames();
  const rows = reader.getRowObjectsJson() as Record<string, unknown>[];
  // Numeric strings (BIGINT/DECIMAL from JSON conversion) -> numbers for charting
  for (const r of rows) {
    for (const c of columns) {
      const v = r[c];
      if (typeof v === "string" && v !== "" && /^-?\d+(\.\d+)?(e-?\d+)?$/i.test(v)) r[c] = Number(v);
    }
  }
  return { columns, rows };
}

/** Compact data dictionary for the prompt, built from the live data. */
export async function describeData(): Promise<string> {
  const conn = await getConnection();
  const series = (await conn.runAndReadAll(`
    SELECT name, country, tab, description, display_unit, frequency,
           strftime(min(date), '%Y-%m') AS first, strftime(max(date), '%Y-%m') AS last
    FROM tab_series GROUP BY ALL ORDER BY tab, name`)).getRowObjectsJson() as Record<string, string>[];
  const sectors = (await conn.runAndReadAll(`
    SELECT market, string_agg(DISTINCT sector || ' (' || ticker || ')', ', ') AS s
    FROM rotation GROUP BY market ORDER BY market`)).getRowObjectsJson() as Record<string, string>[];
  const lines = series.map((s) =>
    `${s.name} | ${s.country} | ${s.tab} | ${s.description} | ${s.display_unit} | ${s.frequency} | ${s.first}..${s.last}`);
  return [
    "tab_series series (name | country | tab | description | unit of `value` | frequency | coverage):",
    ...lines,
    "",
    ...sectors.map((r) => `rotation ${r.market} sectors: ${r.s}`),
  ].join("\n");
}
