# research-to-brief, Spec

## 1. One-liner

Ask a research question. An agent plans searches, calls search + fetch
tools, and writes a **cited brief**, with the whole trace visible and
guardrails enforced (step cap, read-only tools, cancel anytime).

Portfolio role: project #3 of 3, the ***act*** piece. #1
(`meeting-to-actions`) shows *structured extraction*. #2
(`docs-to-answers`) shows *retrieval*. This one shows **grounded
research**: plan → search → read → synthesize, with cost/latency
transparency and safety rails a client can inspect.

## 2. Non-goals (v1)

- No side-effect tools. Search + fetch only, safety by construction, and
  the UI says so. (Write actions, email sending, etc. are explicitly out.)
- No function-calling API dependency. Model outputs are strict JSON
  (plan, URL picks) validated with zod, so it works on any free-tier
  chat model, including ones with weak tool support.
- No auth / multi-user. Single-user local app, like #1 and #2.
- No background workers. Runs execute inside the streaming request;
  cancel is cooperative via AbortController (documented limitation).
- One run at a time in the UI (a second run replaces the view; history
  keeps everything).

## 3. Demo story (what a reviewer clicks)

1. Lands on `/`, sees a question box, the guardrail panel (fixed
   budgets, read-only toolset, cancel button once running), and "Load
   sample run".
2. Asks "What are the cheapest EU options for X?" → a **live trace**
   appears: plan → searches → picked pages → reads → brief streams in
   with `[1] [2]` citations.
3. Clicks a citation → the fetched source excerpt.
4. Opens history → past runs with steps, latency, model. The trace is the
   hire-me signal: it proves the agent actually did the work.

## 4. Core flows

### 4.1 Run (fixed pipeline, no loop)

- Input: research question + domain blocklist.
- Fixed stages, each visible in the trace:
  1. **Plan**: model writes 2–5 planned searches (parsed JSON, validated,
     one repair retry, raw-question fallback).
  2. **Search**: each planned query runs (max 3), sequentially.
  3. **Pick**: model picks up to 4 URLs from the merged results
     (distinct sources preferred, same repair discipline). Blocked
     domains are filtered here and shown as skips, never fetched.
  4. **Read**: pages fetched in parallel — Tavily extract first (handles
     JavaScript-rendered pages), direct fetch as fallback per page.
     Thin pages (<500 chars) only count when nothing better exists.
  5. **Brief**: streamed, `[n]` markers validated, one repair pass if
     missing.
- There is deliberately no agent loop: with fixed stages nothing can
  repeat, stall, or need pacing timers and iteration caps. The whole run
  is 4 LLM calls plus searches/fetches.
- **Synthesize**: final call writes the brief from the collected pages
  only, with `[n]` citations mapped to fetched pages (one repair pass if
  markers are missing). Same abstention honesty as #2: thin evidence →
  brief says what is/isn't established.

### 4.2 Tools (both keyless)

- `web_search`: DuckDuckGo HTML endpoint + cheerio parsing (already a
  dependency pattern from #2). Top 5, title/snippet/url. Graceful
  degradation on rate limits (logged warning in trace, run continues).
- `fetch_page`: reuse #2's readable-text extraction (cheerio, main/
  article preference, 2MB cap, http(s) only).

### 4.3 Guardrails (visible in UI, enforced in code)

- Fixed budgets: max 3 paid searches, up to 4 pages read per run.
  Nothing to configure, nothing to burn through.
- Read-only toolset: only the two tools above exist; the UI states this.
- Domain blocklist (optional free text, one per line; matched as
  substrings, skipped URLs appear in the trace as skipped, not silent).
- Cancel button → aborts the run; partial trace + partial brief saved.
- Per-run panel: actions used, wall latency, model id.

### 4.4 History

- Runs list: question, date, trace length, status (done / stopped /
  failed), brief length. Click → read-only run detail: full trace
  timeline + brief + cited sources.

## 5. Pages

| Route | Content |
|-------|---------|
| `/` | Question box, guardrail settings, live trace + brief. Empty state with "Load sample run" (precomputed trace, works without a key). |
| `/history` | Past runs, newest first. |
| `/history/[id]` | Trace timeline, brief, cited sources, guardrail summary. |

