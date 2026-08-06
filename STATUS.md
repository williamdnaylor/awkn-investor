# Status

_Last updated: 2026-08-06_

## Live

| Surface | URL | Notes |
|---|---|---|
| GitHub Pages (client's original) | `williamdnaylor.github.io/awkn-investor/` | untouched, still serving, still **public** — to be turned off once William is signed in on Vercel (see `TODO.md`) |
| Vercel production | `awkn-investor.vercel.app` | serving `main`. **Fully gated:** the root, both decks and their images all 307 an anonymous visitor to `/login?next=…`; only `/login`, `/signup`, `/forgot-password`, `/reset-password` and `/api/auth/*` answer signed-out |
| Vercel preview (`dev`) | `awkn-investor-oca4iu7nv-awkn-team.vercel.app` | same code; behind Vercel's team SSO as well as the app's gate, so it needs a Vercel team login to open |

## Shipped

- **Client decks preserved.** `index.html`, `investor-presentation/` and
  `awkn-residences/` are byte-identical at the repo root; `copy-legacy.mjs`
  mirrors them into `public/` at prebuild and `next.config.js` rewrites onto
  them. All three return 200 with the original `<title>` under `next start`.
- **Next.js 16 app scaffold** — App Router, Tailwind 4, strict TS. Zero-env
  `next build` is green (every env var optional in `src/env.js`).
- **Neon** project `awkn-investor` provisioned; 8 tables migrated. A scoped role
  `app_auth_rw` holds CRUD on the auth tables only — verified it cannot
  `CREATE TABLE`. Migrations run under the owner connection.
- **Vercel** project created on the awkn team; `DATABASE_URL`,
  `AUTH_DATABASE_URL`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`,
  `ALLOWLIST_MODE` set for **Production + Preview**.
- **Better Auth golden path** — passkeys, TOTP with backup codes, trusted
  devices, DB-backed rate limiting, HIBP, email verification, admin plugin,
  invite-only allowlist, sessions manager, recovery surfaces, edge gate with
  the session-refresh bounce.
- **Allowlist seeded**: `mmicel583@gmail.com`, `wdnaylor@gmail.com` — both
  promoted to `admin` by `npm run seed:admin` once their accounts exist.
- **The whole host is gated**, verified against production. The decks, their
  images and the root page all require a session; only the
  surfaces you need in order to *get* one are reachable signed-out. Two routing
  facts it depends on are documented where they bite — the deck trailing slash
  (`src/proxy.ts`, not `redirects()`, which would loop) and the comma in one
  client image filename, which only survives Next's static handler when
  middleware leaves it encoded.
- **Two roles.** Matthew and William are administrators and can invite people;
  everyone they invite signs up as a `viewer`. Only admins see the team
  section. The edge gate still never reads role — that stays in `guards.ts`.
- **Launch-page demos** — three directions, generated in the Claude Design
  harness and living in Matthew's account, not in this repo. Links in
  `docs/design-demos.md`.
- **Auth evidence battery** — `scripts/e2e/`, 64 assertions, green twice in a
  row. It boots the real production build against a throwaway Postgres and
  drives real HTTP with real cryptography: a software authenticator whose ES256
  WebAuthn assertions the server verifies exactly as it would a YubiKey's, and
  an RFC 6238 TOTP generator. Covered: invite-only signup and its
  anti-enumeration refusal, email verification, role defaults, HIBP, change
  password, forgot/reset with single-use tokens, passkey register → sign-in →
  forgery rejection → rename, TOTP enrol → activate → challenge, backup-code
  single-use, trusted-device skip, session list/revoke, ban, DB-backed rate
  limiting, and the whole-host gate. Delivery is stubbed by an allowlisted child
  env, so it can never send real mail or SMS, and it deletes every row it
  creates. Transcript in `.hermes/pm/evidence/`.
- **Two defects it caught**, both fixed and re-proved by it. (1) `guards.ts`
  asked for the session without `disableCookieCache`, so the DB-backed
  authorisation layer was served the same five-minute snapshot the edge gate
  uses — a banned or demoted user kept access for up to five minutes, precisely
  the window `src/proxy.ts` documents as *not* applying to authorisation. (2)
  The gate and Better Auth disagreed about the snapshot's cookie name (base-URL
  protocol vs `NODE_ENV`), and because the refresh route cleared the loop guard
  on success, a production build over http turned every signed-in request into
  an infinite gate↔refresh redirect loop. The gate now asks for both names and
  the guard survives, so a disagreement costs one round trip and then an honest
  `/login`.

## Dark by design

- **SMS second factor** — no Twilio sender (`TWILIO_MESSAGING_SERVICE_SID` /
  `TWILIO_FROM_NUMBER` absent), so `otpOptions` is omitted and "otp" never
  appears in `twoFactorMethods`. Adding either var lights the rung.
- **Phone enrolment** — no `TWILIO_VERIFY_SERVICE_SID`, so the settings section
  is hidden in production. Same one-var fix.

## Waiting on someone else

- **William's signup** — Matthew's account exists and is `admin`; William's
  allowlist row is waiting and carries `admin`, so he becomes one the moment he
  registers. No manual promotion step any more.
- **Sender reputation** — the verification email works but landed in Gmail's
  spam folder (2026-08-06, first real signup). Warn anyone you invite until a
  verified AWKN domain with its own DKIM/DMARC replaces the shared sender.
- **Auto-deploy** — deploys are still manual from the seat (`vercel deploy`,
  via the Infisical provisioning lane; the token never enters a seat env or a
  transcript). Installing <https://github.com/apps/vercel> on the repo
  (William's account) makes it self-solving: pushes to `main` and `dev` would
  deploy themselves, which is also what keeps the preview current.
- **A direction for the launch page** (Matthew/William) — three are up in Claude
  Design. Comment on one and it gets rebuilt here.
- **A contact address for AWKN Residences** — all three launch pages want one
  and none may invent it; each closing CTA is a non-link until it arrives.
- **Sender domain** — email goes out as `awkn@miraclemind.dev` (a verified
  Resend domain); a verified AWKN domain should replace it before invitations
  reach investors.

Standing decisions (80 lots, the two-role model, Pages staying up, CLI deploys)
live in `.hermes/pm/answers.md`.
