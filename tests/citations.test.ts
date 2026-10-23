import { describe, expect, it } from "vitest";
import { excerpt, parseCitations, urlKey } from "@/lib/citations";

const pages = [1, 2, 3].map((n) => ({ url: `https://site${n}.com/a`, title: `Page ${n}`, text: `Text ${n}` }));

describe("parseCitations", () => {
  it("maps markers to pages, deduplicated and sorted", () => {
    expect(parseCitations("B [3]. A [1]. B [3].", pages).map((c) => [c.n, c.url])).toEqual([
      [1, "https://site1.com/a"],
      [3, "https://site3.com/a"],
    ]);
  });
  it("drops markers with no page behind them", () => {
    expect(parseCitations("[0] [4] [12]", pages)).toEqual([]);
  });
});

describe("urlKey", () => {
  it("treats tracking params, fragments, www and trailing slashes as the same page", () => {
    expect(urlKey("https://www.Example.com/post/?utm_source=x&id=2#top")).toBe(urlKey("https://example.com/post?id=2"));
  });
  it("keeps meaningful query params apart", () => {
    expect(urlKey("https://example.com/post?id=1")).not.toBe(urlKey("https://example.com/post?id=2"));
  });
});

describe("excerpt", () => {
  it("flattens whitespace and truncates with an ellipsis", () => {
    expect(excerpt("a\n\n  b", 10)).toBe("a b");
    expect(excerpt("x".repeat(30), 10)).toBe("xxxxxxxxxx…");
  });
});
