# Status

_Last updated: 2026-08-05_

## Live

| Surface | URL | Notes |
|---|---|---|
| GitHub Pages (client's original) | `williamdnaylor.github.io/awkn-investor/` | untouched, still serving, still **public** — to be turned off once William is signed in on Vercel (see `TODO.md`) |
| Vercel production | `awkn-investor.vercel.app` | same decks, same paths, plus `/portal` — the whole host is gated |

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
- **Allowlist seeded**: `mmicel583@gmail.com`, `wdnaylor@gmail.com` — both
  promoted to `admin` by `npm run seed:admin` once their accounts exist.
- **Verified against production**, not just locally: all three decks return 200
  with their original `<title>`; `/portal` 307s an HTML request to
  `/login?next=/portal` and hard-401s a non-document one; a non-allowlisted
  signup gets a generic 403; an allowlisted one gets 200 with `token: null`
  (no session until the email link is clicked) and Resend accepted the
  verification email from `awkn@miraclemind.dev`. The probe's user, session,
  account and allowlist rows were deleted afterwards.
- **The whole host is gated**, not just `/portal`. The decks, their images and
  the root page all require a session; only the surfaces you need in order to
  *get* one are reachable signed-out. Two routing facts the gate depends on are
  documented where they bite — the deck trailing slash (`src/proxy.ts`, not
  `redirects()`, which would loop) and the comma in one client image filename,
  which only survives Next's static handler when middleware leaves it encoded.
- **Two roles.** Matthew and William are administrators and can invite people;
  everyone they invite signs up as a `viewer`. Only admins see the team
  section. The edge gate still never reads role — that stays in `guards.ts`.
- **Launch-page demos** — three directions, generated in the Claude Design
  harness and living in Matthew's account, not in this repo. Links in
  `docs/design-demos.md`.

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
- **A direction for the launch page** (Matthew/William) — three are up in Claude
  Design. Comment on one and it gets rebuilt here.
- **A contact address for AWKN Residences** — all three launch pages want one
  and none may invent it; each closing CTA is a non-link until the client
  supplies the real inbox.
- **Sender domain** — email goes out as `awkn@miraclemind.dev` (a verified
  Resend domain). A verified AWKN domain should replace it before invitations
  reach investors.

## Settled

- **80 lots.** The client's `README.md` says 75 homes; Matthew confirmed 80 on
  2026-08-05, and the launch pages use it. `README.md` is client-authored and
  was left exactly as written — worth reconciling with William at some point,
  but it isn't blocking anything.
