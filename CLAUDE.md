# awkn-investor

Private investor materials for AWKN, plus a gated portal.

## The one thing to know first

**The three decks at the repo root are client-authored and already circulating.**
`index.html`, `investor-presentation/` and `awkn-residences/` are live on GitHub
Pages at `https://williamdnaylor.github.io/awkn-investor/…`, and those links have
been sent to real investors. They are the source of truth and stay byte-identical
at the repo root.

`scripts/copy-legacy.mjs` mirrors them into `public/` at `prebuild`/`predev`
(the copies are gitignored), and `next.config.js` rewrites `/`,
`/investor-presentation` and `/awkn-residences` onto them. Both hosts therefore
serve the same bytes at the same paths — there is no cutover, and nothing the
client sent can break.

**Never move, rename or "clean up" those three paths.** Anything new lives under
`/portal`.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind 4 · Drizzle + Neon Postgres ·
Better Auth 1.6 · Resend · deployed on Vercel (awkn team).

## Layout

```
index.html                  client deck — do not touch
investor-presentation/      client deck — do not touch
awkn-residences/            client deck — do not touch
scripts/copy-legacy.mjs     mirrors the three above into public/
src/app/portal/             the gated surface (everything new goes here)
src/app/login|signup|…      auth surfaces
src/server/auth/            Better Auth config, allowlist, guards
src/server/db/              Drizzle schema + client
src/server/{email,otp,sms}.ts  delivery, each dual-mode
src/proxy.ts                edge gate for /portal (Next 16's middleware)
```

## Auth invariants

- **Signup is invite-only.** `ALLOWLIST_MODE=gated`; only addresses in the
  `awkn_investor_allowlist` table can register. An empty table never means
  "open" — `open` must be set explicitly.
- **Every env var is optional in `src/env.js`** so a zero-env `next build` stays
  green. Anything genuinely required fails closed at *runtime* in production.
- **The edge gate never reads role or ban state.** The cookie snapshot is up to
  five minutes stale; authorisation belongs to `src/server/auth/guards.ts`.
- **An expired cookie snapshot is not an absent session.** `/api/session-refresh`
  re-issues it; deleting that bounce phantom-logs-out every idle user.
- `nextCookies()` must stay last in the plugin array.
- `otp.ts` (Twilio Verify — Twilio owns the code) and `sms.ts` (Twilio Messaging
  — Better Auth owns the code) are separate on purpose. Do not merge them.

## Commands

```bash
npm run dev            # mirrors the decks, then next dev
npm run quality-check  # typecheck + build, must pass with zero env vars
npm run db:generate    # after editing src/server/db/schema.ts
npm run db:migrate     # owner connection only (MIGRATION_DATABASE_URL)
npm run seed:admin     # idempotent; rerun after the owner's first signup
```

Never `db:push` against production.

## Docs

- `STATUS.md` — current state
- `TODO.md` — tracked work
- `docs/design-demos.md` — AWKN Residences launch-page explorations
