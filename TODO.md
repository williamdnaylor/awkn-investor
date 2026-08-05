# TODO

## Critical (blocks production)

_None._

## Bugs (broken functionality)

_None known._

## Tech Debt (code quality)

- No automated auth evidence battery yet. The flows were verified by build +
  typecheck + a live `next start` pass over the deck rewrites; the signup gate,
  TOTP challenge, backup-code single-use, rate-limit 429 and ban paths have not
  been exercised end to end against the Neon branch.
- `scripts/copy-legacy.mjs` copies ~48MB of client images into `public/` on every
  build. Fine today; worth a content hash or a CDN split if build times grow.
- Migrations run from a seat under the Neon owner role. There's no provisioning
  script that re-derives grants when a new table is added — adding one means
  remembering to grant `app_auth_rw` by hand (see `STATUS.md`).

## Enhancements (nice to have)

- Light the SMS second-factor rung once a Twilio Messaging sender exists.
- Light phone enrolment once a Twilio Verify service exists.
- Verify an AWKN sender domain in Resend and replace `awkn@miraclemind.dev`.
- Auto-deploy on push, once the Vercel GitHub App is installed on the repo.
- Resolve the 75-homes / 80-lots discrepancy between `README.md` and the launch
  brief (see `STATUS.md`).
