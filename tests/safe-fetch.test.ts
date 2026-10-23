import { afterEach, describe, expect, it, vi } from "vitest";
import { assertPublicUrl, isPublicAddress, safeFetch } from "@/lib/safe-fetch";

describe("isPublicAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "64:ff9b::a9fe:a9fe",
    "2001:db8::1",
    "not-an-ip",
  ])("blocks %s", (ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });

  it.each(["1.1.1.1", "8.8.8.8", "172.32.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"])(
    "allows %s",
    (ip) => {
      expect(isPublicAddress(ip)).toBe(true);
    },
  );
});

describe("assertPublicUrl", () => {
  it("rejects non-http schemes", async () => {
    await expect(assertPublicUrl(new URL("file:///etc/passwd"))).rejects.toThrow("invalid-url");
  });
  it.each([
    "http://localhost:3000/",
    "http://app.localhost/",
    "http://127.0.0.1/",
    "http://[::1]/",
    "http://169.254.169.254/latest/meta-data/",
    // The URL parser normalises these to 127.0.0.1.
    "http://2130706433/",
    "http://0x7f.1/",
  ])("blocks %s", async (url) => {
    await expect(assertPublicUrl(new URL(url))).rejects.toThrow("blocked-url");
  });
});

describe("safeFetch", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("re-checks every redirect hop", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(safeFetch(new URL("http://1.1.1.1/"))).rejects.toThrow("blocked-url");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns the final response of a public redirect chain", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: "/next" } }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await safeFetch(new URL("http://1.1.1.1/start"));
    expect(await res.text()).toBe("ok");
    expect(String(fetchMock.mock.calls[1][0])).toBe("http://1.1.1.1/next");
  });

  it("gives up after too many redirects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 302, headers: { location: "/loop" } })),
    );
    await expect(safeFetch(new URL("http://1.1.1.1/"))).rejects.toThrow("fetch-failed");
  });
});
