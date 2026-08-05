import { NextResponse, type NextRequest } from "next/server";

import { auth } from "~/server/auth";

/**
 * Re-issues the cookie-cache snapshot the edge gate reads.
 *
 * The gate can only verify a signed snapshot, and that snapshot expires every
 * five minutes while the DB session lives for thirty days. Without this
 * bounce, every idle user would be silently logged out. getSession re-issues
 * the snapshot via setCookieCache; we copy its Set-Cookie headers onto a
 * redirect back to wherever the user was going.
 *
 * Node runtime: Better Auth's session lookup needs the database.
 */
export const runtime = "nodejs";

/** Only same-origin relative paths — never an attacker-supplied absolute URL. */
function safeTarget(raw: string | null): string {
  if (!raw) return "/portal";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/portal";
  return raw;
}

export async function GET(req: NextRequest) {
  const to = safeTarget(req.nextUrl.searchParams.get("to"));

  const { headers, response } = await auth.api.getSession({
    headers: req.headers,
    returnHeaders: true,
  });

  if (!response?.session) {
    const login = new URL("/login", req.url);
    login.searchParams.set("next", to);
    const dead = NextResponse.redirect(login);
    dead.cookies.delete("svr");
    return dead;
  }

  const res = NextResponse.redirect(new URL(to, req.url));
  headers.getSetCookie().forEach((cookie) => {
    res.headers.append("set-cookie", cookie);
  });
  // The session is live again — clear the loop guard so a later expiry can
  // bounce once more.
  res.cookies.delete("svr");
  return res;
}
