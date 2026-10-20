import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/* --- Buttons: single source of truth (h-9 control height) --- */

export const btnBase =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-3.5 text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow,opacity] cursor-pointer disabled:cursor-not-allowed disabled:opacity-45";

export const btnPrimary = cn(
  btnBase,
  "bg-foreground text-background shadow-[0_1px_0_rgb(0_0_0/0.08),inset_0_1px_0_rgb(255_255_255/0.08)] hover:bg-foreground/85",
);

export const btnSecondary = cn(
  btnBase,
  "border border-border bg-background text-foreground shadow-[0_1px_0_rgb(0_0_0/0.03)] hover:border-border-strong hover:bg-surface/60",
);

export const btnDanger = cn(
  btnBase,
  "border border-border bg-background text-danger hover:border-danger-border hover:bg-danger-soft",
);

export const btnGhost =
  "inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground cursor-pointer";

export const btnAdd =
  "inline-flex h-9 items-center justify-center rounded-md border border-dashed border-border-strong px-3 text-xs font-medium text-muted transition-colors hover:border-muted hover:text-foreground cursor-pointer";

export const btnRow =
  "inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-border px-2.5 text-xs text-muted transition-colors hover:border-border-strong hover:text-foreground cursor-pointer disabled:opacity-50";

export const linkClass =
  "underline decoration-border-strong underline-offset-4 transition-colors hover:text-foreground hover:decoration-current";

/* --- Fields --- */

export const labelClass = "block text-sm font-medium mb-1.5";

const fieldBase =
  "w-full min-w-0 rounded-md border border-border bg-background text-sm shadow-[inset_0_1px_1px_rgb(0_0_0/0.02)] transition-[border-color,box-shadow] placeholder:text-muted/70 hover:border-border-strong focus:outline-none focus:border-accent focus:ring-3 focus:ring-accent-soft disabled:cursor-not-allowed disabled:opacity-60";

export const inputClass = cn(fieldBase, "h-9 px-2.5");

export const inputLargeClass = cn(fieldBase, "h-10 px-3");

export const areaClass = cn(fieldBase, "px-3 py-2.5 leading-relaxed");

export const selectClass = cn(fieldBase, "h-9 px-2.5");

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
        <PageTitle>{title}</PageTitle>
        {description && (
          <p className="mt-2 max-w-prose text-[0.9375rem] leading-relaxed text-muted">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0 pt-1">{action}</div>}
    </div>
  );
}

export function PageTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="font-serif text-[1.75rem] leading-tight font-semibold tracking-[-0.015em] break-words">
      {children}
    </h1>
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
        "rounded-lg border border-border bg-background p-4 sm:p-5",
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <SectionLabel>{title}</SectionLabel>
        {action}
      </div>
      <div className="space-y-3 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[0.6875rem] font-semibold tracking-[0.08em] text-muted uppercase">
      {children}
    </h2>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3">
      <SectionLabel>{children}</SectionLabel>
    </div>
  );
}

export function Meta({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-relaxed text-muted">{children}</p>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border-strong px-4 py-3.5 text-sm text-muted">
      {children}
    </p>
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-surface px-2.5 py-0.5 text-xs text-muted ring-1 ring-border ring-inset">
      {children}
    </span>
  );
}

/* Long-form generated text (answers, briefs): a quiet panel with a thin
   accent rule so it reads as "the result" without shouting. */
export function Prose({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface/40 px-4 py-4 sm:px-5">
      <div className="space-y-3 border-l-2 border-accent/50 pl-4 text-[0.9375rem] leading-7 break-words">
        <RichText text={text} />
      </div>
    </div>
  );
}

/* Light formatting for model output: "- " bullets become a list, a short
   "Label:" at line start is set in semibold, [n] markers become quiet
   superscripts, **bold** is honoured. Anything else stays as written. */
function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let list: string[] = [];

  const flushPara = () => {
    if (para.length === 0) return;
    const lines = para;
    blocks.push(
      <p key={blocks.length}>
        {lines.map((line, i) => (
          <span key={i}>
            {i > 0 && <br />}
            {inline(line, true)}
          </span>
        ))}
      </p>,
    );
    para = [];
  };
  const flushList = () => {
    if (list.length === 0) return;
    const items = list;
    blocks.push(
      <ul key={blocks.length} className="list-disc space-y-1 pl-5 marker:text-muted">
        {items.map((item, i) => (
          <li key={i}>{inline(item, false)}</li>
        ))}
      </ul>,
    );
    list = [];
  };

  for (const raw of text.split("\n")) {
    const bullet = raw.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (bullet) {
      flushPara();
      list.push(bullet[1]);
    } else if (!raw.trim()) {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(raw.trim());
    }
  }
  flushPara();
  flushList();
  return <>{blocks}</>;
}

function inline(line: string, allowLabel: boolean): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = line;
  const label = allowLabel ? rest.match(/^([^:[\]*]{2,32}):(\s|$)/) : null;
  if (label) {
    out.push(
      <span key="label" className="font-semibold">
        {label[1]}:
      </span>,
    );
    rest = rest.slice(label[1].length + 1);
  }
  // Runs like "[1][2]" or "[1, 2]" become one marker: "1,2".
  const parts = rest.split(/((?:\s?\[\d+(?:,\s*\d+)*\])+|\*\*[^*]+\*\*)/g);
  parts.forEach((part, i) => {
    if (!part) return;
    if (/^(?:\s?\[\d+(?:,\s*\d+)*\])+$/.test(part)) {
      const nums = part.match(/\d+/g) ?? [];
      out.push(
        <sup
          key={i}
          className="ml-0.5 font-mono text-[0.6875rem] font-medium text-accent"
        >
          {nums.join(",")}
        </sup>,
      );
    } else if (part.startsWith("**") && part.endsWith("**")) {
      out.push(
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>,
      );
    } else {
      out.push(part);
    }
  });
  return out;
}

/* Numbered source list shared by answers and briefs. */
export function SourceList({
  items,
}: {
  items: { key: string | number; n: number; title: string; href?: string; detail?: string }[];
}) {
  return (
    <ol className="divide-y divide-border border-y border-border">
      {items.map((item) => (
        <li key={item.key} className="flex gap-3 py-3 text-sm">
          <span className="w-5 shrink-0 pt-px text-right font-mono text-xs text-muted tabular-nums">
            {item.n}
          </span>
          <div className="min-w-0 flex-1">
            {item.href ? (
              <a
                href={item.href}
                target="_blank"
                rel="noreferrer noopener"
                className="font-medium text-foreground decoration-border-strong underline-offset-4 hover:underline"
              >
                {item.title}
              </a>
            ) : (
              <p className="font-medium">{item.title}</p>
            )}
            {item.detail && (
              <p className="mt-0.5 line-clamp-3 break-words text-muted">
                {plainExcerpt(item.detail)}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

// Excerpts are raw chunks: drop markdown heading/emphasis markers.
function plainExcerpt(text: string): string {
  return text
    .replace(/(^|\s)#{1,6}\s+/g, "$1")
    .replace(/\*\*|__/g, "")
    .replace(/\s+/g, " ")
    .trim();
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
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-lg border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        {message && <p className="mt-0.5 opacity-90">{message}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
