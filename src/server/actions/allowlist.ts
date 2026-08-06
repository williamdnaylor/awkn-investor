"use server";

import { revalidatePath } from "next/cache";
import { asc, eq } from "drizzle-orm";

import { authDb } from "~/server/db/auth-client";
import { allowlist } from "~/server/db/schema";
import { requireAdmin } from "~/server/auth/guards";
import { sendEmail } from "~/server/email";

export interface AllowlistRow {
  email: string;
  source: "manual" | "invite";
  addedBy: string | null;
  role: "admin" | "viewer";
  createdAt: Date;
}

export async function listAllowlist(): Promise<AllowlistRow[]> {
  await requireAdmin();
  return authDb
    .select()
    .from(allowlist)
    .orderBy(asc(allowlist.createdAt)) as unknown as Promise<AllowlistRow[]>;
}

export async function inviteEmail(
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  const session = await requireAdmin();
  const raw = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
    return { ok: false, message: "That doesn't look like an email address." };
  }

  /**
   * Anything that isn't the literal "admin" is a viewer. Whitelisting the one
   * privileged value rather than trusting the field means a malformed or
   * tampered submission fails towards least privilege.
   */
  const role = formData.get("role") === "admin" ? "admin" : "viewer";

  await authDb
    .insert(allowlist)
    .values({ email: raw, source: "invite", addedBy: session.user.email, role })
    /**
     * Re-inviting is how you change your mind about an invitation, so the role
     * is updated rather than ignored. It only affects accounts that do not
     * exist yet — the role is copied onto the user row once, at signup — so
     * this can never silently promote someone who has already registered.
     */
    .onConflictDoUpdate({ target: allowlist.email, set: { role } });

  await sendEmail({
    to: raw,
    subject: "You've been invited to the AWKN investor portal",
    text: [
      `${session.user.name || session.user.email} invited you to the AWKN investor portal.`,
      "",
      "Create your account here — use this exact address:",
      `${process.env.BETTER_AUTH_URL ?? ""}/signup`,
    ].join("\n"),
  });

  revalidatePath("/portal/settings");
  return {
    ok: true,
    message: `Invited ${raw}${role === "admin" ? " as an administrator" : ""}.`,
  };
}

export async function removeEmail(
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  const raw = String(formData.get("email") ?? "").trim().toLowerCase();
  await authDb.delete(allowlist).where(eq(allowlist.email, raw));
  revalidatePath("/portal/settings");
  // Existing accounts keep working — the allowlist gates signup, not sign-in.
  return { ok: true, message: `Removed ${raw} from the invitation list.` };
}
