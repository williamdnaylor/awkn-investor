# Status

_Last updated: 2026-08-06_

## Live

| Surface | URL | Notes |
|---|---|---|
| GitHub Pages (client's original) | `williamdnaylor.github.io/awkn-investor/` | untouched, still serving, still **public** — to be turned off once William is signed in on Vercel (see `TODO.md`) |
| Vercel production | `awkn-investor.vercel.app` | serving an **older commit** of `main` — the icons and OG card are merged and pushed but **not deployed** (`/favicon.ico` still 404s in prod). No Vercel CLI or token on this seat; needs the GitHub App or a deploy seat. **Fully gated:** the root, both decks and their images all 307 an anonymous visitor to `/login?next=…`; only `/login`, `/signup`, `/forgot-password`, `/reset-password` and `/api/auth/*` answer signed-out |
| Vercel preview (`dev`) | `awkn-investor-oca4iu7nv-awkn-team.vercel.app` | same code; behind Vercel's team SSO as well as the app's gate, so it needs a Vercel team login to open |

## Shipped

- **Client decks preserved.** `index.html`, `investor-presentation/` and
  `awkn-residences/` are byte-identical at the repo root; `copy-legacy.mjs`
  mirrors them into `public/` at prebuild and `next.config.js` rewrites onto
  them. All three serve the original markup under `next start`.
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
- **Allowlist seeded**: `mmicel583@gmail.com`, `wdnaylor@gmail.com`, both
  carrying `admin`.
- **The whole host is gated**, verified against production. The decks, their
  images and the root page all require a session; only the surfaces you need in
  order to *get* one are reachable signed-out. Two routing facts it depends on
  are documented where they bite — the deck trailing slash (`src/proxy.ts`, not
  `redirects()`, which would loop) and the comma in one client image filename,
  which only survives Next's static handler when middleware leaves it encoded.
- **Two roles.** Matthew and William are administrators and can invite people;
  everyone they invite signs up as a `viewer`, and only admins see the team
  section. The edge gate still never reads role — that stays in `guards.ts`.
- **Launch-page demos** — seven directions across three rounds, generated in the
  Claude Design harness by Fable 5 and living in Matthew's account, not in this
  repo. Round three (2026-08-06) came from a loosened brief and a render-and-
  critique loop, and is the cleanest on facts. Every CTA is inert because no
  contact address exists. Links in `docs/design-demos.md`.
- **Auth evidence battery** — `scripts/e2e/`, 64 assertions, green twice in a
  row. It boots the real production build against a throwaway Postgres and
  drives real HTTP with real cryptography — a software authenticator whose ES256
  assertions the server verifies exactly as it would a YubiKey's, and an RFC
  6238 TOTP generator. Covered: invite-only signup and its anti-enumeration
  refusal, email verification, role defaults, HIBP, forgot/reset, passkey
  register → sign-in → forgery rejection → rename, TOTP, backup-code
  single-use, trusted-device skip, session revoke, ban, rate limiting, the
  whole-host gate. Delivery is stubbed by an allowlisted child env, so it can
  never send real mail or SMS; it deletes every row it creates. Transcript in
  `.hermes/pm/evidence/`.
- **Two defects it caught**, both fixed and re-proved by it. (1) `guards.ts`
  asked for the session without `disableCookieCache`, so authorisation was
  served the same five-minute snapshot the edge gate uses — a banned user kept
  access for the window `src/proxy.ts` documents as *not* applying to it.
  (2) The gate and Better Auth disagreed about the snapshot's cookie name
  (base-URL protocol vs `NODE_ENV`); with the refresh route clearing the loop
  guard on success, a production build over http looped for ever. The gate now
  asks for both names and the guard survives.
- **Link previews and icons** (`feat/site-icons-og`). Any deck link redirects a
  signed-out visitor — so, every unfurl bot — to `/login`, which now carries a
  favicon, an apple icon and one Open Graph card for the whole host. The four
  asset paths are deliberately reachable without a session: an og:image behind
  the gate never renders. The decks' own tags are untouched client material —
  `awkn-residences/` names a relative og:image most scrapers drop, and
  `investor-presentation/` one on a third-party host.

## Dark by design

- **SMS second factor** — no Twilio sender (`TWILIO_MESSAGING_SERVICE_SID` /
  `TWILIO_FROM_NUMBER`), so `otpOptions` is omitted and "otp" never appears in
  `twoFactorMethods`. **Phone enrolment** — no `TWILIO_VERIFY_SERVICE_SID`, so
  the section is hidden in production. Either rung lights up on one var.

## Waiting on someone else

- **William's signup** — Matthew's account exists and is `admin`; William's
  allowlist row carries `admin`, so he becomes one the moment he registers.
- **Sender reputation** — verification email works but landed in Gmail spam
  (2026-08-06, first real signup). Warn invitees until a verified AWKN domain
  with its own DKIM/DMARC replaces the shared sender.
- **Auto-deploy** — deploys are still manual from the seat (`vercel deploy`,
  via the Infisical provisioning lane; the token never enters a seat env or a
  transcript). Installing <https://github.com/apps/vercel> on the repo
  (William's account) makes it self-solving: pushes to `main` and `dev` would
  deploy themselves, which is also what keeps the preview current.
- **A direction for the launch page** (Matthew/William) — seven are up in Claude
  Design across three rounds. Comment on one and it gets rebuilt here. Rounds two
  and three borrow home specs and rents from the investor deck; confirm both
  before any of it is public.
- **A contact address for AWKN Residences** — every launch page wants one and
  none may invent it; each closing CTA is inert until it arrives.

Standing decisions live in `.hermes/pm/answers.md`.
