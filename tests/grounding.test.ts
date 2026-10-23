import { describe, expect, it } from "vitest";
import { checkGrounding, significantNumbers } from "@/lib/grounding";

const pages = [
  { text: "Revenue grew 12% in 2024 to 1,200 million euros." },
  { text: "The survey covered 3.5 thousand firms across 14 countries." },
];

describe("significantNumbers", () => {
  it("keeps multi-digit and decimal numbers, ignores markers and single digits", () => {
    expect(significantNumbers("In 2024 revenue grew 12% [1] across 3 regions and 3.5 units")).toEqual([
      "2024",
      "12",
      "3.5",
    ]);
  });
  it("normalises thousands separators", () => {
    expect(significantNumbers("about 1,200 million")).toEqual(["1200"]);
  });
});

describe("checkGrounding", () => {
  it("accepts figures found in the cited page", () => {
    expect(checkGrounding("Revenue grew 12% in 2024 [1]. It reached 1,200 million [1].", pages)).toEqual([]);
  });

  it("flags a figure that is not in the page it cites", () => {
    const issues = checkGrounding("Revenue grew 15% in 2024 [1].", pages);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: "number", detail: "15 not found in [1]" });
  });

  it("flags a figure cited to the wrong page", () => {
    const issues = checkGrounding("The survey covered 14 countries [1].", pages);
    expect(issues[0]?.detail).toBe("14 not found in [1]");
  });

  it("does not let 3.5 match inside 13.5 or 35", () => {
    expect(checkGrounding("About 3.5 thousand firms [2].", pages)).toEqual([]);
    expect(checkGrounding("About 13.5 thousand firms [2].", pages)[0]?.kind).toBe("number");
  });

  it("lets a sentence use the citation at the end of its bullet", () => {
    expect(checkGrounding("- Growth was 12% in 2024. Strong year overall [1]", pages)).toEqual([]);
  });

  it("flags an uncited figure and an uncited finding", () => {
    const brief = [
      "Verdict: growth was strong, around 12% last year.",
      "- Firms in many countries reported the same trend over the period studied",
      "- Short note",
    ].join("\n");
    expect(checkGrounding(brief, pages).map((i) => i.kind)).toEqual(["uncited", "uncited"]);
  });

  it("does not ask for a source for numbers taken from the question", () => {
    const verdict = "Verdict: the 2024 total is not established by these sources.";
    expect(checkGrounding(verdict, pages, "How many cars were sold in 2024?")).toEqual([]);
    expect(checkGrounding(verdict, pages)[0]?.kind).toBe("uncited");
  });

  it("ignores markers that point to no page", () => {
    const issues = checkGrounding("- Revenue grew 12% in 2024 across the whole sector [7]", pages);
    expect(issues[0]?.kind).toBe("uncited");
  });
});
