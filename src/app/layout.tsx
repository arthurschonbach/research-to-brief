import type { Metadata } from "next";
import Script from "next/script";
import { SiteHeader } from "@/components/SiteHeader";
import { LocaleProvider } from "@/components/LocaleProvider";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import "./globals.css";

export const metadata: Metadata = {
  title: "Research → Brief",
  description:
    "An agent that plans web searches, reads pages, and writes cited briefs — with guardrails.",
};

export const instant = false;

const THEME_INIT = `(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t}else if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.dataset.theme='dark'}}catch(e){}})();`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const d = getDictionary(locale);

  return (
    <html lang={locale} className="h-full" suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_INIT }}
        />
        <LocaleProvider initialLocale={locale}>
          <SiteHeader />
          <main className="mx-auto w-full max-w-[680px] flex-1 px-5 py-12">
            {children}
          </main>
          <footer className="border-t border-border">
            <div className="mx-auto w-full max-w-[680px] px-5 py-6 text-xs leading-relaxed text-muted">
              {d.footer.disclaimer}
            </div>
          </footer>
        </LocaleProvider>
      </body>
    </html>
  );
}
