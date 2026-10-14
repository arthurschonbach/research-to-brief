export interface TraceRowData {
  key: string | number;
  kind: string;
  label: string;
  detail: string;
}

function tone(kind: string): string {
  switch (kind) {
    case "plan":
      return "text-accent";
    case "search":
    case "fetch":
      return "text-foreground";
    case "skip-blocked":
    case "skip-repeat":
    case "warning":
      return "text-warning";
    case "answer":
      return "text-accent";
    default:
      return "text-muted";
  }
}

export function TraceList({ rows }: { rows: TraceRowData[] }) {
  if (rows.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {rows.map((row) => (
        <li
          key={row.key}
          className="flex items-baseline gap-2.5 rounded-md border border-border px-3 py-2 text-sm"
        >
          <span className={`shrink-0 text-xs font-medium ${tone(row.kind)}`}>
            {row.label}
          </span>
          <span className="min-w-0 truncate text-muted" title={row.detail}>
            {row.detail}
          </span>
        </li>
      ))}
    </ul>
  );
}
