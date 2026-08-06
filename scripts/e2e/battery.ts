/**
 * Auth evidence battery.
 *
 *   E2E_DATABASE_URL=postgres://… npx tsx scripts/e2e/battery.ts
 *
 * Boots the production build against a throwaway database, exercises every
 * rung of the auth system with real HTTP and real cryptography, and deletes
 * everything it created. It must never be pointed at production: it bans
 * users, burns rate limits and drops rows.
 *
 * Delivery is stubbed to var/outbox — see bootServer() in ./harness.ts for the
 * allowlisted child env that guarantees it.
 */
import { randomBytes } from "node:crypto";
import postgres from "postgres";

import {
  api,
  BASE,
  bootServer,
  call,
  check,
  clearOutboxes,
  firstUrl,
  Jar,
  report,
  section,
  stopServer,
  waitForEmail,
} from "./harness";
import { secretFromOtpUri, SoftAuthenticator, totp } from "./crypto";

function requireThrowawayDb(): string {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) throw new Error("Set E2E_DATABASE_URL to a throwaway database.");
  // This battery bans users, burns rate limits and truncates tables.
  if (/neon\.tech|vercel|amazonaws/i.test(url)) {
    throw new Error("E2E_DATABASE_URL looks hosted. This battery is destructive.");
  }
  return url;
}

const DB_URL = requireThrowawayDb();

const stamp = randomBytes(4).toString("hex");
const VIEWER = `e2e-viewer-${stamp}@example.test`;
const ADMIN = `e2e-admin-${stamp}@example.test`;
const STRANGER = `e2e-stranger-${stamp}@example.test`;
const PW = `E2e-${randomBytes(9).toString("base64url")}!`;
const PW2 = `E2e2-${randomBytes(9).toString("base64url")}!`;

const sql = postgres(DB_URL, { prepare: false });

/** Sign up, click the emailed link, and come back signed out. */
async function enrol(email: string): Promise<void> {
  const jar = new Jar();
  await call("POST", api("/sign-up/email"), {
    jar,
    body: { name: email.split("@")[0] ?? email, email, password: PW },
  });
  const mail = await waitForEmail(email);
  await call("GET", new URL(firstUrl(mail.text)).pathname + new URL(firstUrl(mail.text)).search, {
    jar,
  });
}

/**
 * Throws rather than returning a session-less jar. A silent failure here shows
 * up several sections later as an unrelated-looking "signed-in user was
 * redirected to /login", which is a miserable thing to debug.
 */
async function signIn(email: string, password = PW): Promise<Jar> {
  const jar = new Jar();
  const res = await call("POST", api("/sign-in/email"), {
    jar,
    body: { email, password },
  });
  if (!jar.names().some((n) => n.includes("session_token"))) {
    throw new Error(
      `sign-in for ${email} produced no session (${res.status}): ${JSON.stringify(
        res.body
      ).slice(0, 200)}`
    );
  }
  return jar;
}

/**
 * Walk a redirect chain the way a browser would, and report where it landed
 * plus every hop it took.
 *
 * `call()` uses `redirect: "manual"`, which is right for asserting a single
 * response — but a signed-in request is *expected* to redirect whenever its
 * five-minute snapshot has gone cold: `src/proxy.ts` bounces it through
 * `/api/session-refresh` to re-issue the cookie. Reading only the first
 * response would mistake that healthy bounce for a rejection. Following also
 * matters for the cookies: the refresh route hands back the new snapshot on the
 * redirect itself, and undici's own redirect-following would drop it (it does
 * not keep a jar), so each hop has to go through our jar.
 */
async function follow(
  path: string,
  jar: Jar,
  max = 4
): Promise<{ status: number; path: string; body: unknown; chain: string[] }> {
  let current = path;
  const chain = [path];
  for (let i = 0; i < max; i++) {
    const res = await call("GET", current, { jar });
    const loc = res.headers.get("location");
    if (res.status < 300 || res.status >= 400 || !loc) {
      return { status: res.status, path: current, body: res.body, chain };
    }
    const next = new URL(loc, BASE);
    current = next.pathname + next.search;
    chain.push(current);
  }
  return { status: 508, path: current, body: null, chain };
}

