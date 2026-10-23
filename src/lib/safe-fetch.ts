import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Server-side fetches of user-supplied URLs must not reach the host's own
// network (localhost, cloud metadata at 169.254.169.254, private ranges).
// Every hop of a redirect chain is checked, not just the first URL.

const MAX_REDIRECTS = 5;

const BLOCKED_V4: Array<[string, number]> = [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, cloud metadata
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, broadcast
];

function v4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function isPublicV4(ip: string): boolean {
  const n = v4ToInt(ip);
  return !BLOCKED_V4.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (n & mask) === (v4ToInt(base) & mask);
  });
}

/** Expand an IPv6 address to its 8 hextets. */
function v6Hextets(ip: string): number[] {
  let addr = ip.toLowerCase().split("%")[0];
  // Trailing dotted IPv4 (::ffff:1.2.3.4) → two hextets.
  const dotted = /(\d+\.\d+\.\d+\.\d+)$/.exec(addr);
  if (dotted) {
    const n = v4ToInt(dotted[1]);
    addr = addr.slice(0, -dotted[1].length) + `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const [head, tail] = addr.split("::");
  const left = head ? head.split(":") : [];
  const right = tail !== undefined && tail !== "" ? tail.split(":") : [];
  const fill = tail === undefined ? [] : new Array(8 - left.length - right.length).fill("0");
  return [...left, ...fill, ...right].map((h) => parseInt(h, 16));
}

function isPublicV6(ip: string): boolean {
  const h = v6Hextets(ip);
  if (h.length !== 8 || h.some(Number.isNaN)) return false;
  const embeddedV4 = () => `${h[6] >> 8}.${h[6] & 255}.${h[7] >> 8}.${h[7] & 255}`;
  if (h.slice(0, 7).every((x) => x === 0)) return false; // :: and ::1
  if (h.slice(0, 5).every((x) => x === 0) && h[5] === 0xffff) {
    return isPublicV4(embeddedV4()); // IPv4-mapped
  }
  if (h[0] === 0x64 && h[1] === 0xff9b && h.slice(2, 6).every((x) => x === 0)) {
    return isPublicV4(embeddedV4()); // NAT64
  }
  if ((h[0] & 0xfe00) === 0xfc00) return false; // unique local fc00::/7
  if ((h[0] & 0xffc0) === 0xfe80) return false; // link-local fe80::/10
  if ((h[0] & 0xff00) === 0xff00) return false; // multicast
  if (h[0] === 0x2001 && h[1] === 0x0db8) return false; // documentation
  return true;
}

/** True when `ip` is a routable public address. */
export function isPublicAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isPublicV4(ip);
  if (family === 6) return isPublicV6(ip);
  return false;
}

/** Throws "blocked-url" unless `url` is http(s) and resolves only to public IPs. */
export async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("invalid-url");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost")) {
    throw new Error("blocked-url");
  }
  const addresses = isIP(host)
    ? [host]
    : (await lookup(host, { all: true, verbatim: true }).catch(() => {
        throw new Error("fetch-failed");
      })).map((a) => a.address);
  if (addresses.length === 0 || !addresses.every(isPublicAddress)) {
    throw new Error("blocked-url");
  }
}

/**
 * fetch() for untrusted URLs: redirects are followed by hand so each hop
 * is validated. A DNS answer could still change between this check and
 * the connection (rebinding); pinning the resolved IP would need a custom
 * HTTP agent, which this demo doesn't carry.
 */
export async function safeFetch(input: URL, init: RequestInit = {}): Promise<Response> {
  let url = input;
  for (let hop = 0; ; hop++) {
    await assertPublicUrl(url);
    const response = await fetch(url, { ...init, redirect: "manual" });
    const location = response.headers.get("location");
    if (response.status < 300 || response.status >= 400 || !location) {
      return response;
    }
    if (hop === MAX_REDIRECTS) throw new Error("fetch-failed");
    url = new URL(location, url);
  }
}
