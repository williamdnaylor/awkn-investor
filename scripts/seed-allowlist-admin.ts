/**
 * Idempotent bootstrap. Safe to run BEFORE anyone has signed up (it seeds the
 * allowlist so they can) and AFTER (it promotes the owner to admin). Rerun it
 * once the owner's account exists to complete the promotion.
 *
 *   MIGRATION_DATABASE_URL=... npm run seed:admin
 */
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { allowlist } from "../src/server/db/schema";

/**
 * The two principals. Both are admins: each needs to invite investors without
 * going through the other. Everyone they invite signs up as a `viewer` — see
 * `admin({ defaultRole: "viewer" })` in src/server/auth/index.ts.
 */
const ADMINS = ["mmicel583@gmail.com", "wdnaylor@gmail.com"];
const MEMBERS = ADMINS;

async function main() {
  const url =
    process.env.MIGRATION_DATABASE_URL ??
    process.env.AUTH_DATABASE_URL ??
    process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Set MIGRATION_DATABASE_URL (or DATABASE_URL) before seeding."
    );
  }

  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema: { allowlist } });

  for (const email of MEMBERS) {
    await db
      .insert(allowlist)
      .values({ email: email.toLowerCase(), source: "manual", addedBy: "seed" })
      .onConflictDoNothing();
    console.log(`allowlist: ${email}`);
  }

  for (const email of ADMINS) {
    const promoted = await db.execute(
      sql`UPDATE awkn_investor_user SET role = 'admin' WHERE lower(email) = ${email.toLowerCase()}`
    );
    console.log(
      `admin promotion for ${email}: ${
        // No row yet simply means the account hasn't been created — rerun later.
        (promoted as unknown as { count?: number }).count ?? 0
      } row(s)`
    );
  }

  /**
   * Backfill. The admin plugin's default role used to be `user`, and rows
   * created before it was set carry NULL. Neither name means anything to the
   * portal now — everything that isn't an admin is a viewer.
   */
  const backfilled = await db.execute(
    sql`UPDATE awkn_investor_user SET role = 'viewer'
        WHERE role IS NULL OR role = 'user'`
  );
  console.log(
    `viewer backfill: ${
      (backfilled as unknown as { count?: number }).count ?? 0
    } row(s)`
  );

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
