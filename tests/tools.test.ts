import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPage, isBlocked, webSearch } from "@/lib/tools";

afterEach(() => vi.unstubAllGlobals());

describe("isBlocked", () => {
  it("matches blocklist entries against the hostname, case-insensitively", () => {
    expect(isBlocked("https://www.Reddit.com/r/x", ["reddit.com"])).toBe(true);
    expect(isBlocked("https://example.com/reddit.com", ["reddit.com"])).toBe(false);
    expect(isBlocked("https://example.com", ["", "  "])).toBe(false);
  });
  it("treats unparseable URLs as blocked", () => {
    expect(isBlocked("not a url", [])).toBe(true);
  });
});

describe("webSearch (DuckDuckGo fallback)", () => {
  beforeEach(() => {
    vi.stubEnv("TAVILY_API_KEY", "");
    vi.stubEnv("BRAVE_API_KEY", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  const result = (href: string, title: string) =>
    `<div class="result"><a class="result__a" href="${href}">${title}</a><a class="result__snippet">snippet</a></div>`;

  it("decodes result links and skips ads and internal links", async () => {
    const html = [
      result("//duckduckgo.com/l/?uddg=" + encodeURIComponent("https://real.example/page") + "&rut=x", "Real"),
      result("//duckduckgo.com/y.js?ad_provider=x", "Ad"),
      result("//duckduckgo.com/l/?uddg=" + encodeURIComponent("https://duckduckgo.com/settings"), "Internal"),
    ].join("");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(html, { status: 200 })));
    expect(await webSearch("q")).toEqual([{ title: "Real", url: "https://real.example/page", snippet: "snippet" }]);
  });

  it("reports a rate-limit challenge instead of 'no results'", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<form>Please complete the challenge</form>", { status: 202 })));
    await expect(webSearch("q")).rejects.toThrow("search-rate-limited");
  });
});

describe("fetchPage", () => {
  it("keeps the article and drops page chrome", async () => {
    const html =
      "<html><head><title>T</title></head><body><nav>Menu</nav><article><p>Main text.</p></article><footer>F</footer></body></html>";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(html, { status: 200, headers: { "content-type": "text/html" } })),
    );
    const page = await fetchPage("https://1.1.1.1/post");
    expect(page.title).toBe("T");
    expect(page.text).toBe("Main text.");
  });

  it("refuses private addresses before any request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchPage("http://169.254.169.254/latest/meta-data/")).rejects.toThrow("blocked-url");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects non-HTML content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("%PDF", { status: 200, headers: { "content-type": "application/pdf" } })),
    );
    await expect(fetchPage("https://1.1.1.1/file.pdf")).rejects.toThrow("unsupported-type");
  });
});
