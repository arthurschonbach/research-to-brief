import { NextResponse, type NextRequest } from "next/server";
import { VISITOR_COOKIE, VISITOR_MAX_AGE, isUuid } from "./lib/visitor-id";

// Give every visitor an anonymous id before anything renders, so pages,
// actions and route handlers can all scope their data to it.
export function proxy(request: NextRequest) {
  if (isUuid(request.cookies.get(VISITOR_COOKIE)?.value)) {
    return NextResponse.next();
  }
  const id = crypto.randomUUID();
  // Also set it on the forwarded request, so this first request sees it.
  request.cookies.set(VISITOR_COOKIE, id);
  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.set(VISITOR_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: VISITOR_MAX_AGE,
    path: "/",
  });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|webmanifest)$).*)"],
};
