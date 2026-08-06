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
  /**
   * The loop guard is deliberately left in place, not cleared on success.
   *
   * It expires by itself in thirty seconds, which is already all a later
   * snapshot expiry needs in order to bounce again — the snapshot lives five
   * minutes, so the guard is always long gone by then. Clearing it here instead
   * would mean that whenever the gate *cannot* read the snapshot this route has
   * just re-issued, the two would hand the request back and forth forever: the
   * gate bounces, this route succeeds and clears the guard, the gate bounces
   * again. Keeping it turns that disagreement into one wasted round trip and
   * then an honest /login, which is a failure a user can actually recover from.
   */
  return res;
}
