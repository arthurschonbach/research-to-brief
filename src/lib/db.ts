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
`;

const globalForDb = globalThis as unknown as {
  __rtbSql?: postgres.Sql;
  __rtbSchema?: Promise<void>;
};

/** The database, with tables created on first use in this process. */
async function db(): Promise<postgres.Sql> {
  const sql = (globalForDb.__rtbSql ??= createSql());
  globalForDb.__rtbSchema ??= sql
    .unsafe(SCHEMA)
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

export async function listRuns(): Promise<RunRow[]> {
  const sql = await db();
  const rows = await sql<RunRow[]>`SELECT * FROM runs ORDER BY created_at DESC`;
  return rows.map(withStaleCheck);
}

export async function getRun(id: string): Promise<RunRow | undefined> {
  const sql = await db();
  const [row] = await sql<RunRow[]>`SELECT * FROM runs WHERE id = ${id}`;
  return row && withStaleCheck(row);
}

export async function deleteRun(id: string): Promise<void> {
  const sql = await db();
  await sql`DELETE FROM runs WHERE id = ${id}`;
}

export async function seedSampleRun(input: {
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
    await tx`DELETE FROM runs WHERE question = ${input.question}`;
    await tx`INSERT INTO runs ${tx({
      id,
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

export async function countRuns(): Promise<number> {
  const sql = await db();
  const [{ n }] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM runs`;
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

export async function createRun(input: {
  question: string;
  maxSteps: number;
  blocklist: string[];
}): Promise<string> {
  const id = crypto.randomUUID();
  const sql = await db();
  await sql`INSERT INTO runs ${sql({
    id,
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
