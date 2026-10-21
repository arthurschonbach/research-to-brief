import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { getDictionary, format, formatDateTime } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { listRuns, parseSteps, type RunRow } from "@/lib/db";
import { EmptyState, PageHeader } from "@/components/ui";

export default async function Page() {
  const d = getDictionary(await getLocale());

  return (
    <div className="space-y-8">
      <PageHeader title={d.history.title} />
      <Suspense fallback={null}>
        <RunsList />
      </Suspense>
    </div>
  );
}

function statusTone(status: RunRow["status"]): string {
  switch (status) {
    case "done":
      return "text-muted";
    case "stopped":
      return "text-warning font-medium";
    case "failed":
      return "text-danger font-medium";
    default:
      return "text-muted";
  }
}

async function RunsList() {
  await connection();
  const runs = await listRuns();
  const locale = await getLocale();
  const d = getDictionary(locale);

  if (runs.length === 0) {
    return <EmptyState>{d.history.empty}</EmptyState>;
  }

  const statusLabel: Record<RunRow["status"], string> = {
    done: d.history.statusDone,
    stopped: d.history.statusStopped,
    failed: d.history.statusFailed,
    running: d.history.statusRunning,
  };

  function stepCountText(count: number): string {
    return count === 1
      ? d.history.stepsCountOne
      : format(d.history.stepsCount, { n: count });
  }

  return (
    <ul className="m-0 list-none p-0">
      {runs.map((run) => (
        <li key={run.id} className="border-b border-border last:border-b-0">
          <Link
            href={`/history/${run.id}`}
            className="group flex items-center justify-between gap-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-accent">
                {run.question}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted">
                {[
                  formatDateTime(run.created_at, locale),
                  stepCountText(parseSteps(run.steps).length),
                ].join(" · ")}
              </p>
            </div>
            <span className={`shrink-0 text-xs ${statusTone(run.status)}`}>
              {statusLabel[run.status]}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
