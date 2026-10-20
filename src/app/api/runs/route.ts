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
  pickUrls,
  planResearch,
  rewriteBriefWithCitations,
  streamChat,
} from "@/lib/agent";

// Research runs stream for 30–60s; allow the function to live that long
// on hosts with short defaults (Vercel Hobby).
export const maxDuration = 60;
import {
  fetchPage,
  isBlocked,
  tavilyExtract,
  webSearch,
  type SearchResult,
} from "@/lib/tools";
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
  | { type: "repaired"; brief: string }
  | { type: "done"; runId: string; brief: string; citations: CitedSource[] }
  | { type: "stopped"; runId: string }
  | { type: "error"; message: string };

// Fixed pipeline budgets. No loop, so nothing can repeat or spin:
// 3 paid searches max, up to 4 pages read.
const MAX_SEARCHES = 3;
const MAX_PAGES = 4;

const FETCH_CHARS = 6000;
const THIN_CHARS = 500;

function excerpt(text: string, max: number = 220): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? flat.slice(0, max).trimEnd() + "…" : flat;
}

function parseCitations(
  text: string,
  pages: Array<{ url: string; title: string; text: string }>,
): CitedSource[] {
  const citations: CitedSource[] = [];
  const seen = new Set<number>();
  for (const match of text.matchAll(/\[(\d+)\]/g)) {
    const n = Number(match[1]);
    if (!Number.isInteger(n) || n < 1 || n > pages.length || seen.has(n)) {
      continue;
    }
    seen.add(n);
    const page = pages[n - 1];
    citations.push({
      n,
      url: page.url,
      title: page.title,
      excerpt: excerpt(page.text),
    });
  }
  citations.sort((a, b) => a.n - b.n);
  return citations;
}

// Same page, different string: drop fragment, tracking params, "www.",
// trailing slash. Used to dedupe picks and fetched pages.
function urlKey(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|ref$)/i.test(key)) u.searchParams.delete(key);
    }
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    return `${host}${u.pathname.replace(/\/+$/, "")}${u.search}`;
  } catch {
    return url.trim();
  }
}

function checkAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException("aborted", "AbortError");
}

