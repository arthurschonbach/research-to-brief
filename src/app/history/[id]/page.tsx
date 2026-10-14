import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, format, formatDateTime } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { getRun, parseCited, parseSteps } from "@/lib/db";
import { TraceList } from "@/components/TraceList";
import { EmptyState, SectionTitle, btnGhost } from "@/components/ui";

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
  const run = getRun(id);
  if (!run) notFound();

  const locale = await getLocale();
  const d = getDictionary(locale);
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
        <h1 className="text-2xl font-semibold tracking-tight">{run.question}</h1>
        <p className="text-sm text-muted">
          {[
            formatDateTime(run.created_at, locale),
            run.model,
            run.latency_ms != null ? `${Math.round(run.latency_ms / 1000)}s` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="text-xs text-muted">
          {d.detail.guardsLabel}: {format(d.detail.guardsMax, { n: run.max_steps })}
          {" · "}
          {blocklist.length > 0
            ? format(d.detail.guardsBlocked, { domains: blocklist.join(", ") })
            : d.detail.guardsNoneBlocked}
        </p>
      </div>

      {run.error && (
        <div className="rounded-md border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger">
          {run.error}
        </div>
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
        <div className="space-y-4">
          <div>
            <SectionTitle>{d.trace.answer}</SectionTitle>
            <div className="rounded-md border border-border p-4 sm:p-5">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {run.brief}
              </p>
            </div>
          </div>
          {cited.length > 0 && (
            <div>
              <SectionTitle>{d.ask.citedLabel}</SectionTitle>
              <ul className="space-y-2">
                {cited.map((c) => (
                  <li
                    key={c.n}
                    className="rounded-md border border-border p-3 text-sm"
                  >
                    <p className="text-xs font-medium text-muted">
                      [{c.n}] · {c.title}
                    </p>
                    <p className="mt-1 break-all text-muted">{c.url}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : run.status === "stopped" ? (
        <EmptyState>{d.trace.cancelled}</EmptyState>
      ) : null}
    </div>
  );
}
