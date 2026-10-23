import { describe, expect, it } from "vitest";
import { windowStart } from "@/lib/rate-limit";
import { clientIp } from "@/lib/visitor";
import { isUuid } from "@/lib/visitor-id";

describe("clientIp", () => {
  it("takes the first x-forwarded-for entry", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });
  it("falls back to x-real-ip, then to a shared bucket", () => {
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("windowStart", () => {
  it("aligns timestamps to the start of their window", () => {
    expect(windowStart(0, 60)).toBe(0);
    expect(windowStart(59_999, 60)).toBe(0);
    expect(windowStart(60_000, 60)).toBe(60_000);
    expect(windowStart(125_000, 60)).toBe(120_000);
  });
});

describe("isUuid", () => {
  it("accepts v4 ids and rejects anything else", () => {
    expect(isUuid(crypto.randomUUID())).toBe(true);
    expect(isUuid("1; DROP TABLE documents")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});
