export interface TraceRowData {
  key: string | number;
  kind: string;
  label: string;
  detail: string;
  pending?: boolean;
}

function tone(kind: string): { label: string; dot: string } {
  switch (kind) {
    case "plan":
    case "answer":
      return { label: "text-accent", dot: "bg-accent" };
    case "search":
    case "fetch":
      return { label: "text-foreground", dot: "bg-foreground/60" };
    case "skip-blocked":
    case "skip-repeat":
    case "warning":
      return { label: "text-warning", dot: "bg-warning" };
    default:
      return { label: "text-muted", dot: "bg-border-strong" };
  }
}

/* Vertical timeline: one hairline, a dot per step. Reads as a sequence
   without boxing every row. */
export function TraceList({ rows }: { rows: TraceRowData[] }) {
  if (rows.length === 0) return null;
  return (
    <ol className="relative ml-1 border-l border-border">
      {rows.map((row) => {
        const t = tone(row.kind);
        return (
          <li key={row.key} className="relative py-1.5 pl-5 text-sm">
            <span
              aria-hidden
              className={`absolute top-[0.9rem] -left-[4.5px] h-2 w-2 rounded-full ring-4 ring-background ${t.dot}${row.pending ? " animate-pulse" : ""}`}
            />
            <div className="flex min-w-0 items-baseline gap-2.5">
              <span
                className={`min-w-20 shrink-0 text-xs font-medium ${t.label}${row.pending ? " animate-pulse" : ""}`}
              >
                {row.label}
              </span>
              <span className="min-w-0 truncate text-muted" title={row.detail}>
                {row.detail}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
