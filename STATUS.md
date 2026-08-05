# Status

_Last updated: 2026-08-05_

## Live

| Surface | URL | Notes |
|---|---|---|
| GitHub Pages (client's original) | `williamdnaylor.github.io/awkn-investor/` | untouched, still serving |
| Vercel production | see `docs/infrastructure.md` | same decks, same paths, plus `/portal` |

## Shipped

- **Client decks preserved.** `index.html`, `investor-presentation/`,
  `awkn-residences/` are byte-identical at the repo root. `scripts/copy-legacy.mjs`
  mirrors them into `public/` at prebuild; `next.config.js` rewrites `/`,
  `/investor-presentation` and `/awkn-residences` onto them. Verified against a
  real `next start`: all three return 200 with the original `<title>`.
- **Next.js 16 app scaffold** — App Router, Tailwind 4, strict TS. Zero-env
  `next build` is green (every env var optional in `src/env.js`).
- **Neon** project `awkn-investor` provisioned; 8 tables migrated. A scoped role
  `app_auth_rw` holds CRUD on the auth tables only — verified it cannot
  `CREATE TABLE`. Migrations run under the owner connection.
- **Vercel** project created on the awkn team. `DATABASE_URL`,
  `AUTH_DATABASE_URL`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`,
  `ALLOWLIST_MODE` set for **Production + Preview**.
- **Better Auth golden path** — passkeys, TOTP with backup codes, trusted
  devices, DB-backed rate limiting, HIBP, email verification, admin plugin,
  invite-only allowlist, sessions manager, recovery surfaces, edge gate with the
  session-refresh bounce.
- **Allowlist seeded**: `mmicel583@gmail.com`, `wdnaylor@gmail.com`.

## Dark by design

- **SMS second factor** — no Twilio sender exists (`TWILIO_MESSAGING_SERVICE_SID`
  / `TWILIO_FROM_NUMBER` are both absent), so `otpOptions` is omitted and "otp"
  never appears in `twoFactorMethods`. Adding either var lights the rung.
- **Phone enrolment** — no `TWILIO_VERIFY_SERVICE_SID`, so the settings section
  is hidden in production. Same one-var fix.

## Waiting on someone else

- **Vercel GitHub App** (William) — the repo is on his personal account, so we
  can't install it. Production ships from the seat via `vercel deploy --prod`
  until he installs <https://github.com/apps/vercel>; auto-deploy-on-push is the
  only thing missing.
- **Admin promotion** — `npm run seed:admin` promoted 0 rows because no account
  exists yet. Rerun after Matthew's first signup.
- **Sender domain** — email goes out as `awkn@miraclemind.dev` (a verified
  Resend domain). A verified AWKN domain should replace it before invitations
  reach investors.

## Known content discrepancy

The client's `README.md` describes **75 homes** with four unit types and per-unit
pricing. The design brief for the launch-page demos says **80 lots** with water,
Wi-Fi and a longevity package. Both are recorded as-is; nobody's numbers were
edited. Needs a decision from Matthew/William before either reaches investors.
