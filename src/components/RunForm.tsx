"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "./LocaleProvider";
import type { CitedSource, TraceStep } from "@/lib/db";
import { TraceList } from "./TraceList";
import {
  EmptyState,
  areaClass,
  btnPrimary,
  btnSecondary,
  inputClass,
  labelClass,
} from "./ui";

type StreamEvent =
  | { type: "started"; runId: string }
  | { type: "plan"; searches: string[] }
  | { type: "tool"; n: number; tool: string; label: string }
  | { type: "result"; n: number; kind: string; summary: string }
  | { type: "token"; text: string }
  | { type: "done"; runId: string; brief: string; citations: CitedSource[] }
  | { type: "stopped"; runId: string }
  | { type: "error"; message: string };

type Phase = "idle" | "working" | "done" | "stopped" | "error";

interface TraceRow {
  key: number;
  kind: TraceStep["kind"] | "tool";
  label: string;
  detail: string;
}

export function RunForm({ hasKey }: { hasKey: boolean }) {
  const { d } = useI18n();
  const [question, setQuestion] = useState("");
  const [maxSteps, setMaxSteps] = useState(8);
  const [blocklist, setBlocklist] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [rows, setRows] = useState<TraceRow[]>([]);
  const [brief, setBrief] = useState("");
  const [citations, setCitations] = useState<CitedSource[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<string | null>(null);
  const keyRef = useRef(0);

  const working = phase === "working";

  async function start() {
    const q = question.trim();
    if (!q || working) return;
    setPhase("working");
    setRows([]);
    setBrief("");
    setCitations([]);
    setRunId(null);
    setErrorKind(null);

    const blocked = blocklist.split("\n").map((s) => s.trim()).filter(Boolean);

    try {
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q, maxSteps, blocklist: blocked }),
      });
      if (!response.ok || !response.body) {
        throw new Error(`Request failed (${response.status}).`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newline: number;
        while ((newline = buffer.indexOf("\n")) !== -1) {
          const rawLine = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (!rawLine) continue;
          const event = JSON.parse(rawLine) as StreamEvent;
          if (event.type === "started") {
            setRunId(event.runId);
          } else if (event.type === "plan") {
            addRow("plan", d.trace.plan, event.searches.join(" · "));
          } else if (event.type === "tool") {
            addRow("tool", event.tool === "search" ? d.trace.searching : d.trace.fetching, event.label);
          } else if (event.type === "result") {
            addRow(
              event.kind === "search" || event.kind === "fetch" ? event.kind : "warning",
              event.kind === "skip-blocked"
                ? d.trace.skipped
                : event.kind === "skip-repeat"
                  ? d.trace.repeated
                  : event.kind,
              event.summary,
            );
          } else if (event.type === "token") {
            full += event.text;
            setBrief(full);
          } else if (event.type === "done") {
            full = event.brief;
            setBrief(event.brief);
            setCitations(event.citations);
            setRunId(event.runId);
            setPhase("done");
          } else if (event.type === "stopped") {
            setRunId(event.runId);
            setPhase("stopped");
          } else if (event.type === "error") {
            setErrorKind(event.message);
            setPhase("error");
          }
        }
      }
    } catch {
      setErrorKind("failed");
      setPhase("error");
    }
  }

  function addRow(kind: TraceRow["kind"], label: string, detail: string) {
    keyRef.current += 1;
    const key = keyRef.current;
    setRows((current) => [...current, { key, kind, label, detail }]);
  }

  async function cancel() {
    if (!runId) return;
    try {
      await fetch(`/api/runs/${runId}/cancel`, { method: "POST" });
    } catch {
      // Server will finish on its own; the trace shows what completed.
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="question">
            {d.ask.questionLabel}
          </label>
          <textarea
            id="question"
            rows={3}
            className={areaClass}
            placeholder={d.ask.questionPlaceholder}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            disabled={working || !hasKey}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[8rem_1fr]">
          <div>
            <label className={labelClass} htmlFor="max-steps">
              {d.guards.maxSteps}
            </label>
            <input
              id="max-steps"
              type="number"
              min={3}
              max={15}
              value={maxSteps}
              onChange={(event) => setMaxSteps(Number(event.target.value) || 8)}
              className={inputClass}
              disabled={working || !hasKey}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="blocklist">
              {d.guards.blocklist}
            </label>
            <textarea
              id="blocklist"
              rows={2}
              className={areaClass}
              placeholder={d.guards.blocklistPlaceholder}
              value={blocklist}
              onChange={(event) => setBlocklist(event.target.value)}
              disabled={working || !hasKey}
            />
          </div>
        </div>

        <p className="text-xs text-muted">{d.guards.readonly}</p>
        <p className="text-xs text-muted">{d.guards.searchCap}</p>

        {!hasKey && <EmptyState>{d.ask.needsKey}</EmptyState>}

        <div className="flex items-center gap-3">
          <button
            type="button"
            className={btnPrimary}
            disabled={working || !hasKey || !question.trim()}
            onClick={() => void start()}
          >
            {working ? d.ask.working : d.ask.submit}
          </button>
          {working && (
            <button type="button" className={btnSecondary} onClick={() => void cancel()}>
              {d.trace.cancel}
            </button>
          )}
        </div>
      </div>

      {rows.length > 0 && (
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
            {d.trace.title}
          </h2>
          <div aria-live="polite">
            <TraceList rows={rows} />
          </div>
        </div>
      )}

      {brief && (
        <div className="space-y-4">
          <div className="rounded-md border border-border p-4 sm:p-5">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{brief}</p>
          </div>
          {citations.length > 0 && (
            <div>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
                {d.ask.citedLabel}
              </h2>
              <ul className="space-y-2">
                {citations.map((c) => (
                  <li key={c.n} className="rounded-md border border-border p-3 text-sm">
                    <p className="text-xs font-medium text-muted">
                      [{c.n}] · {c.title}
                    </p>
                    <p className="mt-1 break-all text-muted">{c.url}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {runId && (
            <p className="text-sm">
              <Link
                href={`/history/${runId}`}
                className="text-muted underline underline-offset-4 transition-colors hover:text-foreground"
              >
                {d.ask.viewRun}
              </Link>
            </p>
          )}
        </div>
      )}

      {phase === "stopped" && <EmptyState>{d.ask.stopped}</EmptyState>}

      {phase === "error" && (
        <div className="rounded-md border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger">
          {errorMessage(d.ask, errorKind)}
        </div>
      )}
    </div>
  );
}

function errorMessage(
  ask: { runFailed: string; emptyQuestion: string; noEvidence: string; needsKey: string },
  kind: string | null,
): string {
  if (kind === "empty") return ask.emptyQuestion;
  if (kind === "no-key") return ask.needsKey;
  if (kind === "no-evidence") return ask.noEvidence;
  return ask.runFailed;
}
