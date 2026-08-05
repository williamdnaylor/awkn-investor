import "server-only";
import { randomInt } from "node:crypto";

import { and, eq, gt } from "drizzle-orm";

import { env } from "~/env";
import { authDb } from "~/server/db/auth-client";
import { verification } from "~/server/db/schema";
import { isProductionRuntime } from "~/server/runtime-env";

/**
 * PHONE-NUMBER ENROLMENT — custody note.
 *
 * Twilio Verify owns the code: it generates it, sends it, and checks it. This
 * app never sees or stores the digits. That is the opposite of
 * src/server/sms.ts, where Better Auth owns the code and Twilio is only a
 * pipe. Two custody models, two modules — deliberately not merged.
 *
 * Without a Verify service SID, a dev stub takes over and stashes a code in
 * the `verification` table so enrolment stays end-to-end testable offline.
 * Production refuses the stub.
 */
const STUB_PREFIX = "phone-otp:";
const STUB_TTL_MS = 10 * 60 * 1000;

export type OtpMode = "twilio-verify" | "stub" | "unavailable";

export function otpMode(): OtpMode {
  if (
    env.TWILIO_ACCOUNT_SID &&
    env.TWILIO_AUTH_TOKEN &&
    env.TWILIO_VERIFY_SERVICE_SID
  ) {
    return "twilio-verify";
  }
  // Offline the stub keeps enrolment testable end to end. In production a
  // missing Verify service means the rung does not exist — auth/index.ts omits
  // the phoneNumber plugin entirely rather than offering a dead surface.
  return isProductionRuntime() ? "unavailable" : "stub";
}

function assertStubAllowed(): void {
  if (otpMode() === "unavailable") {
    throw new Error(
      "TWILIO_VERIFY_SERVICE_SID is required in production — refusing to use the phone-verification stub."
    );
  }
}

export async function startPhoneVerification(phoneNumber: string): Promise<void> {
  if (otpMode() === "stub") {
    assertStubAllowed();
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await authDb
      .insert(verification)
      .values({
        id: crypto.randomUUID(),
        identifier: `${STUB_PREFIX}${phoneNumber}`,
        value: code,
        expiresAt: new Date(Date.now() + STUB_TTL_MS),
      });
    return;
  }

  const sid = env.TWILIO_ACCOUNT_SID!;
  const res = await fetch(
    `https://verify.twilio.com/v2/Services/${env.TWILIO_VERIFY_SERVICE_SID}/Verifications`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: phoneNumber, Channel: "sms" }),
    }
  );
  if (!res.ok) {
    throw new Error(`Twilio Verify refused to start verification (${res.status}).`);
  }
}

export async function checkPhoneVerification(
  phoneNumber: string,
  code: string
): Promise<boolean> {
  if (otpMode() === "stub") {
    assertStubAllowed();
    const row = await authDb.query.verification.findFirst({
      where: and(
        eq(verification.identifier, `${STUB_PREFIX}${phoneNumber}`),
        gt(verification.expiresAt, new Date())
      ),
    });
    if (!row || row.value !== code) return false;
    await authDb.delete(verification).where(eq(verification.id, row.id));
    return true;
  }

  const sid = env.TWILIO_ACCOUNT_SID!;
  const res = await fetch(
    `https://verify.twilio.com/v2/Services/${env.TWILIO_VERIFY_SERVICE_SID}/VerificationCheck`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: phoneNumber, Code: code }),
    }
  );
  if (!res.ok) return false;
  const payload = (await res.json()) as { status?: string };
  return payload.status === "approved";
}
