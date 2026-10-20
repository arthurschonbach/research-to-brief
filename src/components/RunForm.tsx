"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "./LocaleProvider";
import type { CitedSource, TraceStep } from "@/lib/db";
import { TraceList } from "./TraceList";
import { BriefView } from "./BriefView";
import {
  EmptyState,
  ErrorBox,
  SectionTitle,
  areaClass,
  btnPrimary,
  btnSecondary,
  labelClass,
  linkClass,
} from "./ui";

type StreamEvent =
  | { type: "started"; runId: string }
  | { type: "plan"; searches: string[] }
  | { type: "tool"; n: number; tool: string; label: string }
  | { type: "result"; n: number; kind: string; summary: string }
  | { type: "token"; text: string }
  | { type: "repaired"; brief: string }
  | { type: "done"; runId: string; brief: string; citations: CitedSource[] }
  | { type: "stopped"; runId: string }
  | { type: "error"; message: string };

type Phase = "idle" | "working" | "done" | "stopped" | "error";

interface TraceRow {
  key: number;
  n: number | null;
  kind: TraceStep["kind"] | "tool";
  label: string;
  detail: string;
  pending: boolean;
}

export function RunForm({ hasKey }: { hasKey: boolean }) {
  const { d } = useI18n();
  const [question, setQuestion] = useState("");
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
        body: JSON.stringify({ question: q, blocklist: blocked }),
      });
      if (!response.ok || !response.body) {
        throw new Error(`Request failed (${response.status}).`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";
      let terminal = false;
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
            addRow(null, "plan", d.trace.plan, event.searches.join(" · "), false);
          } else if (event.type === "tool") {
            // Pending row; the matching result event completes it in place.
            addRow(
              event.n,
              "tool",
              event.tool === "search" ? d.trace.searching : d.trace.fetching,
              event.label,
              true,
            );
          } else if (event.type === "result") {
            if (event.kind === "search") {
              completeRow(event.n, "search", d.trace.searched, event.summary, false);
            } else if (event.kind === "fetch") {
              completeRow(event.n, "fetch", d.trace.read, event.summary, true);
            } else {
              // Warnings/skips: settle the matching pending row if there is
              // one (e.g. a failed read), otherwise append.
              completeRow(
                event.n,
                "warning",
                event.kind === "skip-blocked"
                  ? d.trace.skipped
                  : event.kind === "skip-repeat"
                    ? d.trace.repeated
                    : d.trace.warning,
                event.summary,
                true,
              );
            }
          } else if (event.type === "token") {
            full += event.text;
            setBrief(full);
          } else if (event.type === "repaired") {
            full = event.brief;
            setBrief(event.brief);
          } else if (event.type === "done") {
            full = event.brief;
            setBrief(event.brief);
            setCitations(event.citations);
            setRunId(event.runId);
            setPhase("done");
            terminal = true;
          } else if (event.type === "stopped") {
            setRunId(event.runId);
            setPhase("stopped");
            terminal = true;
          } else if (event.type === "error") {
            setErrorKind(event.message);
            setPhase("error");
            terminal = true;
          }
        }
      }
      if (!terminal) {
        // Stream ended without a terminal event (connection dropped):
        // show what arrived and offer retry instead of hanging on "working".
        setErrorKind("failed");
        setPhase("error");
      }
    } catch {
      setErrorKind("failed");
      setPhase("error");
    }
  }

  function addRow(
    n: number | null,
    kind: TraceRow["kind"],
    label: string,
    detail: string,
    pending: boolean,
  ) {
    keyRef.current += 1;
    const key = keyRef.current;
    setRows((current) => [...current, { key, n, kind, label, detail, pending }]);
  }

  function completeRow(
    n: number,
    kind: TraceRow["kind"],
    label: string,
    summary: string,
    replaceDetail: boolean,
  ) {
    setRows((current) => {
      const index = current.findIndex((row) => row.pending && row.n === n);
      if (index === -1) {
        // No pending row (standalone warning), append it.
        keyRef.current += 1;
        return [
          ...current,
          { key: keyRef.current, n, kind, label, detail: summary, pending: false },
        ];
      }
      const next = [...current];
      const row = next[index];
      next[index] = {
        ...row,
        kind,
        label,
        detail: replaceDetail || !row.detail ? summary : `${row.detail}, ${summary}`,
        pending: false,
      };
      return next;
    });
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
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                void start();
              }
            }}
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

        <ul className="space-y-0.5 text-xs text-muted">
          <li>{d.guards.readonly}</li>
          <li>{d.guards.searchCap}</li>
        </ul>

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
          <SectionTitle>{d.trace.title}</SectionTitle>
          <div aria-live="polite">
            <TraceList rows={rows} />
          </div>
        </div>
      )}

      {brief && (
        <div className="space-y-5">
          <BriefView
            brief={brief}
            citations={citations}
            briefLabel={d.trace.answer}
            citedLabel={d.ask.citedLabel}
          />
          {runId && phase === "done" && (
            <p className="text-sm">
              <Link href={`/history/${runId}`} className={`text-muted ${linkClass}`}>
                {d.ask.viewRun}
              </Link>
            </p>
          )}
        </div>
      )}

      {phase === "stopped" && <EmptyState>{d.ask.stopped}</EmptyState>}

      {phase === "error" && (
        <ErrorBox
          title={errorMessage(d.ask, errorKind)}
          action={
            <button type="button" className={btnSecondary} onClick={() => void start()}>
              {d.ask.retry}
            </button>
          }
        />
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
