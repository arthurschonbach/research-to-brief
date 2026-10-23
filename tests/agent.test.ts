import { describe, expect, it } from "vitest";
import { z } from "zod";
import { PlanSchema, parseJsonAction } from "@/lib/agent";

describe("parseJsonAction", () => {
  it("accepts JSON wrapped in fences and prose", () => {
    const text = 'Sure!\n```json\n{"searches": [{"query": "eu ai act fines", "why": "penalties"}]}\n```\nHope this helps.';
    expect(parseJsonAction(text, PlanSchema)).toEqual({
      ok: true,
      value: { searches: [{ query: "eu ai act fines", why: "penalties" }] },
    });
  });

  it("reports schema issues so the repair prompt can quote them", () => {
    const result = parseJsonAction('{"searches": []}', PlanSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("searches");
  });

  it("fails cleanly on output with no JSON", () => {
    expect(parseJsonAction("I cannot help with that.", PlanSchema)).toEqual({ ok: false, reason: "no JSON found" });
  });

  it("parses a bare array when the schema wants one", () => {
    expect(parseJsonAction('["a", "b"] trailing', z.array(z.string()))).toEqual({ ok: true, value: ["a", "b"] });
  });
});
