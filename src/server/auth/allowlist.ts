import { eq } from "drizzle-orm";

import { authDb } from "~/server/db/auth-client";
import { allowlist } from "~/server/db/schema";

export type AllowlistMode = "closed" | "gated" | "open";

interface AllowlistDb {
  query: {
    allowlist: {
      findFirst: (args: {
        where: ReturnType<typeof eq>;
      }) => Promise<{ email: string } | undefined>;
    };
  };
}

/**
 * Signup allowlist. The investor portal is invite-only by default.
 *
 * - "closed" — kill switch: every signup fails regardless of table contents
 * - "gated"  — signup succeeds only for addresses present in the table
 * - "open"   — anyone may sign up. Must be set EXPLICITLY in env; an empty
 *              allowlist table never means "open".
 */
export async function isEmailAllowed(
  email: string,
  mode: AllowlistMode,
  db: AllowlistDb = authDb
): Promise<boolean> {
  if (mode === "closed") return false;
  if (mode === "open") return true;
  const row = await db.query.allowlist.findFirst({
    where: eq(allowlist.email, email.toLowerCase()),
  });
  return Boolean(row);
}
