import type { CitedSource } from "./db";

export function excerpt(text: string, max: number = 220): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? flat.slice(0, max).trimEnd() + "…" : flat;
}

/** Map [n] markers to the pages they number. Out-of-range markers are dropped. */
export function parseCitations(
  text: string,
  pages: Array<{ url: string; title: string; text: string }>,
): CitedSource[] {
  const citations: CitedSource[] = [];
  const seen = new Set<number>();
  for (const match of text.matchAll(/\[(\d+)\]/g)) {
    const n = Number(match[1]);
    if (!Number.isInteger(n) || n < 1 || n > pages.length || seen.has(n)) {
      continue;
    }
    seen.add(n);
    const page = pages[n - 1];
    citations.push({
      n,
      url: page.url,
      title: page.title,
      excerpt: excerpt(page.text),
    });
  }
  citations.sort((a, b) => a.n - b.n);
  return citations;
}

// Same page, different string: drop fragment, tracking params, "www.",
// trailing slash. Used to dedupe picks and fetched pages.
export function urlKey(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|ref$)/i.test(key)) u.searchParams.delete(key);
    }
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    return `${host}${u.pathname.replace(/\/+$/, "")}${u.search}`;
  } catch {
    return url.trim();
  }
}
