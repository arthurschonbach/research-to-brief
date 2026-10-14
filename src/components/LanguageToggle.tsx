"use client";

import { useI18n } from "./LocaleProvider";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/cn";

const OPTIONS: Locale[] = ["en", "fr"];

export function LanguageToggle() {
  const { locale, d, setLocale } = useI18n();

  return (
    <div
      role="group"
      aria-label={d.language.switchTo}
      className="inline-flex h-7 items-center overflow-hidden rounded-md border border-border bg-surface text-xs"
    >
      {OPTIONS.map((option) => {
        const active = option === locale;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => setLocale(option)}
            className={cn(
              "h-full px-2 uppercase tracking-wide transition-colors cursor-pointer",
              active
                ? "bg-foreground text-background font-medium"
                : "text-muted hover:text-foreground",
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
