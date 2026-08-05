import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { env } from "~/env";
import { isProductionRuntime } from "~/server/runtime-env";

/**
 * Transactional email. Dual-mode by design:
 *
 * - RESEND_API_KEY present -> real delivery via Resend.
 * - absent -> the message is written to var/outbox/*.json so local dev and the
 *   evidence battery can assert on what *would* have been sent without ever
 *   touching a real inbox.
 *
 * Production hard-throws instead of silently falling back to the stub: a
 * verification email that vanishes into a file on a serverless box is a
 * lockout, not a degradation.
 */
export interface OutboundEmail {
  to: string;
  subject: string;
  text: string;
}

const FROM = env.EMAIL_FROM ?? "AWKN Investor <onboarding@resend.dev>";

export function emailMode(): "resend" | "stub" {
  return env.RESEND_API_KEY ? "resend" : "stub";
}

export async function sendEmail(message: OutboundEmail): Promise<void> {
  if (!env.RESEND_API_KEY) {
    if (isProductionRuntime()) {
      throw new Error(
        "RESEND_API_KEY is required in production — refusing to drop mail to the outbox stub."
      );
    }
    await writeStub("outbox", message);
    return;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: FROM,
    to: message.to,
    subject: message.subject,
    text: message.text,
  });
  if (error) {
    throw new Error(`Resend refused the message: ${error.message}`);
  }
}

/** Shared by email.ts and sms.ts — same stub shape, different directory. */
export async function writeStub(
  dir: "outbox" | "sms-outbox",
  payload: unknown
): Promise<void> {
  const target = path.join(process.cwd(), "var", dir);
  await mkdir(target, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  await writeFile(
    path.join(target, `${stamp}-${Math.random().toString(36).slice(2, 8)}.json`),
    JSON.stringify(payload, null, 2),
    "utf8"
  );
}
