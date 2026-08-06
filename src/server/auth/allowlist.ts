import { eq } from "drizzle-orm";

import { authDb } from "~/server/db/auth-client";
import { allowlist } from "~/server/db/schema";

export type AllowlistMode = "closed" | "gated" | "open";
export type Role = "admin" | "viewer";

/** What the allowlist says about an address: may it sign up, and as what. */
export interface AllowlistVerdict {
  allowed: boolean;
  /** Undefined when nothing was matched — the caller applies its own default. */
  role?: Role;
}

interface AllowlistDb {
  query: {
    allowlist: {
      findFirst: (args: {
        where: ReturnType<typeof eq>;
      }) => Promise<{ email: string; role?: Role } | undefined>;
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
 *
 * In "open" mode there may be no row at all, so no role comes back and the
 * caller falls through to the plugin's `defaultRole`. That is the only correct
 * answer: an address nobody invited cannot have been invited as an admin.
 */
export async function checkAllowlist(
  email: string,
  mode: AllowlistMode,
  db: AllowlistDb = authDb
): Promise<AllowlistVerdict> {
  if (mode === "closed") return { allowed: false };

  const row = await db.query.allowlist.findFirst({
    where: eq(allowlist.email, email.toLowerCase()),
  });

  if (mode === "open") return { allowed: true, role: row?.role };
  return row ? { allowed: true, role: row.role } : { allowed: false };
}

/** Back-compat shorthand for the callers that only care whether to refuse. */
export async function isEmailAllowed(
  email: string,
  mode: AllowlistMode,
  db: AllowlistDb = authDb
): Promise<boolean> {
  return (await checkAllowlist(email, mode, db)).allowed;
}
