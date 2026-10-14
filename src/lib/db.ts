import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DB_PATH =
  process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "research.db");

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

export function countRuns(): number {
  const row = db.prepare("SELECT COUNT(*) AS n FROM runs").get() as {
    n: number;
  };
  return row.n;
}