export async function POST(request: Request): Promise<Response> {
  let question = "";
  let blocklist: string[] = [];
  try {
    const body = (await request.json()) as unknown as {
      question?: unknown;
      blocklist?: unknown;
    };
    question = typeof body?.question === "string" ? body.question.trim() : "";
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

      const runId = createRun({ question, maxSteps: MAX_PAGES, blocklist });
      registerRun(runId, aborter);
      send({ type: "started", runId });
      request.signal.addEventListener("abort", onAbort);

      const steps: TraceStep[] = [];
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
        // 1. Plan: 2–5 search queries, one LLM call.
        const plan = await planResearch(question);
        planQueries = plan.searches.map((s) => s.query);
        checkAborted(aborter.signal);
        push("plan", `${plan.searches.length} searches planned`, planQueries.join(" · "));
        send({ type: "plan", searches: planQueries });

        // 2. Search each planned query (max 3), sequentially: natural
        // pacing for scraped backends, live rows, no timers.
        const merged: SearchResult[] = [];
        const seenResultUrls = new Set<string>();
        for (const query of planQueries.slice(0, MAX_SEARCHES)) {
          checkAborted(aborter.signal);
          send({ type: "tool", n: stepNo + 1, tool: "search", label: query });
          try {
            const results = await webSearch(query);
            const summary =
              results.length === 0
                ? "no results"
                : results.map((r) => `${r.title} (${r.url})`).join(" · ");
            for (const r of results) {
              if (!seenResultUrls.has(r.url)) {
                seenResultUrls.add(r.url);
                merged.push(r);
              }
            }
            push("search", query, summary);
            send({ type: "result", n: stepNo, kind: "search", summary });
          } catch (error) {
            const reason = error instanceof Error ? error.message : "failed";
            push("warning", query, `search failed: ${reason}`);
            send({ type: "result", n: stepNo, kind: "warning", summary: `search failed: ${reason}` });
          }
        }

        checkAborted(aborter.signal);

        // 3. Pick up to 4 pages to read, one LLM call. Blocked domains
        // are filtered here and shown as skips, never fetched.
        let chosen: string[] = [];
        if (merged.length > 0) {
          const picked = await pickUrls(question, planQueries, merged);
          checkAborted(aborter.signal);
          for (const url of picked) {
            if (isBlocked(url, blocklist)) {
              push("skip-blocked", url, "blocked domain");
              send({ type: "result", n: stepNo, kind: "skip-blocked", summary: `skipped (blocked): ${url}` });
            } else if (!chosen.some((c) => urlKey(c) === urlKey(url))) {
              chosen.push(url);
            }
          }
          chosen = chosen.slice(0, MAX_PAGES);
        }

        // 4. Read the pages in parallel: Tavily extract first (handles
        // JavaScript-rendered pages), direct fetch as fallback per page.
        // Step numbers are reserved up front so concurrent completions
        // pair with the right pending rows.
        if (chosen.length > 0) {
          const reserved = chosen.map(() => {
            stepNo += 1;
            return stepNo;
          });
          chosen.forEach((url, i) =>
            send({ type: "tool", n: reserved[i], tool: "fetch", label: url }),
          );
          let extracted = new Map<string, { url: string; title: string; text: string }>();
          try {
            const out = await tavilyExtract(chosen, question);
            extracted = new Map(out.map((p) => [p.url, p]));
          } catch (error) {
            // No key or API failure: fall through to direct fetch below.
            if (!(error instanceof Error) || error.message !== "no-key") {
              push("warning", "extract", "extract API failed, direct fetch");
              send({ type: "result", n: stepNo, kind: "warning", summary: "extract API failed, direct fetch" });
            }
          }
          await Promise.all(
            chosen.map(async (url, i) => {
              if (aborter.signal.aborted) return;
              const n = reserved[i];
              const hit = extracted.get(url);
              if (hit) {
                addPage(n, hit.url, hit.title, hit.text);
                return;
              }
              try {
                const page = await fetchPage(url);
                addPage(n, page.finalUrl, page.title, page.text);
              } catch (error) {
                const reason = error instanceof Error ? error.message : "failed";
                steps.push({ n, kind: "warning", label: url, detail: `fetch failed: ${reason}` });
                send({ type: "result", n, kind: "warning", summary: `fetch failed: ${reason}` });
              }
            }),
          );
        }

        function addPage(n: number, url: string, title: string, text: string): void {
          // Two picks can still redirect to one page: keep the first.
          if (pages.some((p) => urlKey(p.url) === urlKey(url))) {
            steps.push({ n, kind: "skip-repeat", label: url, detail: "same page as an earlier read" });
            send({ type: "result", n, kind: "skip-repeat", summary: `same page as an earlier read: ${url}` });
            return;
          }
          const capped = text.slice(0, FETCH_CHARS);
          const thin = text.length < THIN_CHARS;
          pages.push({ url, title, text: capped });
          steps.push({
            n,
            kind: "fetch",
            label: title,
            detail: `${url} · ${text.length} chars${thin ? " (thin)" : ""}`,
          });
          send({ type: "result", n, kind: "fetch", summary: `${title} (${text.length} chars)${thin ? " — thin" : ""}` });
        }

        checkAborted(aborter.signal);

        // Thin pages only count when nothing better exists.
        const good = pages.filter((p) => p.text.length >= THIN_CHARS);
        const usable = good.length >= 2 ? good : pages;

        // 5. Synthesize.
        if (usable.length === 0) {
          push("warning", "no evidence", "nothing fetchable was collected");
          fail("no-evidence", "no pages could be fetched");
          return;
        }
        push("answer", "writing brief", `${usable.length} sources`);
        const briefGen = streamChat(
          briefSystemPrompt(),
          buildBriefPrompt(
            question,
            usable.map((p, i) => ({ n: i + 1, url: p.url, title: p.title, text: p.text })),
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

        const citations = parseCitations(full, usable);

        if (citations.length === 0) {
          // The brief dropped its markers — one repair pass, delivered as
          // a single swap so the UI doesn't stall or duplicate text.
          push("warning", "brief", "missing citations — repairing");
          send({ type: "result", n: stepNo, kind: "warning", summary: "brief missing citations — repairing" });
          try {
            const repaired = await rewriteBriefWithCitations(
              question,
              usable.map((p, i) => ({ n: i + 1, url: p.url, title: p.title, text: p.text })),
              full,
            );
            if (aborter.signal.aborted) throw new DOMException("aborted", "AbortError");
            const recited = parseCitations(repaired, usable);
            if (recited.length > 0) {
              full = repaired;
              citations.push(...recited);
              send({ type: "repaired", brief: repaired });
            }
          } catch (error) {
            console.error("Citation repair failed:", error);
          }
        }

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
