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
    {
      href: "/history",
      label: d.nav.history,
      active:
        pathname.startsWith("/history"),
    },
  ];

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-[680px] flex-wrap items-baseline justify-between gap-x-4 gap-y-2 px-5 py-5">
        <Link
          href="/"
          className="font-semibold tracking-tight text-foreground no-underline"
        >
          {d.brand}
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={link.active ? "page" : undefined}
              className={cn(
                "transition-colors",
                link.active
                  ? "text-accent font-medium"
                  : "text-muted hover:text-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}
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
      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-muted transition-colors hover:border-muted hover:text-foreground cursor-pointer"
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
