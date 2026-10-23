import { db } from "./db";

export interface Rule {
  /** Counter name, e.g. "ask". */
  name: string;
  limit: number;
  windowSec: number;
  /** "ip" counts per client IP; "global" counts every caller together. */
  scope: "ip" | "global";
}

/** Start of the fixed window containing `nowMs`, in ms. */
export function windowStart(nowMs: number, windowSec: number): number {
  const size = windowSec * 1000;
  return Math.floor(nowMs / size) * size;
}

/**
 * Fixed-window counters in Postgres, so every serverless instance shares
 * them. Each call counts against all rules; returns the first rule that is
 * over its limit, or null. The demo uses free or capped API quotas, so
 * this is what keeps one script from burning them for everyone.
 */
export async function hitLimit(ip: string, rules: Rule[]): Promise<Rule | null> {
  const q = await db();
  const now = Date.now();
  for (const rule of rules) {
    const key = rule.scope === "ip" ? `${rule.name}:${ip}` : `${rule.name}:*`;
    const [{ count }] = await q<{ count: number }[]>`
      INSERT INTO rate_limits (key, window_start, count)
      VALUES (${key}, ${windowStart(now, rule.windowSec)}, 1)
      ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
      RETURNING count`;
    if (count > rule.limit) return rule;
  }
  // Old windows are useless; sweep them now and then.
  if (Math.random() < 0.02) {
    await q`DELETE FROM rate_limits WHERE window_start < ${now - 2 * 86_400_000}`;
  }
  return null;
}
