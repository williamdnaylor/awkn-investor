# TODO

## Critical (blocks production)

_None._

## Deprecation

- **Turn off GitHub Pages** once William has signed in on Vercel and exercised
  the full account flow. Until then it stays up as the fallback — Matthew's
  call, deliberately. It matters because Pages is **public**: while it serves,
  the Vercel gate protects the decks at one host and not the other, and the
  links already in investors' inboxes point at the public one. Repoint or
  re-send those links at the same time.
- The launch-page mockups hotlink their photography to the Pages copies. Taking
  Pages down breaks the images in Claude Design — rebuild the chosen direction
  against repo-hosted assets rather than leaving it pointed there.

## Bugs (broken functionality)

- **`the-village.html` (Claude Design) prints a forbidden fact in its pixels.**
  Its Dome card uses `IMG_8502.JPG`, which is a screen capture of the investor
  deck with "25 HOMES" burnt in — a per-type unit count contradicting the
  confirmed 80. One `alt` on the same page describes a bodywork session; the
  image is a still-life with no person in it. Repair in the harness, and audit
  `golden-hour.html` and `bone-and-light.html` for the same files
  (`docs/design-demos.md` lists them). Mockups only — nothing public.

## Tech Debt (code quality)

- The evidence battery (`scripts/e2e/`) needs a throwaway Postgres passed in as
  `E2E_DATABASE_URL`; it refuses anything that looks hosted. There's no CI job
  running it, so it only protects the code when someone remembers to run it.
- The battery has no coverage for the SMS rung or phone enrolment — both ship
  dark until Twilio credentials exist (see Enhancements), so there is nothing to
  assert yet. Add it at the same time as the rung.
- `scripts/copy-legacy.mjs` copies ~48MB of client images into `public/` on every
  build. Fine today; worth a content hash or a CDN split if build times grow.
- Migrations run from a seat under the Neon owner role. There's no provisioning
  script that re-derives grants when a new table is added — adding one means
  remembering to grant `app_auth_rw` by hand (see `STATUS.md`).

## Enhancements (nice to have)

- Light the SMS second-factor rung once a Twilio Messaging sender exists.
- Light phone enrolment once a Twilio Verify service exists.
- Verify an AWKN sender domain in Resend and replace `awkn@miraclemind.dev`.
  Not cosmetic: the first real verification email landed in Gmail spam
  (2026-08-06). An investor who never finds it reads it as "the login is
  broken", so this should land before invitations go out.
- Auto-deploy on push, once the Vercel GitHub App is installed on the repo.
  Until then both targets are deployed by hand from a seat (`vercel deploy`,
  `--prod` for `main`), so the `dev` preview goes stale the moment `dev` moves.
- Pick a launch-page direction (six are in Claude Design across two rounds — see
  `docs/design-demos.md`) and rebuild it here in the app's stack.
- Reconcile `README.md`'s "75 homes" with the confirmed 80 lots. Not blocking:
  `README.md` is client-authored and was left as written.
