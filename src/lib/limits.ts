import type { Rule } from "./rate-limit";

// Budgets for the public demo. A run costs up to 3 searches and one
// page-extract call on the search API (Tavily's free tier is 1,000
// credits a month), plus 3-4 model calls. The global cap is what keeps
// the monthly search quota from running out; raise it on a paid plan.
export const RUN_LIMITS: Rule[] = [
  { name: "run", limit: 5, windowSec: 600, scope: "ip" },
  { name: "run", limit: 15, windowSec: 86_400, scope: "ip" },
  { name: "run", limit: 25, windowSec: 86_400, scope: "global" },
];
