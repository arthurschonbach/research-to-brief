import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { abortRun } from "./run-registry";

const DB_PATH =
  process.env.DATABASE_PATH ??
  // Vercel's filesystem is read-only except /tmp. Data there is ephemeral
  // (per-invocation), which is fine for a demo — documented in README.
  (process.env.VERCEL
    ? path.join("/tmp", "research.db")
    : path.join(process.cwd(), "data", "research.db"));

const SCHEMA = `
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  max_steps INTEGER NOT NULL DEFAULT 8,
  blocklist TEXT NOT NULL DEFAULT '[]',
  plan TEXT NOT NULL DEFAULT '[]',
  steps TEXT NOT NULL DEFAULT '[]',
  brief TEXT NOT NULL DEFAULT '',
  cited TEXT NOT NULL DEFAULT '[]',
  model TEXT,
  latency_ms INTEGER,
  error TEXT,
  created_at TEXT NOT NULL
);
`;

function createDb(): Database.Database {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const instance = new Database(DB_PATH);
  instance.pragma("journal_mode = WAL");
  instance.pragma("foreign_keys = ON");
  instance.exec(SCHEMA);
  return instance;
}

const globalForDb = globalThis as unknown as { __rtbDb?: Database.Database };
const db = globalForDb.__rtbDb ?? (globalForDb.__rtbDb = createDb());

export function getDb(): Database.Database {
  return db;
}

export type RunStatus = "running" | "done" | "stopped" | "failed";

export interface RunRow {
  id: string;
  question: string;
  status: RunStatus;
  max_steps: number;
  blocklist: string;
  plan: string;
  steps: string;
  brief: string;
  cited: string;
  model: string | null;
  latency_ms: number | null;
  error: string | null;
  created_at: string;
}

export function listRuns(): RunRow[] {
  return db
    .prepare("SELECT * FROM runs ORDER BY created_at DESC")
    .all() as RunRow[];
}

export function getRun(id: string): RunRow | undefined {
  return db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as
    | RunRow
    | undefined;
}

export function deleteRun(id: string): void {
  abortRun(id);
  db.prepare("DELETE FROM runs WHERE id = ?").run(id);
}

export function seedSampleRun(input: {
  question: string;
  maxSteps: number;
  blocklist: string;
  plan: string;
  steps: string;
  brief: string;
  cited: string;
  model: string | null;
}): string {
  db.prepare("DELETE FROM runs WHERE question = ?").run(input.question);
  const id = crypto.randomUUID();
  db.prepare(
    "INSERT INTO runs (id, question, status, max_steps, blocklist, plan, steps, brief, cited, model, latency_ms, error, created_at) VALUES (?, ?, 'done', ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)",
  ).run(
    id,
    input.question,
    input.maxSteps,
    input.blocklist,
    input.plan,
    input.steps,
    input.brief,
    input.cited,
    input.model,
    new Date().toISOString(),
  );
  return id;
}

export function countRuns(): number {
  const row = db.prepare("SELECT COUNT(*) AS n FROM runs").get() as {
    n: number;
  };
  return row.n;
}

export interface TraceStep {
  n: number;
  kind: "plan" | "search" | "fetch" | "skip-blocked" | "skip-repeat" | "warning" | "answer";
  label: string;
  detail: string;
}

export interface CitedSource {
  n: number;
  url: string;
  title: string;
  excerpt: string;
}

export function createRun(input: {
  question: string;
  maxSteps: number;
  blocklist: string[];
}): string {
  const id = crypto.randomUUID();
  db.prepare(
    "INSERT INTO runs (id, question, status, max_steps, blocklist, plan, steps, brief, cited, model, latency_ms, error, created_at) VALUES (?, ?, 'running', ?, ?, '[]', '[]', '', '[]', NULL, NULL, NULL, ?)",
  ).run(id, input.question, input.maxSteps, JSON.stringify(input.blocklist), new Date().toISOString());
  return id;
}

export function finishRun(
  id: string,
  patch: {
    status: RunStatus;
    plan: string[];
    steps: TraceStep[];
    brief: string;
    cited: CitedSource[];
    model: string | null;
    latencyMs: number;
    error?: string | null;
  },
): void {
  db.prepare(
    "UPDATE runs SET status = ?, plan = ?, steps = ?, brief = ?, cited = ?, model = ?, latency_ms = ?, error = ? WHERE id = ?",
  ).run(
    patch.status,
    JSON.stringify(patch.plan),
    JSON.stringify(patch.steps),
    patch.brief,
    JSON.stringify(patch.cited),
    patch.model,
    patch.latencyMs,
    patch.error ?? null,
    id,
  );
}

export function parseSteps(value: string): TraceStep[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as TraceStep[]) : [];
  } catch {
    return [];
  }
}

export function parseCited(value: string): CitedSource[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as CitedSource[]) : [];
  } catch {
    return [];
  }
}
