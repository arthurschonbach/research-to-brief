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

## Setup

Copy `.env.example` to `.env` and set `OPENAI_API_KEY` (an OpenRouter
key; the default model is a free one). Without it, new runs show a
notice — the sample run and history still work.

Search backend is the first configured key, else keyless DuckDuckGo:

| Variable | Default |
|----------|---------|
| `OPENAI_API_KEY` | (required for live runs) |
| `OPENAI_BASE_URL` | `https://openrouter.ai/api/v1` |
| `OPENAI_MODEL` | `nvidia/nemotron-3.5-super-vl:free` |
| `TAVILY_API_KEY` | (recommended for demos; free tier, no card) |
| `BRAVE_API_KEY` | (fallback) |
| `DATABASE_PATH` | `./data/research.db` |

## Notes

- Storage is SQLite (`better-sqlite3`), single-user.
- On Vercel the database lives in `/tmp` (read-only filesystem), so
  history is ephemeral there — the sample run is always reloadable.
  Set `OPENAI_API_KEY` and `TAVILY_API_KEY` in the project environment
  variables and redeploy.

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint
npm run build
```
