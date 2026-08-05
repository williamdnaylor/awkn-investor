# TODO

## Critical (blocks production)

_None._

## Bugs (broken functionality)

_None known._

## Tech Debt (code quality)

- No automated auth evidence battery yet. Verified by hand against production:
  deck rewrites, the `/portal` gate (both the HTML redirect and the API 401),
  the CSRF origin check, the allowlist gate in both directions, and the
  verification email actually leaving Resend. Still unexercised: TOTP challenge,
  backup-code single-use, trusted-device skip, rate-limit 429, ban, HIBP
  rejection. Those want a scripted battery (mirror mira-viz
  `scripts/e2e-auth-battery.ts`) with `RESEND_API_KEY`/`TWILIO_*` blanked in the
  spawned env so it can never send anything real.
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
- Upload the three launch-page demos to Claude Design once Matthew completes the
  MCP authorization, and record the links in `docs/design-demos.md`.
- Resolve the 75-homes / 80-lots discrepancy between `README.md` and the launch
  brief (see `STATUS.md`).
