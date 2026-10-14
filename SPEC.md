# research-to-brief, Spec

## 1. One-liner

Ask a research question. An agent plans searches, calls search + fetch
tools, and writes a **cited brief**, with the whole trace visible and
guardrails enforced (step cap, read-only tools, cancel anytime).

Portfolio role: project #3 of 3, the ***act*** piece. #1
(`meeting-to-actions`) shows *structured extraction*. #2
(`docs-to-answers`) shows *retrieval*. This one shows the **agent loop**:
plan → tool call → observe → synthesize, with cost/latency transparency
and safety rails a client can inspect.

## 2. Non-goals (v1)

- No side-effect tools. Search + fetch only, safety by construction, and
  the UI says so. (Write actions, email sending, etc. are explicitly out.)
- No function-calling API dependency. The loop uses a strict **ReAct-style
  JSON action format** validated with zod, so it works on any free-tier
  chat model, including ones with weak tool support.
- No auth / multi-user. Single-user local app, like #1 and #2.
- No background workers. Runs execute inside the streaming request;
  cancel is cooperative via AbortController (documented limitation).
- One run at a time in the UI (a second run replaces the view; history
  keeps everything).

## 3. Demo story (what a reviewer clicks)

1. Lands on `/`, sees a question box, the guardrail panel (max steps,
   read-only toolset, cancel button once running), and "Load sample run".
2. Asks "What are the cheapest EU options for X?" → a **live trace**
   appears: plan → `search("…")` → 3 results → `fetch(url)` →
   `search("…")` → brief streams in with `[1] [2]` citations.
3. Clicks a citation → the fetched source excerpt.
4. Opens history → past runs with steps, latency, model. The trace is the
   hire-me signal: it proves the agent actually did the work.

## 4. Core flows

### 4.1 Run

- Input: research question + guardrails (max steps, default 8; domain
  blocklist, optional text field).
- Loop (server-side, streamed as NDJSON trace):
  1. **Plan**: model writes 2–5 planned searches (parsed JSON, validated).
  2. **Act**: for each step, model emits one action,
     `{"tool":"web_search","query":…}` or `{"tool":"fetch_page","url":…}`
     or `{"tool":"finish"}`. Anything else → validation error → one
     repair retry → abort step with a logged warning.
  3. **Observe**: tool result appended to the running context (search:
     top-5 titles/snippets/urls; fetch: readable text, capped ~8k chars).
  4. Stop when the model calls `finish`, max steps hit, or user cancels.
- **Synthesize**: final call writes the brief from collected observations
  only, with `[n]` citations mapped to fetched pages. Same abstention
  honesty as #2: thin evidence → brief says what is/isn't established.

### 4.2 Tools (both keyless)

- `web_search`: DuckDuckGo HTML endpoint + cheerio parsing (already a
  dependency pattern from #2). Top 5, title/snippet/url. Graceful
  degradation on rate limits (logged warning in trace, run continues).
- `fetch_page`: reuse #2's readable-text extraction (cheerio, main/
  article preference, 2MB cap, http(s) only).

### 4.3 Guardrails (visible in UI, enforced in code)

- Max steps (default 8, adjustable 3–15 on the form).
- Read-only toolset: only the two tools above exist; the UI states this.
- Domain blocklist (optional free text, one per line; matched as
  substrings, skipped URLs appear in the trace as skipped, not silent).
- Cancel button → aborts the run; partial trace + partial brief saved.
- Per-run panel: steps used, tool calls, wall latency, model id.

### 4.4 History

- Runs list: question, date, steps used, status (done / stopped /
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

- `POST /api/runs`, body `{question, maxSteps, blocklist}`. NDJSON
  stream: `{type:"plan", steps:[…]}`, `{type:"tool", n, tool, label}`,
  `{type:"result", n, summary}`, `{type:"token", text}` (brief),
  `{type:"done", runId, brief, citations}` / `{type:"stopped", runId}` /
  `{type:"error", message}`.
- `POST /api/runs/[id]/cancel`, aborts the in-flight run (module-level
  AbortController map; single-user scope documented).
- `POST /api/sample`, seeds one precomputed run (no key needed).
- Cancel on client disconnect is best-effort; the run saves whatever it
  completed (same honesty rule as #2's ask route).

## 8. Agent prompt sketch (firmed up at build time)

- Planner system prompt: "Output ONLY JSON: {searches: [{query,
  why}]}. 2–5 queries. …"
- Actor system prompt: rolling context of plan + observations; "Output
  ONLY one JSON action per turn: {tool, …}. Call finish when you have
  enough to brief, or when further calls would repeat."
- Brief system prompt: same citation discipline as #2 (`[n]` markers,
  validated server-side), thin-evidence honesty clause.
- Temperature 0.2, tight max_tokens per call (plan 400, actions 200,
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
- [ ] Max steps enforced; cancel stops the run and saves partial state.
- [ ] Blocklisted domain appears as skipped in the trace.
- [ ] README explains the loop, the JSON-action choice, and production
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
