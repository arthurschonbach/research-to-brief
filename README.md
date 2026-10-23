# Research → Brief

Ask a research question. The app plans web searches, reads pages, and
writes a cited brief, with the whole trace visible.

![Trace](docs/screenshots/shot-trace.png)

## Try it

1. `npm install && npm run dev` → http://localhost:3000
2. Click **Load sample run** (no API key needed), a real recorded trace.
3. Ask your own question: watch the plan → searches → fetches → brief
   stream in. Try blocking a domain to see the guardrail fire.

![New research](docs/screenshots/shot-home.png)
![History](docs/screenshots/shot-history.png)

## What it does

- **Research runs**: question in, structured brief out, every claim
  backed by a numbered source.
- **Visible trace**: plan, searches, page fetches and brief stream in
  live; skipped domains and warnings appear in the trace, never
  silently.
- **Guardrails**: fixed budgets (max 3 paid searches, up to 4 pages
  read), domain blocklist, cancel anytime with partial results saved.
- **Honest failures**: thin or unreadable pages are flagged and worked
  around; rate limits and bot-walled pages surface as warnings, never
  as invented findings.
- **History**: past runs with their traces, stored locally.
- English/French, light/dark.

## How it works

```
question ──► plan (search queries, JSON) ──► search ──► pick pages (JSON)
                                                              │
                     ┌────────────────────────────────────────┘
                     ▼
              read pages ──► brief (streamed, citations
              in parallel     validated + repaired)
```

No function-calling API: the model outputs strict JSON (a search plan,
then URL picks), validated with zod and one repair retry each. Only
two tools exist, both read-only: `web_search` and `fetch_page`.

## Grounding check

Every finished brief goes through a judge-free check
(`src/lib/grounding.ts`): each number must appear in a page it cites
(thousands separators normalised, `3.5` never matching inside `13.5`),
and each finding bullet must carry a citation. Problems show up as
warnings in the trace, next to the brief, instead of being silently
trusted. It can't prove a sentence true, but it catches invented or
mistyped figures, the failure that is easiest to miss when reading.

## Running it as a public demo

- **Per-visitor data**: a proxy gives each browser an anonymous id
  (httpOnly cookie) and every query is scoped to it, so visitors never
  see or delete each other's runs. Demo data is purged after 30 days.
- **Rate limits**: fixed-window counters in Postgres
  (`src/lib/limits.ts`): 5 runs per 10 minutes and 15 per day per IP,
  25 per day in total, sized for Tavily's free monthly quota.
- **Page fetches**: only public addresses are fetched. Localhost,
  private ranges and cloud metadata are refused, and every redirect
  hop is re-checked (`src/lib/safe-fetch.ts`). Picked URLs come from
  search results and the model, so they are untrusted input.

## Tests

`npm test` runs the unit tests (Vitest): grounding, citation parsing,
URL dedup, the JSON contract parser, the DuckDuckGo scraper (ads,
rate-limit challenge pages), page extraction and address filtering.
CI runs lint, typecheck, tests and build on every push.

## Setup

1. **Database**: in the Vercel project, Storage → Create → Neon, and
   connect it. That sets `DATABASE_URL`; the table is created on first
   request. For local dev, pull it with `vercel env pull .env.local`.
2. **Keys**: set `OPENAI_API_KEY` (an OpenRouter key; the default models
   are free) and `TAVILY_API_KEY` in Vercel and in `.env`. Without the
   OpenRouter key, new runs show a notice — the sample run and history
   still work.

Search backend is the first configured key, else keyless DuckDuckGo:

| Variable | Default |
|----------|---------|
| `DATABASE_URL` | (required) |
| `OPENAI_API_KEY` | (required for live runs) |
| `OPENAI_BASE_URL` | `https://openrouter.ai/api/v1` |
| `OPENAI_MODEL` | `nvidia/nemotron-3.5-super-vl:free` |
| `OPENAI_FALLBACK_MODEL` | `nvidia/nemotron-3.5-lightning:free` (used when the primary fails) |
| `TAVILY_API_KEY` | (recommended for demos; free tier, no card) |
| `BRAVE_API_KEY` | (fallback) |

## Notes

- Stop closes the run's connection; the server sees the disconnect and
  saves the partial trace as "stopped".

```bash
npm install
npm run dev      # http://localhost:3000 (needs DATABASE_URL)
npm run lint
npm test
npm run build
```
