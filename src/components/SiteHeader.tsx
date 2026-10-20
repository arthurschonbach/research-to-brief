"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LanguageToggle } from "./LanguageToggle";
import { useI18n } from "./LocaleProvider";
import { cn } from "@/lib/cn";

export function SiteHeader() {
  const { d } = useI18n();
  const pathname = usePathname();

  const links = [
    { href: "/", label: d.nav.new, active: pathname === "/" },
    { href: "/history", label: d.nav.history, active: pathname.startsWith("/history") },
  ];

  const [from, to] = d.brand.split("→").map((part) => part.trim());

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex min-h-14 w-full max-w-[680px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3">
        <Link
          href="/"
          aria-label={d.brand}
          className="inline-flex items-baseline gap-1.5 text-[0.9375rem] font-semibold tracking-tight text-foreground no-underline"
        >
          <span>{from}</span>
          {to && (
            <>
              <span aria-hidden className="font-normal text-accent">
                →
              </span>
              <span>{to}</span>
            </>
          )}
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={link.active ? "page" : undefined}
              className={cn(
                "rounded-md px-2.5 py-1 transition-colors",
                link.active
                  ? "bg-surface font-medium text-foreground"
                  : "text-muted hover:text-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}
          <span aria-hidden className="mx-1.5 h-4 w-px bg-border" />
          <ThemeToggle />
          <LanguageToggle />
        </nav>
      </div>
    </header>
  );
}

function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const current =
      root.dataset.theme === "dark" || root.dataset.theme === "light"
        ? root.dataset.theme
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    const next = current === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Private mode; ignore.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle color theme"
      title="Toggle color theme"
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-foreground cursor-pointer"
    >
      <svg className="theme-icon-sun" viewBox="0 0 24 24" width="15" height="15" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      <svg className="theme-icon-moon" viewBox="0 0 24 24" width="15" height="15" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    </button>
  );
}
