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
      className="inline-flex h-7 items-center gap-0.5 rounded-md bg-surface p-0.5 text-[0.6875rem]"
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
              "h-full rounded-[5px] px-2 font-medium tracking-wider uppercase transition-colors cursor-pointer",
              active
                ? "bg-background text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.08)] ring-1 ring-border"
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
