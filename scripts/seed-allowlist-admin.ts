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

const OWNER = "mmicel583@gmail.com";
const MEMBERS = [OWNER, "wdnaylor@gmail.com"];

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

  const promoted = await db.execute(
    sql`UPDATE awkn_investor_user SET role = 'admin' WHERE lower(email) = ${OWNER.toLowerCase()}`
  );
  console.log(
    `admin promotion for ${OWNER}: ${
      // No row yet simply means the account hasn't been created — rerun later.
      (promoted as unknown as { count?: number }).count ?? 0
    } row(s)`
  );

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
