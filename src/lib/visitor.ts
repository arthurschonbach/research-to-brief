import { cookies, headers } from "next/headers";
import { VISITOR_COOKIE, isUuid } from "./visitor-id";

/**
 * Anonymous id of the current visitor. The demo has no accounts, so every
 * row is scoped to this id: visitors never see or delete each other's data.
 * The proxy guarantees the cookie exists before any page or action runs.
 */
export async function getVisitorId(): Promise<string> {
  const id = (await cookies()).get(VISITOR_COOKIE)?.value;
  if (!isUuid(id)) throw new Error("Missing visitor id (is the proxy running?)");
  return id;
}

/** Client IP for rate limiting, from the headers Vercel sets. */
export async function getClientIp(): Promise<string> {
  return clientIp(await headers());
}

export function clientIp(h: Headers): string {
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip")?.trim() || "unknown";
}
