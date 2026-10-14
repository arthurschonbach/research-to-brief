import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/* --- Buttons: single source of truth (h-9 control height) --- */

export const btnBase =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50";

export const btnPrimary = cn(
  btnBase,
  "bg-foreground text-background hover:opacity-90",
);

export const btnSecondary = cn(
  btnBase,
  "border border-border bg-background text-foreground hover:border-muted",
);

export const btnDanger = cn(
  btnBase,
  "border border-danger-border bg-background text-danger hover:border-danger",
);

export const btnGhost =
  "inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground cursor-pointer";

export const btnAdd =
  "inline-flex h-9 items-center justify-center rounded-md border border-dashed border-border px-3 text-xs text-muted transition-colors hover:border-muted hover:text-foreground cursor-pointer";

export const btnRow =
  "inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-border px-2.5 text-xs text-muted transition-colors hover:border-muted hover:text-foreground cursor-pointer disabled:opacity-50";

/* --- Fields --- */

export const labelClass = "block text-sm font-medium mb-1.5";

export const inputClass =
  "h-9 w-full min-w-0 rounded-md border border-border bg-background px-2.5 text-sm transition-colors placeholder:text-muted/70 focus:outline-none focus:border-accent";

export const inputLargeClass =
  "h-10 w-full min-w-0 rounded-md border border-border bg-background px-3 text-sm transition-colors placeholder:text-muted/70 focus:outline-none focus:border-accent";

export const areaClass =
  "w-full min-w-0 rounded-md border border-border bg-background px-3 py-2 text-sm leading-relaxed transition-colors placeholder:text-muted/70 focus:outline-none focus:border-accent";

export const selectClass =
  "h-9 w-full min-w-0 rounded-md border border-border bg-background px-2.5 text-sm transition-colors focus:outline-none focus:border-accent";

/* --- Typography / layout --- */

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0 pt-0.5">{action}</div>}
    </div>
  );
}

export function SectionCard({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-md border border-border bg-background p-4 sm:p-5",
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
          {title}
        </h2>
        {action}
      </div>
      <div className="space-y-3 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
      {children}
    </h2>
  );
}

export function Meta({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-relaxed text-muted">{children}</p>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-border bg-surface/60 px-4 py-3 text-sm text-muted">
      {children}
    </p>
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-surface/60 px-2 py-0.5 text-xs text-muted">
      {children}
    </span>
  );
}

export function ErrorBox({
  title,
  message,
  action,
}: {
  title: string;
  message?: string | null;
  action?: ReactNode;
}) {
  if (!message && !title) return null;
  return (
    <div className="flex flex-col gap-3 rounded-md border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        {message && <p className="mt-0.5 opacity-90">{message}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
