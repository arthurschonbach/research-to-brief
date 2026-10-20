import type { CitedSource } from "@/lib/db";
import { Prose, SectionTitle, SourceList } from "./ui";

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// Host + path, so two pages from one site stay distinguishable.
function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/$/, "");
    return u.hostname.replace(/^www\./, "") + path;
  } catch {
    return url;
  }
}

export function BriefView({
  brief,
  citations,
  briefLabel,
  citedLabel,
}: {
  brief: string;
  citations: CitedSource[];
  briefLabel: string;
  citedLabel: string;
}) {
  return (
    <div className="space-y-8">
      <div>
        <SectionTitle>{briefLabel}</SectionTitle>
        <Prose text={brief} />
      </div>
      {citations.length > 0 && (
        <div>
          <SectionTitle>{citedLabel}</SectionTitle>
          <SourceList
            items={citations.map((c) => ({
              key: c.n,
              n: c.n,
              title: c.title || host(c.url),
              href: c.url,
              detail: shortUrl(c.url),
            }))}
          />
        </div>
      )}
    </div>
  );
}