Header nav mirrors #1/#2 (brand left, nav + theme + language right).
Same 680px container, same token system. Bilingual EN/FR via the same
i18n pattern.

## 6. Data model (sqlite, `data/research.db`)

- `runs(id, question, status, max_steps, blocklist JSON, plan JSON,
  steps JSON, brief TEXT, cited JSON, model, latency_ms, error,
  created_at)`
  - Steps stored as one JSON array (portfolio scale; rows would be
    purer, arrays are simpler to render): 
    `[{n, kind, label, detail, ms}]` where kind ∈ plan/search/fetch/
    skip/warning/answer.

## 7. API routes

- `POST /api/runs`, body `{question, blocklist}`. NDJSON
  stream: `{type:"started", runId}`, `{type:"plan", searches:[…]}`,
  `{type:"tool", n, tool, label}`, `{type:"result", n, kind, summary}`,
  `{type:"token", text}` (brief), `{type:"repaired", brief}` on citation
  repair, `{type:"done", runId, brief, citations}` /
  `{type:"stopped", runId}` / `{type:"error", message}`.
- `POST /api/runs/[id]/cancel`, aborts the in-flight run (module-level
  AbortController map; single-user scope documented).
- `POST /api/sample`, seeds one precomputed run (no key needed).
- Cancel on client disconnect is best-effort; the run saves whatever it
  completed (same honesty rule as #2's ask route).

## 8. Agent prompt sketch (firmed up at build time)

- Planner system prompt: "Output ONLY JSON: {searches: [{query,
  why}]}. 2–5 queries. …"
- Picker system prompt: "Output ONLY JSON: {urls: [...]}. Up to 4,
  distinct sources preferred. …" (same repair discipline as the planner).
- Brief system prompt: same citation discipline as #2 (`[n]` markers,
  validated server-side), thin-evidence honesty clause.
- Temperature 0.2, tight max_tokens per call (plan 400, pick 300,
  brief 1200). Free-tier latency dominates; the trace UI makes waiting
  legible instead of hiding it.

## 9. No-key behavior (matches #1/#2 honesty)

- Sample run, history browsing, trace inspection: all work without a key.
- Live runs need `OPENAI_API_KEY` (OpenRouter free-tier default, same
  `.env` pattern). Without it, the form shows the standard notice.

## 10. Design system

Reuse verbatim: tokens, `ui.tsx` primitives, 680px container,
header/footer, theme + language toggles. New only where the agent needs
it: a **trace timeline** style (step rows with tool/result/warning tones)
and the guardrail panel. Keep both minimal, a bordered list, not a
chat UI.

## 11. Milestones (build order)

1. Scaffold (Next + sqlite + i18n + theme + design system copy).
2. Tools: `web_search` (DDG) + `fetch_page` (extractor), each with a
   direct unit check.
3. Agent loop: plan → act → observe → brief, streamed trace, cancel.
4. Guardrails UI + enforcement (step cap, blocklist, read-only notice).
5. History list + run detail.
6. Sample run + README + screenshots (trace shot is the hero image).

## 12. Definition of done

- [ ] Sample run loads keyless with a full stored trace.
- [ ] Live run on a fresh question shows plan → searches → fetches →
      cited brief, all in the trace.
- [ ] Max actions enforced; cancel stops the run and saves partial state.
- [ ] Blocklisted domain appears as skipped in the trace.
- [ ] README explains the pipeline, the JSON-output choice, and production
      swaps (job queue, real search API, function calling).
- [ ] `npm run lint` + `npm run build` clean, no console errors.

## 13. Open questions (decide before/with milestone 2)

1. DDG HTML reliability from server-side fetches, verify early; fallback
   is a second DDG endpoint (`lite.duckduckgo.com`) or documented
   rate-limit degradation.
2. Free-model JSON discipline, the zod-validate + repair-retry design
   assumes occasional slop; verify with the default free model at
   milestone 3, tighten prompts if needed.
3. Cancel plumbing: module-level AbortController map works for local
   demo; confirm it survives Turbopack dev reloads acceptably or scope
   cancel to "stop listening + mark stopped".
