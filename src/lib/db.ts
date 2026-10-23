import postgres from "postgres";

// Postgres (Neon in production). One shared database, so every serverless
// instance sees the same runs.
function createSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Add it to .env.");
  // prepare: false - Neon's pooled endpoint (PgBouncer) can't keep
  // prepared statements across transactions.
  return postgres(url, { prepare: false, max: 5, onnotice: () => {} });
}

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

-- Runs belong to an anonymous visitor (see lib/visitor.ts). Runs from
-- before this column existed stay NULL: no one sees them, the purge
-- removes them.
ALTER TABLE runs ADD COLUMN IF NOT EXISTS visitor_id TEXT;
CREATE INDEX IF NOT EXISTS idx_runs_visitor ON runs(visitor_id);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT NOT NULL,
  window_start BIGINT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (key, window_start)
);
`;

// Demo data is kept for RETENTION_DAYS, then purged.
export const RETENTION_DAYS = 30;

async function purge(sql: postgres.Sql): Promise<void> {
  // Timestamps are ISO strings, which sort like dates.
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
  await sql`DELETE FROM runs WHERE created_at < ${cutoff} OR visitor_id IS NULL`;
}

const globalForDb = globalThis as unknown as {
  __rtbSql?: postgres.Sql;
  __rtbSchema?: Promise<void>;
};

/** The database, with tables created on first use in this process. */
export async function db(): Promise<postgres.Sql> {
  const sql = (globalForDb.__rtbSql ??= createSql());
  // Purge runs once per process start, which on serverless is often enough.
  globalForDb.__rtbSchema ??= sql
    .unsafe(SCHEMA)
    .then(() => purge(sql))
    .then(() => undefined)
    .catch((error) => {
      globalForDb.__rtbSchema = undefined; // retry on the next request
      throw error;
    });
  await globalForDb.__rtbSchema;
  return sql;
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

// A run's function is killed at maxDuration (300s) without a chance to
// record it, so a run still "running" well past that is reported as failed.
const STALE_MS = 6 * 60 * 1000;

function withStaleCheck(run: RunRow): RunRow {
  if (run.status !== "running") return run;
  if (Date.now() - Date.parse(run.created_at) < STALE_MS) return run;
  return { ...run, status: "failed", error: run.error ?? "timed out" };
}

export async function listRuns(visitor: string): Promise<RunRow[]> {
  const sql = await db();
  const rows = await sql<RunRow[]>`
    SELECT * FROM runs WHERE visitor_id = ${visitor} ORDER BY created_at DESC`;
  return rows.map(withStaleCheck);
}

export async function getRun(visitor: string, id: string): Promise<RunRow | undefined> {
  const sql = await db();
  const [row] = await sql<RunRow[]>`
    SELECT * FROM runs WHERE id = ${id} AND visitor_id = ${visitor}`;
  return row && withStaleCheck(row);
}

export async function deleteRun(visitor: string, id: string): Promise<void> {
  const sql = await db();
  await sql`DELETE FROM runs WHERE id = ${id} AND visitor_id = ${visitor}`;
}

export async function seedSampleRun(visitor: string, input: {
  question: string;
  maxSteps: number;
  blocklist: string;
  plan: string;
  steps: string;
  brief: string;
  cited: string;
  model: string | null;
}): Promise<string> {
  const id = crypto.randomUUID();
  const sql = await db();
  await sql.begin(async (tx) => {
    await tx`DELETE FROM runs WHERE question = ${input.question} AND visitor_id = ${visitor}`;
    await tx`INSERT INTO runs ${tx({
      id,
      visitor_id: visitor,
      question: input.question,
      status: "done",
      max_steps: input.maxSteps,
      blocklist: input.blocklist,
      plan: input.plan,
      steps: input.steps,
      brief: input.brief,
      cited: input.cited,
      model: input.model,
      created_at: new Date().toISOString(),
    })}`;
  });
  return id;
}

export async function countRuns(visitor: string): Promise<number> {
  const sql = await db();
  const [{ n }] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM runs WHERE visitor_id = ${visitor}`;
  return n;
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

export async function createRun(visitor: string, input: {
  question: string;
  maxSteps: number;
  blocklist: string[];
}): Promise<string> {
  const id = crypto.randomUUID();
  const sql = await db();
  await sql`INSERT INTO runs ${sql({
    id,
    visitor_id: visitor,
    question: input.question,
    status: "running",
    max_steps: input.maxSteps,
    blocklist: JSON.stringify(input.blocklist),
    created_at: new Date().toISOString(),
  })}`;
  return id;
}

export async function finishRun(
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
): Promise<void> {
  const sql = await db();
  await sql`UPDATE runs SET ${sql({
    status: patch.status,
    plan: JSON.stringify(patch.plan),
    steps: JSON.stringify(patch.steps),
    brief: patch.brief,
    cited: JSON.stringify(patch.cited),
    model: patch.model,
    latency_ms: patch.latencyMs,
    error: patch.error ?? null,
  })} WHERE id = ${id}`;
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
