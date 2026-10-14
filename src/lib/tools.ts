import * as cheerio from "cheerio";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

const DDG_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function decodeDuckUrl(href: string): string | null {
  // Real results link via //duckduckgo.com/l/?uddg=<encoded>&rut=…
  // Ads (y.js) and internal links are skipped.
  const absolute = href.startsWith("//") ? `https:${href}` : href;
  let parsed: URL;
  try {
    parsed = new URL(absolute);
  } catch {
    return null;
  }
  const uddg = parsed.searchParams.get("uddg");
  if (!uddg) return null;
  try {
    const target = new URL(uddg);
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      return null;
    }
    // Ads and internal redirects point back at duckduckgo.com, skip them.
    if (target.hostname.toLowerCase().endsWith("duckduckgo.com")) {
      return null;
    }
    return target.toString();
  } catch {
    return null;
  }
}

/** Search backend chain: Tavily → Brave → DuckDuckGo (keyless).
 *  First configured backend wins. Each throws a short reason on failure. */
export async function webSearch(
  query: string,
  limit: number = 5,
): Promise<SearchResult[]> {
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (tavilyKey) return tavilySearch(query, tavilyKey, limit);
  const braveKey = process.env.BRAVE_API_KEY;
  if (braveKey) return braveSearch(query, braveKey, limit);
  return duckSearch(query, limit);
}

async function tavilySearch(
  query: string,
  apiKey: string,
  limit: number,
): Promise<SearchResult[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: Math.min(10, Math.max(1, limit)),
        search_depth: "basic",
        include_answer: false,
      }),
    });
    if (!response.ok) throw new Error(`tavily status ${response.status}`);
    const json = (await response.json()) as {
      results?: Array<{ title?: string; url?: string; content?: string }>;
    };
    const out: SearchResult[] = [];
    for (const r of json.results ?? []) {
      if (out.length >= limit) break;
      if (!r.url || !r.title) continue;
      try {
        const u = new URL(r.url);
        if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      } catch {
        continue;
      }
      out.push({ title: r.title, url: r.url, snippet: r.content ?? "" });
    }
    return out;
  } catch (error) {
    throw new Error(
      `search failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

async function braveSearch(
  query: string,
  apiKey: string,
  limit: number,
): Promise<SearchResult[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${Math.min(10, Math.max(1, limit))}`,
      {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "X-Subscription-Token": apiKey,
        },
      },
    );
    if (!response.ok) throw new Error(`brave status ${response.status}`);
    const json = (await response.json()) as {
      web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
    };
    const out: SearchResult[] = [];
    for (const r of json.web?.results ?? []) {
      if (out.length >= limit) break;
      if (!r.url || !r.title) continue;
      try {
        const u = new URL(r.url);
        if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      } catch {
        continue;
      }
      out.push({ title: r.title, url: r.url, snippet: r.description ?? "" });
    }
    return out;
  } catch (error) {
    throw new Error(
      `search failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

async function duckSearch(query: string, limit: number): Promise<SearchResult[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  let html: string;
  try {
    const response = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      { signal: controller.signal, headers: { "user-agent": DDG_UA } },
    );
    if (!response.ok) throw new Error(`DDG status ${response.status}`);
    html = await response.text();
  } catch (error) {
    throw new Error(
      `search failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    clearTimeout(timer);
  }

  const $ = cheerio.load(html);
  const results: SearchResult[] = [];
  // DDG serves an HTTP-200/202 challenge page when rate-limited. It has
  // no .result blocks, so it would silently look like "no results".
  if ($(".result").length === 0) {
    if (/challenge|captcha/i.test(html)) {
      throw new Error("search-rate-limited");
    }
    return [];
  }
  $(".result").each((_, el) => {
    if (results.length >= limit) return;
    const link = $(el).find(".result__a").first();
    const url = link.length ? decodeDuckUrl(link.attr("href") ?? "") : null;
    if (!url) return; // ad or internal link
    const title = link.text().trim().replace(/\s+/g, " ");
    if (!title) return;
    const snippet = $(el)
      .find(".result__snippet")
      .first()
      .text()
      .trim()
      .replace(/\s+/g, " ");
    // De-duplicate by hostname+path.
    if (results.some((r) => r.url === url)) return;
    results.push({ title, url, snippet });
  });
  return results;
}

export interface FetchedPage {
  title: string;
  text: string;
  finalUrl: string;
}

/** Keyless readable-text page fetch. Throws with a short reason. */
export async function fetchPage(raw: string): Promise<FetchedPage> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("invalid-url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("invalid-url");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "research-to-brief/0.1" },
      redirect: "follow",
    });
  } catch {
    throw new Error("fetch-failed");
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) throw new Error("fetch-failed");

  const contentType = response.headers.get("content-type") ?? "";
  const capped = await readCapped(response.body, 2_000_000);
  const decoded = new TextDecoder().decode(capped);

  if (
    contentType.includes("text/plain") ||
    contentType.includes("text/markdown")
  ) {
    return { title: url.hostname + url.pathname, text: decoded.trim(), finalUrl: response.url };
  }
  if (!contentType.includes("html")) throw new Error("unsupported-type");

  const $ = cheerio.load(decoded);
  $("script, style, noscript, nav, header, footer, aside").remove();
  const title = $("title").first().text().trim() || url.hostname;
  const main =
    $("article").first().text() ||
    $('main, [role="main"]').first().text() ||
    $("body").text();
  const text = main.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
  if (!text) throw new Error("empty");
  return { title, text, finalUrl: response.url };
}

/** Substring match on hostname (case-insensitive). Empty entries ignored. */
export function isBlocked(url: string, blocklist: string[]): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return true; // unparseable → treat as blocked
  }
  return blocklist
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .some((entry) => host.includes(entry));
}

async function readCapped(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<Uint8Array> {
  if (!body) return new Uint8Array();
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      chunks.push(value.subarray(0, maxBytes - (total - value.byteLength)));
      break;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(Math.min(total, maxBytes));
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}
