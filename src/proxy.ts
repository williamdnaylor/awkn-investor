import { getCookieCache } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge gate for the whole host.
 *
 * Everything is private: the client-authored decks at `/`,
 * `/investor-presentation/` and `/awkn-residences/`, their images, and
 * `/portal`. Only the surfaces you need in order to *obtain* a session are
 * reachable signed-out.
 *
 * (The client's original GitHub Pages copies stay public until they're taken
 * down — see STATUS.md. This gate governs the Vercel host only.)
 *
 * The gate only ever asks "is there a valid session snapshot?". Role and ban
 * state are deliberately NOT read here: the snapshot is up to five minutes
 * stale, so authorisation decisions belong to the DB-backed server layer.
 * That five minutes is the accepted revocation window for *navigation*; a
 * banned user's next server action still fails immediately.
 */

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

/** Chrome the signed-out pages need. Nothing here reveals client material. */
const ALWAYS_PUBLIC = ["/favicon.ico", "/robots.txt"];

const SESSION_COOKIES = [
  "__Secure-better-auth.session_token",
  "better-auth.session_token",
];

/** Loop guard: one refresh attempt per navigation, then fall through to login. */
const REFRESH_GUARD = "svr";

/**
 * Deck directories that must be served with a trailing slash. Their markup
 * references assets relatively (`src="images/dome.jpg"`), so without the slash
 * the browser resolves every photo against the site root and they all 404.
 * See the note in next.config.js for why this isn't a `redirects()` entry.
 */
const DECK_DIRS = ["/investor-presentation", "/awkn-residences"];

/** Let the request through — adding the deck trailing slash if it's missing. */
function pass(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (DECK_DIRS.includes(pathname)) {
    // A plain URL, not `nextUrl.clone()`: NextURL re-normalises its pathname
    // against the trailingSlash config and would strip the slash straight back
    // off, redirecting the path to itself forever.
    return NextResponse.redirect(new URL(`${pathname}/${search}`, req.url));
  }

  /**
   * One client image is named `ChatGPT Image May 26, 2026, 11_21_07 AM.jpeg`.
   * A literal comma in the path survives Next's static handler only when the
   * request does NOT pass through here — once middleware touches it, the
   * handoff mangles the comma and the file 404s. The percent-encoded form is
   * unaffected, so normalise to it. Nothing at the repo root is renamed.
   */
  if (pathname.includes(",")) {
    return NextResponse.rewrite(
      new URL(`${pathname.replaceAll(",", "%2C")}${search}`, req.url)
    );
  }

  return NextResponse.next();
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const isPublic =
    ALWAYS_PUBLIC.includes(pathname) ||
    AUTH_SURFACES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isPublic) return NextResponse.next();

  const configured = Boolean(process.env.BETTER_AUTH_SECRET);

  if (!configured) {
    // Fail closed in production: an unconfigured gate must never read as open.
    if (process.env.VERCEL_ENV === "production") {
      return NextResponse.redirect(new URL("/login?error=unconfigured", req.url));
    }
    return pass(req);
  }

  // HMAC-verified snapshot. Throws without a secret, hence the guard above.
  const cached = await getCookieCache(req).catch(() => null);
  if (cached) return pass(req);

  const hasSessionToken = SESSION_COOKIES.some((name) =>
    Boolean(req.cookies.get(name)?.value)
  );

  /**
   * CRITICAL: an expired snapshot is not an absent session. The snapshot dies
   * every 5 minutes while the DB session lives ~30 days, so redirecting
   * straight to /login here would phantom-log-out every idle user. Bounce
   * through a node-runtime route that re-issues the snapshot.
   *
   * Deck images bounce too, not just documents — a deck is one long page of
   * photographs, and a subresource that 401s on a stale snapshot shows up as a
   * broken image with no way to recover. Browsers follow redirects for
   * subresources, so the bounce re-issues the snapshot and the image loads.
   * API routes are the exception: they get a hard 401 and never redirect.
   */
  const isApi = pathname.startsWith("/api/");
  const alreadyTried = req.cookies.get(REFRESH_GUARD)?.value === "1";

  if (hasSessionToken && !isApi && !alreadyTried) {
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

  if (isApi) {
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
  /**
   * Everything except Next's own build output and the image optimiser — those
   * serve the signed-out login page itself and carry no client material.
   */
  matcher: ["/((?!_next/static|_next/image).*)"],
};
