import Link from "next/link";
import { getDictionary, format, formatDateTime } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { getRun, parseCited, parseSteps } from "@/lib/db";
import { deleteRunAction } from "@/lib/actions";
import { TraceList } from "@/components/TraceList";
import { BriefView } from "@/components/BriefView";
import {
  EmptyState,
  ErrorBox,
  PageTitle,
  SectionTitle,
  btnDanger,
  btnGhost,
} from "@/components/ui";
import { getVisitorId } from "@/lib/visitor";

export const instant = false;

function stepLabel(kind: string, d: ReturnType<typeof getDictionary>): string {
  switch (kind) {
    case "plan":
      return d.trace.plan;
    case "search":
      return d.trace.searched;
    case "fetch":
      return d.trace.read;
    case "skip-blocked":
      return d.trace.skipped;
    case "skip-repeat":
      return d.trace.repeated;
    case "warning":
      return d.trace.warning;
    case "answer":
      return d.trace.answer;
    default:
      return kind;
  }
}

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((e): e is string => typeof e === "string")
      : [];
  } catch {
    return [];
  }
}

export default async function Page({ params }: PageProps<"/history/[id]">) {
  const { id } = await params;
  const run = await getRun(await getVisitorId(), id);

  const locale = await getLocale();
  const d = getDictionary(locale);

  // Demo deployments (Vercel) keep sqlite in instance-local /tmp: a run
  // saved on one instance 404s on another. Explain instead of a dead end.
  if (!run) {
    return (
      <div className="space-y-8">
        <Link href="/history" className={btnGhost}>
          {d.history.back}
        </Link>
        <EmptyState>{`${d.history.notFound} — ${d.history.notFoundHint}`}</EmptyState>
      </div>
    );
  }

  const steps = parseSteps(run.steps);
  const cited = parseCited(run.cited);
  const plan = parseStringArray(run.plan);
  const blocklist = parseStringArray(run.blocklist);

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link href="/history" className={btnGhost}>
          {d.history.back}
        </Link>
        <PageTitle>{run.question}</PageTitle>
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm text-muted">
            {[
              formatDateTime(run.created_at, locale),
              run.model,
              run.latency_ms != null ? `${Math.round(run.latency_ms / 1000)}s` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <form action={deleteRunAction} className="shrink-0">
            <input type="hidden" name="run_id" value={run.id} />
            <button type="submit" className={btnDanger}>
              {d.history.delete}
            </button>
          </form>
        </div>
        <p className="text-xs text-muted">
          {d.detail.guardsLabel}: {format(d.detail.guardsMax, { n: run.max_steps })}
          {" · "}
          {blocklist.length > 0
            ? format(d.detail.guardsBlocked, { domains: blocklist.join(", ") })
            : d.detail.guardsNoneBlocked}
        </p>
      </div>

      {run.error && (
        <ErrorBox title={run.error} />
      )}

      {steps.length > 0 && (
        <div>
          <SectionTitle>{d.trace.title}</SectionTitle>
          <TraceList
            rows={steps.map((s) => ({
              key: s.n,
              kind: s.kind,
              label: stepLabel(s.kind, d),
              detail: s.detail,
            }))}
          />
        </div>
      )}

      {plan.length > 0 && (
        <div>
          <SectionTitle>{d.detail.planLabel}</SectionTitle>
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted">
            {plan.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      {run.brief ? (
        <BriefView
          brief={run.brief}
          citations={cited}
          briefLabel={d.trace.answer}
          citedLabel={d.ask.citedLabel}
        />
      ) : run.status === "stopped" ? (
        <EmptyState>{d.trace.cancelled}</EmptyState>
      ) : null}
    </div>
  );
}
