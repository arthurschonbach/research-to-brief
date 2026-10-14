import {
  createRun,
  finishRun,
  type CitedSource,
  type TraceStep,
} from "@/lib/db";
import {
  briefSystemPrompt,
  buildBriefPrompt,
  chatModel,
  hasChatKey,
  nextAction,
  planResearch,
  streamChat,
  type Observation,
} from "@/lib/agent";
import { fetchPage, isBlocked, webSearch } from "@/lib/tools";
import {
  registerRun,
  unregisterRun,
} from "@/lib/run-registry";

export type RunEvent =
  | { type: "started"; runId: string }
  | { type: "plan"; searches: string[] }
  | { type: "tool"; n: number; tool: string; label: string }
  | { type: "result"; n: number; kind: string; summary: string }
  | { type: "token"; text: string }
  | { type: "done"; runId: string; brief: string; citations: CitedSource[] }
  | { type: "stopped"; runId: string }
  | { type: "error"; message: string };

const FETCH_CHARS = 6000;

function excerpt(text: string, max: number = 220): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? flat.slice(0, max).trimEnd() + "…" : flat;
}

export async function POST(request: Request): Promise<Response> {
  let question = "";
  let maxSteps = 8;
  let blocklist: string[] = [];
  try {
    const body = (await request.json()) as unknown as {
      question?: unknown;
      maxSteps?: unknown;
      blocklist?: unknown;
    };
    question = typeof body?.question === "string" ? body.question.trim() : "";
    if (typeof body?.maxSteps === "number") {
      maxSteps = Math.min(15, Math.max(3, Math.floor(body.maxSteps)));
    }
    if (Array.isArray(body?.blocklist)) {
      blocklist = body.blocklist
        .filter((e): e is string => typeof e === "string")
        .map((e) => e.trim())
        .filter(Boolean)
        .slice(0, 20);
    }
  } catch {
    question = "";
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: RunEvent) =>
        controller.enqueue(
          new TextEncoder().encode(JSON.stringify(event) + "\n"),
        );
      const started = Date.now();
      const aborter = new AbortController();
      const onAbort = () => aborter.abort();

      if (!question) {
        send({ type: "error", message: "empty" });
        controller.close();
        return;
      }
      if (!hasChatKey()) {
        send({ type: "error", message: "no-key" });
        controller.close();
        return;
      }

      const runId = createRun({ question, maxSteps, blocklist });
      registerRun(runId, aborter);
      send({ type: "started", runId });
      request.signal.addEventListener("abort", onAbort);

      const steps: TraceStep[] = [];
      const observations: Observation[] = [];
      const pages: Array<{ url: string; title: string; text: string }> = [];
      let planQueries: string[] = [];
      let stepNo = 0;
      const push = (kind: TraceStep["kind"], label: string, detail: string) => {
        stepNo += 1;
        steps.push({ n: stepNo, kind, label, detail });
      };
      const fail = (message: string, error: string | null = null) => {
        finishRun(runId, {
          status: "failed",
          plan: planQueries,
          steps,
          brief: "",
          cited: [],
          model: chatModel(),
          latencyMs: Date.now() - started,
          error,
        });
        try {
          send({ type: "error", message });
        } catch {
          // Client went away; ignore.
        }
        controller.close();
      };

      try {
        // 1. Plan.
        const plan = await planResearch(question);
        planQueries = plan.searches.map((s) => s.query);
        if (aborter.signal.aborted) throw new DOMException("aborted", "AbortError");
        push("plan", `${plan.searches.length} searches planned`, planQueries.join(" · "));
        send({ type: "plan", searches: planQueries });

        // 2. Act loop. Every model action except finish consumes exactly
        // one step — including skips — so one counter bounds everything
        // and a stubborn model terminates instead of circling.
        let toolCalls = 0;
        let finished = false;
        const seenQueries = new Set<string>();
        const seenUrls = new Set<string>();
        // Demo-tier protection: at most 3 paid searches per run. Fetches
        // are free, so the model is nudged toward reading, not re-querying.
        const MAX_SEARCHES = 3;
        let searchCount = 0;
        while (toolCalls < maxSteps && !finished) {
          if (aborter.signal.aborted) throw new DOMException("aborted", "AbortError");
          const action = await nextAction({
            question,
            plan,
            observations,
            stepsUsed: toolCalls,
            maxSteps,
            searchesUsed: searchCount,
            maxSearches: MAX_SEARCHES,
          });
          if (aborter.signal.aborted) throw new DOMException("aborted", "AbortError");

          if (action.tool === "finish") {
            finished = true;
            break;
          }
          toolCalls += 1;
          if (action.tool === "web_search") {
            const normalizedQuery = action.query.trim().toLowerCase();
            if (searchCount >= MAX_SEARCHES) {
              push("skip-repeat", action.query, `search budget spent (${MAX_SEARCHES} max)`);
              send({ type: "result", n: stepNo, kind: "skip-repeat", summary: `skipped (search budget spent): ${action.query}` });
              observations.push({ kind: "search", label: action.query, content: "(search budget spent — fetch a page you have, or finish)" });
              continue;
            } else if (seenQueries.has(normalizedQuery)) {
              push("skip-repeat", action.query, "repeated query, skipped");
              send({ type: "result", n: stepNo, kind: "skip-repeat", summary: `skipped (repeated): ${action.query}` });
              observations.push({ kind: "search", label: action.query, content: "(repeated query, skipped)" });
              continue;
            } else {
              seenQueries.add(normalizedQuery);
              searchCount += 1;
              send({ type: "tool", n: stepNo + 1, tool: "search", label: action.query });
            try {
              const results = await webSearch(action.query);
              const summary =
                results.length === 0
                  ? "no results"
                  : results.map((r) => `${r.title} (${r.url})`).join(" · ");
              observations.push({
                kind: "search",
                label: action.query,
                content: results
                  .map((r) => `- ${r.title}, ${r.snippet} [${r.url}]`)
                  .join("\n"),
              });
              push("search", action.query, summary || "no results");
              send({ type: "result", n: stepNo, kind: "search", summary: summary || "no results" });
            } catch (error) {
              const reason = error instanceof Error ? error.message : "failed";
              push("warning", action.query, `search failed: ${reason}`);
              send({ type: "result", n: stepNo, kind: "warning", summary: `search failed: ${reason}` });
              observations.push({ kind: "search", label: action.query, content: "(search failed)" });
            }
            }
          } else {
            // fetch_page
            const normalizedUrl = action.url.trim();
            if (isBlocked(normalizedUrl, blocklist)) {
              push("skip-blocked", normalizedUrl, "blocked domain");
              send({ type: "result", n: stepNo, kind: "skip-blocked", summary: `skipped (blocked): ${normalizedUrl}` });
              observations.push({ kind: "fetch", label: normalizedUrl, content: "(skipped: blocked domain)" });
              continue;
            }
            if (seenUrls.has(normalizedUrl)) {
              push("skip-repeat", normalizedUrl, "already fetched, skipped");
              send({ type: "result", n: stepNo, kind: "skip-repeat", summary: `skipped (already fetched): ${normalizedUrl}` });
              observations.push({ kind: "fetch", label: normalizedUrl, content: "(already fetched, skipped)" });
              continue;
            }
            seenUrls.add(normalizedUrl);
            send({ type: "tool", n: stepNo + 1, tool: "fetch", label: action.url });
            try {
              const page = await fetchPage(action.url);
              const text = page.text.slice(0, FETCH_CHARS);
              const thin = page.text.length < 500;
              pages.push({ url: page.finalUrl, title: page.title, text });
              observations.push({
                kind: "fetch",
                label: page.title,
                content:
                  (thin
                    ? `(thin page — only ${page.text.length} chars, likely JavaScript-rendered and unreliable; prefer fetching another source)\n`
                    : "") +
                  `[page ${pages.length}] ${page.title}\n${text}`,
              });
              push("fetch", page.title, `${page.finalUrl} · ${page.text.length} chars`);
              send({ type: "result", n: stepNo, kind: "fetch", summary: `${page.title} (${page.text.length} chars)` });
            } catch (error) {
              const reason = error instanceof Error ? error.message : "failed";
              push("warning", action.url, `fetch failed: ${reason}`);
              send({ type: "result", n: stepNo, kind: "warning", summary: `fetch failed: ${reason}` });
              observations.push({ kind: "fetch", label: action.url, content: `(fetch failed: ${reason})` });
            }
          }

          // Politeness pacing between network calls (skips jump past it).
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        if (aborter.signal.aborted) throw new DOMException("aborted", "AbortError");

        // 3. Synthesize.
        if (pages.length === 0) {
          push("warning", "no evidence", "nothing fetchable was collected");
          fail("no-evidence", "no pages could be fetched");
          return;
        }
        push("answer", "writing brief", `${pages.length} sources`);
        const briefGen = streamChat(
          briefSystemPrompt(),
          buildBriefPrompt(
            question,
            pages.map((p, i) => ({ n: i + 1, url: p.url, title: p.title, text: p.text })),
          ),
          1200,
        );
        let next = await briefGen.next();
        let full = "";
        while (!next.done) {
          if (aborter.signal.aborted) throw new DOMException("aborted", "AbortError");
          full += next.value.token;
          send({ type: "token", text: next.value.token });
          next = await briefGen.next();
        }

        const citations: CitedSource[] = [];
        const seen = new Set<number>();
        for (const match of full.matchAll(/\[(\d+)\]/g)) {
          const n = Number(match[1]);
          if (!Number.isInteger(n) || n < 1 || n > pages.length || seen.has(n)) continue;
          seen.add(n);
          const page = pages[n - 1];
          citations.push({ n, url: page.url, title: page.title, excerpt: excerpt(page.text) });
        }
        citations.sort((a, b) => a.n - b.n);

        finishRun(runId, {
          status: "done",
          plan: planQueries,
          steps,
          brief: full,
          cited: citations,
          model: chatModel(),
          latencyMs: Date.now() - started,
        });
        send({ type: "done", runId, brief: full, citations });
        controller.close();
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          finishRun(runId, {
            status: "stopped",
            plan: planQueries,
            steps,
            brief: "",
            cited: [],
            model: chatModel(),
            latencyMs: Date.now() - started,
          });
          try {
            send({ type: "stopped", runId });
          } catch {
            // Client went away; ignore.
          }
          controller.close();
          return;
        }
        console.error("Run failed:", error);
        fail("failed", error instanceof Error ? error.message : String(error));
      } finally {
        unregisterRun(runId);
        request.signal.removeEventListener("abort", onAbort);
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8" },
  });
}
