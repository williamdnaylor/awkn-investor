import { getCookieCache } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge gate for /portal.
 *
 * Everything else on this host — the client-authored decks at /,
 * /investor-presentation and /awkn-residences — is public and untouched.
 *
 * The gate only ever asks "is there a valid session snapshot?". Role and ban
 * state are deliberately NOT read here: the snapshot is up to five minutes
 * stale, so authorisation decisions belong to the DB-backed server layer.
 * That five minutes is the accepted revocation window for *navigation*; a
 * banned user's next server action still fails immediately.
 */
const PROTECTED_PREFIX = "/portal";

/** Reachable without a session — otherwise you could never obtain one. */
const AUTH_SURFACES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/api/auth",
  "/api/session-refresh",
];

const SESSION_COOKIES = [
  "__Secure-better-auth.session_token",
  "better-auth.session_token",
];

/** Loop guard: one refresh attempt per navigation, then fall through to login. */
const REFRESH_GUARD = "svr";

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (
    !pathname.startsWith(PROTECTED_PREFIX) ||
    AUTH_SURFACES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    return NextResponse.next();
  }

  const configured = Boolean(process.env.BETTER_AUTH_SECRET);

  if (!configured) {
    // Fail closed in production: an unconfigured gate must never read as open.
    if (process.env.VERCEL_ENV === "production") {
      return NextResponse.redirect(new URL("/login?error=unconfigured", req.url));
    }
    return NextResponse.next();
  }

  // HMAC-verified snapshot. Throws without a secret, hence the guard above.
  const cached = await getCookieCache(req).catch(() => null);
  if (cached) return NextResponse.next();

  const hasSessionToken = SESSION_COOKIES.some((name) =>
    Boolean(req.cookies.get(name)?.value)
  );

  /**
   * CRITICAL: an expired snapshot is not an absent session. The snapshot dies
   * every 5 minutes while the DB session lives ~30 days, so redirecting
   * straight to /login here would phantom-log-out every idle user. Bounce
   * page requests through a node-runtime route that re-issues the snapshot.
   */
  const isDocument = req.headers.get("accept")?.includes("text/html") ?? false;
  const alreadyTried = req.cookies.get(REFRESH_GUARD)?.value === "1";

  if (hasSessionToken && isDocument && !alreadyTried) {
    const to = `${pathname}${search}`;
    const url = new URL("/api/session-refresh", req.url);
    url.searchParams.set("to", to);
    const res = NextResponse.redirect(url);
    res.cookies.set(REFRESH_GUARD, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: req.nextUrl.protocol === "https:",
      maxAge: 30,
      path: "/",
    });
    return res;
  }

  // API routes never bounce — they get a hard 401.
  if (!isDocument) {
    return new NextResponse(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const login = new URL("/login", req.url);
  login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/portal/:path*"],
};