async function main() {
  await clearOutboxes();
  await sql`DELETE FROM awkn_investor_allowlist`;
  await sql`DELETE FROM awkn_investor_user`;
  await sql`DELETE FROM awkn_investor_rate_limit`;

  const server = await bootServer(DB_URL, randomBytes(32).toString("hex"));

  try {
    /* ---------------------------------------------------- delivery is stubbed */
    section("Guards");
    const probe = await call("GET", "/api/auth/ok");
    check("server is up and answering", probe.status === 200, probe.body);

    /* -------------------------------------------------------- the allowlist */
    section("Invite-only signup");

    const strangerJar = new Jar();
    const rejected = await call("POST", api("/sign-up/email"), {
      jar: strangerJar,
      body: { name: "Stranger", email: STRANGER, password: PW },
    });
    check(
      "un-invited address is refused (403)",
      rejected.status === 403,
      rejected.body
    );
    check(
      "refusal does not leak whether the address exists",
      typeof rejected.body?.message === "string" &&
        !/not invited|already/i.test(rejected.body.message),
      rejected.body?.message
    );
    const strangerRows =
      await sql`SELECT id FROM awkn_investor_user WHERE email = ${STRANGER}`;
    check("refused signup leaves no user row behind", strangerRows.length === 0);

    await sql`INSERT INTO awkn_investor_allowlist (email, source, added_by)
              VALUES (${VIEWER}, 'invite', 'battery'), (${ADMIN}, 'manual', 'battery')`;

    const signupJar = new Jar();
    const accepted = await call("POST", api("/sign-up/email"), {
      jar: signupJar,
      body: { name: "Viewer", email: VIEWER, password: PW },
    });
    check("invited address may sign up (200)", accepted.status === 200, accepted.body);
    check(
      "no session is issued before the email is verified",
      accepted.body?.token === null || accepted.body?.token === undefined,
      accepted.body
    );

    /* ------------------------------------------------------ email verification */
    section("Email verification");

    const preVerify = await call("POST", api("/sign-in/email"), {
      jar: new Jar(),
      body: { email: VIEWER, password: PW },
    });
    check(
      "unverified account cannot sign in",
      preVerify.status === 403,
      preVerify.status
    );

    const mail = await waitForEmail(VIEWER);
    check("verification email reached the stub outbox", Boolean(mail.text));
    const link = new URL(firstUrl(mail.text));
    const verifyJar = new Jar();
    const verified = await call("GET", `${link.pathname}${link.search}`, {
      jar: verifyJar,
    });
    check(
      "verification link is accepted",
      verified.status === 302 || verified.status === 200,
      verified.status
    );
    const [row] =
      await sql`SELECT email_verified, role FROM awkn_investor_user WHERE email = ${VIEWER}`;
    check("user is marked verified", row?.email_verified === true, row);

    /* ------------------------------------------------------------------ roles */
    section("Roles");
    check(
      "a new account defaults to viewer, not admin",
      row?.role === "viewer",
      row?.role
    );

    const viewerJar = await signIn(VIEWER);
    const whoami = await call("GET", api("/get-session"), { jar: viewerJar });
    check("verified account can sign in", whoami.status === 200 && Boolean(whoami.body?.user), whoami.status);

    const escalate = await call("GET", api("/admin/list-users?limit=10"), {
      jar: viewerJar,
    });
    check(
      "viewer cannot use admin endpoints",
      escalate.status === 403,
      escalate.status
    );

    await enrol(ADMIN);
    await sql`UPDATE awkn_investor_user SET role = 'admin' WHERE email = ${ADMIN}`;
    const adminJar = await signIn(ADMIN);
    const listed = await call("GET", api("/admin/list-users?limit=10"), {
      jar: adminJar,
    });
    check("admin can use admin endpoints", listed.status === 200, listed.status);

    /* ------------------------------------------------------------------ HIBP */
    section("Password hygiene");
    const pwned = await call("POST", api("/change-password"), {
      jar: viewerJar,
      body: { currentPassword: PW, newPassword: "password123" },
    });
    check(
      "a known-breached password is refused",
      pwned.status >= 400,
      pwned.body?.message ?? pwned.status
    );

    /* -------------------------------------------------------- change password */
    section("Change password");
    const wrongCurrent = await call("POST", api("/change-password"), {
      jar: viewerJar,
      body: { currentPassword: "not-the-password", newPassword: PW2 },
    });
    check(
      "wrong current password is refused",
      wrongCurrent.status >= 400,
      wrongCurrent.status
    );

    const changed = await call("POST", api("/change-password"), {
      jar: viewerJar,
      body: { currentPassword: PW, newPassword: PW2, revokeOtherSessions: true },
    });
    check("password change succeeds", changed.status === 200, changed.body);

    const oldPw = await call("POST", api("/sign-in/email"), {
      jar: new Jar(),
      body: { email: VIEWER, password: PW },
    });
    check("old password no longer works", oldPw.status >= 400, oldPw.status);
    const newPw = await signIn(VIEWER, PW2);
    const newPwOk = await call("GET", api("/get-session"), { jar: newPw });
    check("new password works", Boolean(newPwOk.body?.user), newPwOk.status);

    /* --------------------------------------------------------- forgot / reset */
    section("Forgot password");
    await clearOutboxes();
    const forgot = await call("POST", api("/request-password-reset"), {
      jar: new Jar(),
      body: { email: VIEWER, redirectTo: `${BASE}/reset-password` },
    });
    check("reset request accepted", forgot.status === 200, forgot.status);

    const unknown = await call("POST", api("/request-password-reset"), {
      jar: new Jar(),
      body: { email: `nobody-${stamp}@example.test`, redirectTo: `${BASE}/reset-password` },
    });
    check(
      "unknown address gets the same answer (no enumeration)",
      unknown.status === forgot.status,
      { known: forgot.status, unknown: unknown.status }
    );

    const resetMail = await waitForEmail(VIEWER);
    const resetUrl = new URL(firstUrl(resetMail.text));
    const resetJar = new Jar();
    const bounced = await call("GET", `${resetUrl.pathname}${resetUrl.search}`, {
      jar: resetJar,
    });
    const token =
      new URL(bounced.headers.get("location") ?? `${BASE}/?token=`, BASE).searchParams.get(
        "token"
      ) ?? resetUrl.searchParams.get("token");
    const reset = await call("POST", api("/reset-password"), {
      jar: resetJar,
      body: { newPassword: PW, token },
    });
    check("reset with the emailed token succeeds", reset.status === 200, reset.body);

    const replay = await call("POST", api("/reset-password"), {
      jar: new Jar(),
      body: { newPassword: PW2, token },
    });
    check("the reset token is single-use", replay.status >= 400, replay.status);

    const afterReset = await signIn(VIEWER, PW);
    check(
      "reset password signs in",
      Boolean((await call("GET", api("/get-session"), { jar: afterReset })).body?.user)
    );

    /* --------------------------------------------------------------- passkeys */
    section("Passkeys");
    /**
     * The plugin doesn't set `rpID`, so it derives from the base URL's host —
     * 127.0.0.1 here, not "localhost". The authenticator hashes the relying
     * party ID into authData, so getting this wrong fails the signature check
     * with an error that says nothing about why.
     */
    const auth = new SoftAuthenticator(new URL(BASE).hostname, BASE);
    const regOpts = await call("GET", api("/passkey/generate-register-options"), {
      jar: afterReset,
    });
    check(
      "registration options issued",
      regOpts.status === 200 && Boolean(regOpts.body?.challenge),
      regOpts.status
    );

    const regd = await call("POST", api("/passkey/verify-registration"), {
      jar: afterReset,
      body: { response: auth.register(regOpts.body.challenge), name: "Battery key" },
    });
    check("passkey registration verified", regd.status === 200, regd.body);

    const keys = await call("GET", api("/passkey/list-user-passkeys"), {
      jar: afterReset,
    });
    check(
      "the passkey is listed on the account",
      Array.isArray(keys.body) && keys.body.length === 1,
      keys.body
    );

    const pkJar = new Jar();
    const authOpts = await call("GET", api("/passkey/generate-authenticate-options"), {
      jar: pkJar,
    });
    const pkSignIn = await call("POST", api("/passkey/verify-authentication"), {
      jar: pkJar,
      body: { response: auth.authenticate(authOpts.body.challenge) },
    });
    check(
      "signing in with the passkey alone works",
      pkSignIn.status === 200 && Boolean(pkSignIn.body?.user),
      pkSignIn.body
    );

    const forged = new SoftAuthenticator(new URL(BASE).hostname, BASE);
    const forgeJar = new Jar();
    const forgeOpts = await call("GET", api("/passkey/generate-authenticate-options"), {
      jar: forgeJar,
    });
    const forgedIn = await call("POST", api("/passkey/verify-authentication"), {
      jar: forgeJar,
      body: { response: forged.authenticate(forgeOpts.body.challenge) },
    });
    check(
      "an unregistered authenticator is rejected",
      forgedIn.status >= 400,
      forgedIn.status
    );

    const renamed = await call("POST", api("/passkey/update-passkey"), {
      jar: afterReset,
      body: { id: keys.body?.[0]?.id, name: "Renamed key" },
    });
    check("passkey can be renamed", renamed.status === 200, renamed.body);

    /* -------------------------------------------------------------------- 2FA */
    section("Two-factor");
    const enabled = await call("POST", api("/two-factor/enable"), {
      jar: afterReset,
      body: { password: PW },
    });
    check(
      "TOTP enrolment returns a URI and backup codes",
      enabled.status === 200 &&
        Boolean(enabled.body?.totpURI) &&
        Array.isArray(enabled.body?.backupCodes),
      enabled.status
    );
    const secret = secretFromOtpUri(enabled.body.totpURI);
    const backupCodes: string[] = enabled.body.backupCodes;

    /**
     * `enable` only issues the secret — it writes the row with
     * `verified: false`, and sign-in refuses a TOTP challenge until the user
     * proves they actually scanned the QR. That proof is a verify-totp call on
     * the *signed-in* session, which is what the settings page does after
     * showing the code.
     */
    const notYet = await call("POST", api("/sign-in/email"), {
      jar: new Jar(),
      body: { email: VIEWER, password: PW },
    });
    check(
      "an un-activated TOTP secret does not gate sign-in",
      notYet.body?.twoFactorRedirect !== true,
      notYet.body
    );

    const activated = await call("POST", api("/two-factor/verify-totp"), {
      jar: afterReset,
      body: { code: totp(secret) },
    });
    check(
      "verifying the first code activates two-factor",
      activated.status === 200,
      activated.body
    );

    const challenged = await call("POST", api("/sign-in/email"), {
      jar: new Jar(),
      body: { email: VIEWER, password: PW },
    });
    check(
      "password sign-in now yields a 2FA challenge, not a session",
      challenged.body?.twoFactorRedirect === true,
      challenged.body
    );

    const totpJar = new Jar();
    await call("POST", api("/sign-in/email"), {
      jar: totpJar,
      body: { email: VIEWER, password: PW },
    });
    const badCode = await call("POST", api("/two-factor/verify-totp"), {
      jar: totpJar,
      body: { code: "000000" },
    });
    check("a wrong TOTP code is rejected", badCode.status >= 400, badCode.status);

    const goodCode = await call("POST", api("/two-factor/verify-totp"), {
      jar: totpJar,
      body: { code: totp(secret) },
    });
    check(
      "the right TOTP code completes sign-in",
      goodCode.status === 200,
      goodCode.body
    );

    /* ------------------------------------------------------------ backup codes */
    section("Backup codes");
    const bcJar = new Jar();
    await call("POST", api("/sign-in/email"), {
      jar: bcJar,
      body: { email: VIEWER, password: PW },
    });
    const usedCode = backupCodes[0]!;
    const bcOk = await call("POST", api("/two-factor/verify-backup-code"), {
      jar: bcJar,
      body: { code: usedCode },
    });
    check("a backup code completes sign-in", bcOk.status === 200, bcOk.body);

    const bcJar2 = new Jar();
    await call("POST", api("/sign-in/email"), {
      jar: bcJar2,
      body: { email: VIEWER, password: PW },
    });
    const bcReplay = await call("POST", api("/two-factor/verify-backup-code"), {
      jar: bcJar2,
      body: { code: usedCode },
    });
    check("the same backup code cannot be reused", bcReplay.status >= 400, bcReplay.status);

    /* ---------------------------------------------------------- trusted device */
    section("Trusted device");
    const trustJar = new Jar();
    await call("POST", api("/sign-in/email"), {
      jar: trustJar,
      body: { email: VIEWER, password: PW },
    });
    await call("POST", api("/two-factor/verify-totp"), {
      jar: trustJar,
      body: { code: totp(secret), trustDevice: true },
    });
    const trusted = await call("POST", api("/sign-in/email"), {
      jar: trustJar,
      body: { email: VIEWER, password: PW },
    });
    check(
      "a trusted device skips the second factor",
      trusted.body?.twoFactorRedirect !== true && trusted.status === 200,
      trusted.body
    );

    /* ---------------------------------------------------------------- sessions */
    section("Sessions");
    const live = await signIn(ADMIN);
    const sessions = await call("GET", api("/list-sessions"), { jar: live });
    check(
      "sessions are listable",
      Array.isArray(sessions.body) && sessions.body.length >= 1,
      sessions.status
    );

    const victim = await signIn(ADMIN);
    const victimSessions = await call("GET", api("/list-sessions"), { jar: victim });
    const before = victimSessions.body?.length ?? 0;
    const revoked = await call("POST", api("/revoke-other-sessions"), { jar: victim });
    check("revoke-other-sessions is accepted", revoked.status === 200, {
      status: revoked.status,
      body: revoked.body,
    });
    const survivor = await call("GET", api("/list-sessions"), { jar: victim });
    check(
      "revoke-others leaves exactly the calling session",
      survivor.body?.length === 1 && before > 1,
      { before, after: survivor.body?.length }
    );

    /**
     * `disableCookieCache` on purpose. `get-session` answers from the same
     * five-minute signed snapshot the edge gate uses, so a revoked session
     * still *looks* alive to a cached read — that lag is by design for
     * navigation. What must be true immediately is the database, which is what
     * `src/server/auth/guards.ts` reads for every authorisation decision.
     */
    const revokedNow = await call(
      "GET",
      api("/get-session?disableCookieCache=true"),
      { jar: live }
    );
    check(
      "a revoked session is dead against the database",
      !revokedNow.body?.user,
      revokedNow.body
    );

    /* -------------------------------------------------------------------- ban */
    section("Ban");
    const [viewerRow] =
      await sql`SELECT id FROM awkn_investor_user WHERE email = ${VIEWER}`;

    /**
     * A fresh admin session, not `adminJar`. The Sessions section above proves
     * `revoke-other-sessions` works by revoking every other session this user
     * holds — and `adminJar` is one of them. Reusing it here would send the ban
     * as an unauthenticated request and report it as "admin cannot ban".
     */
    const banJar = await signIn(ADMIN);

    /**
     * Sign in again immediately before the ban. The point of the check below is
     * that the *guard* rejects a snapshot the *gate* accepts, so the snapshot
     * has to be inside its five-minute life when the ban lands — by this point
     * in the run the trusted-device jar's snapshot is minutes old and the gate
     * would bounce it for refresh instead, proving nothing. Cloned from
     * `trustJar` so the trusted-device cookie skips the 2FA challenge.
     */
    const warm = trustJar.clone();
    await call("POST", api("/sign-in/email"), {
      jar: warm,
      body: { email: VIEWER, password: PW },
    });
    const banned = await call("POST", api("/admin/ban-user"), {
      jar: banJar,
      body: { userId: viewerRow!.id, banReason: "battery" },
    });
    check("admin can ban a user", banned.status === 200, banned.body);

    const bannedSignIn = await call("POST", api("/sign-in/email"), {
      jar: new Jar(),
      body: { email: VIEWER, password: PW },
    });
    check(
      "a banned user cannot sign in",
      bannedSignIn.status >= 400,
      bannedSignIn.status
    );

    /**
     * The invariant the whole two-layer design rests on. `trustJar` is a
     * session that was signed in *before* the ban, so it still carries a valid
     * five-minute cookie snapshot — the edge gate waves it straight through,
     * exactly as designed. What must stop it is the page's own
     * `requireSession()`, which reads the database. If this check ever fails,
     * a banned or demoted user keeps their access for five more minutes.
     */
    check(
      "the pre-ban cookie snapshot is genuinely still warm",
      warm.names().some((n) => n.includes("session_data")),
      warm.names()
    );
    /**
     * Both layers send a refused visitor to `/login`, so "did it 307 to /login?"
     * cannot tell them apart. The query string can: the gate always attaches
     * `?next=` so it can return you to where you were going (`src/proxy.ts`),
     * while the page's `requireSession()` calls a bare `redirect("/login")`.
     * A bare `/login` here therefore means the request got *past* the gate on
     * its still-valid snapshot and was stopped by the database instead — which
     * is the whole point of the split.
     */
    const bannedPortal = await call("GET", "/portal", { jar: warm });
    const gateBounced = (bannedPortal.headers.get("location") ?? "").includes("next=");
    check(
      "the edge gate accepts the banned user's warm snapshot (by design)",
      !gateBounced,
      bannedPortal.headers.get("location")
    );
    const landed = await follow("/portal", warm);
    check(
      "...but the guard refuses them, so /portal is never rendered",
      landed.path.startsWith("/login"),
      landed
    );

    await call("POST", api("/admin/unban-user"), {
      jar: banJar,
      body: { userId: viewerRow!.id },
    });

    /* ------------------------------------------------------------- the gate */
    section("Edge gate");
    for (const path of ["/", "/awkn-residences/", "/investor-presentation/", "/portal"]) {
      const res = await call("GET", path, { jar: new Jar() });
      const loc = res.headers.get("location") ?? "";
      check(
        `${path} redirects a signed-out visitor to /login`,
        res.status === 307 && loc.includes("/login?next="),
        { status: res.status, loc }
      );
    }
    /**
     * A path that deliberately has no route. The gate runs ahead of routing, so
     * what's being proved is the gate's own behaviour: any `/api/*` request
     * without a session gets a hard 401 and never a redirect — a redirected
     * fetch() would land HTML in a caller expecting JSON.
     */
    const apiUnauth = await call("GET", "/api/portal-probe", { jar: new Jar() });
    check(
      "an unauthenticated API call gets 401, never a redirect",
      apiUnauth.status === 401,
      apiUnauth.status
    );
    for (const path of ["/login", "/signup", "/forgot-password", "/reset-password"]) {
      const res = await call("GET", path, { jar: new Jar() });
      check(`${path} is reachable signed out`, res.status === 200, res.status);
    }
    /**
     * A fresh sign-in, not `adminJar` — the Sessions section above deliberately
     * revoked every other session this user had, `adminJar` among them.
     */
    const deckJar = await signIn(ADMIN);

    /**
     * Followed, not read as a single response. Sign-in issues a session token
     * but the gate works off the separate five-minute snapshot cookie, so the
     * first navigation legitimately bounces through `/api/session-refresh` —
     * the invariant `src/proxy.ts` exists to protect, since treating a cold
     * snapshot as no session at all would phantom-log-out every idle user.
     * What must be true is where the chain *ends*.
     */
    const deckIn = await follow("/awkn-residences/", deckJar);
    check(
      "a signed-in visitor gets the deck itself",
      deckIn.status === 200 && String(deckIn.body).includes("<title"),
      { status: deckIn.status, chain: deckIn.chain }
    );
    check(
      "a cold snapshot refreshes rather than logging the user out",
      !deckIn.chain.some((hop) => hop.startsWith("/login")),
      deckIn.chain
    );
    /**
     * At most one bounce. If the gate cannot read the snapshot the refresh
     * route just issued, the two hand the request back and forth — a redirect
     * loop, which is a far worse outcome than a login page. The `svr` guard is
     * what stops it, and it only works because the route no longer clears it.
     */
    check(
      "the refresh bounce happens at most once, never in a loop",
      deckIn.chain.filter((hop) => hop.startsWith("/api/session-refresh")).length <= 1,
      deckIn.chain
    );

    /**
     * The snapshot is warm now, so this exercises the redirect itself rather
     * than the refresh bounce. The slash matters: the decks reference their
     * photographs relatively, and without it every image resolves against the
     * site root and 404s.
     */
    const slash = await call("GET", "/awkn-residences", { jar: deckJar });
    check(
      "the deck's missing trailing slash is redirected, not 404'd",
      slash.status === 307 &&
        (slash.headers.get("location") ?? "").endsWith("/awkn-residences/"),
      slash.headers.get("location")
    );

    /* ------------------------------------------------------------- rate limit */
    /**
     * Last on purpose. This section deliberately saturates the sign-in bucket,
     * and Better Auth's default rule is 3 requests per 10 seconds *per IP* —
     * every section runs from 127.0.0.1, so anything scheduled after this spends
     * its life throttled. When it sat before the Edge gate section it starved
     * that section's sign-in and the deck checks failed for a reason that had
     * nothing to do with the deck.
     */
    section("Rate limiting");
    /**
     * `noRetry` — everywhere else the harness waits a 429 out so the battery
     * isn't testing the rate limiter by accident. Here the 429 IS the assertion.
     */
    let sawLimit = false;
    for (let i = 0; i < 12 && !sawLimit; i++) {
      const r = await call("POST", api("/sign-in/email"), {
        jar: new Jar(),
        body: { email: VIEWER, password: `wrong-${i}` },
        noRetry: true,
      });
      if (r.status === 429) sawLimit = true;
    }
    check("repeated failed sign-ins are rate limited (429)", sawLimit);
    const limitRows = await sql`SELECT count(*)::int AS n FROM awkn_investor_rate_limit`;
    check(
      "rate-limit counters are persisted in the database, not memory",
      (limitRows[0]?.n ?? 0) > 0,
      limitRows[0]
    );
  } finally {
    stopServer(server);
  }
}

main()
  .then(async () => {
    /* --------------------------------------------------------------- cleanup */
    await sql`DELETE FROM awkn_investor_allowlist`;
    await sql`DELETE FROM awkn_investor_user`;
    await sql`DELETE FROM awkn_investor_rate_limit`;
    await sql`DELETE FROM awkn_investor_verification`;
    const left = await sql`
      SELECT (SELECT count(*) FROM awkn_investor_user)::int AS users,
             (SELECT count(*) FROM awkn_investor_session)::int AS sessions,
             (SELECT count(*) FROM awkn_investor_passkey)::int AS passkeys,
             (SELECT count(*) FROM awkn_investor_allowlist)::int AS allowlist`;
    check(
      "the battery leaves no rows behind",
      Object.values(left[0] ?? {}).every((n) => n === 0),
      left[0]
    );
    await clearOutboxes();
    await sql.end();
    process.exit(report());
  })
  .catch(async (err) => {
    console.error("\nBattery aborted:", err);
    await sql.end().catch(() => {});
    process.exit(1);
  });
