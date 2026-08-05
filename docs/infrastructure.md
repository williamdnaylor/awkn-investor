# Infrastructure

## Identifiers

| Thing | Value |
|---|---|
| Vercel team | `team_a1Y4XHwSdYpHihYBHD18hSdj` (awkn) |
| Vercel project | `prj_F5bA2akluNWd8fMnXH7l4MI5HbW1` (`awkn-investor`) |
| Neon org | `org-floral-shape-08728854` |
| Neon project | `dry-dream-85196954` (`awkn-investor`) |
| Neon default branch | `br-dark-lab-ayg6ola4` |
| GitHub repo | `williamdnaylor/awkn-investor` (we have write, not admin) |

## Database roles

- `neondb_owner` — owns the schema. Used **only** for migrations and seeding,
  via `MIGRATION_DATABASE_URL`. Never shipped to the app.
- `app_auth_rw` — what the deployed app connects as. `SELECT/INSERT/UPDATE/DELETE`
  on the eight `awkn_investor_*` tables and nothing else; verified it cannot
  `CREATE TABLE`.

**Adding a table means granting it by hand.** There are no default privileges for
`app_auth_rw`, deliberately — a new table is invisible to the app until someone
grants it. Add the grant in the same change as the migration.

## Environment variables

Set on Vercel for **Production and Preview** (names only — values live in the
Vercel project and Infisical):

| Name | Purpose |
|---|---|
| `DATABASE_URL` | pooled Neon URI, `app_auth_rw` |
| `AUTH_DATABASE_URL` | same connection; split out so auth can move roles later |
| `BETTER_AUTH_SECRET` | signs the session cookie cache |
| `RESEND_API_KEY` | transactional email |
| `EMAIL_FROM` | sender identity |
| `ALLOWLIST_MODE` | `gated` — invite-only signup |

Set on **Production only**:

| Name | Purpose |
|---|---|
| `BETTER_AUTH_URL` | `https://awkn-investor.vercel.app` |

Absent on purpose (each keeps a rung dark; see `STATUS.md`):
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`,
`TWILIO_MESSAGING_SERVICE_SID`, `TWILIO_FROM_NUMBER`.

`BETTER_AUTH_URL` is deliberately **not** set on Preview. It always wins in
`baseURL()`, so setting it everywhere would point every preview's passkey origin
and email links at production. Previews fall back to `VERCEL_BRANCH_URL`, which
is stable per branch — the per-deployment `VERCEL_URL` would break passkeys
registered on an earlier deployment of the same branch.

## Deploying

The Vercel GitHub App is not installed on the repo (it lives on William's
personal account and we don't have admin), so pushes don't auto-deploy.
Production ships explicitly:

```bash
vercel deploy --prod --scope <awkn team>
```

Once William installs <https://github.com/apps/vercel>, link the repo and set the
production branch to `main`; nothing else changes.

## Migrations

```bash
npm run db:generate                      # after editing the schema
MIGRATION_DATABASE_URL=<owner uri> npm run db:migrate
MIGRATION_DATABASE_URL=<owner uri> npm run seed:admin
```

`db:push` is for throwaway local databases only.
