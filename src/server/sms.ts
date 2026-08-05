import "server-only";

import { env } from "~/env";
import { writeStub } from "~/server/email";
import { isProductionRuntime } from "~/server/runtime-env";

/**
 * SMS DELIVERY ONLY — custody note.
 *
 * This module is a dumb pipe: Better Auth's twoFactor plugin generates,
 * stores and verifies the OTP; we only carry the finished string to the
 * handset. Contrast src/server/otp.ts, where Twilio Verify owns the code end
 * to end and this app never sees it. Keeping the two separate keeps the
 * custody boundary legible — do not merge them.
 *
 * Twilio Messaging needs a *sendable sender*: either a Messaging Service SID
 * or a from-number. Account credentials alone are not enough, so smsMode()
 * reports "unavailable" until one exists — and src/server/auth/index.ts uses
 * that to omit `otpOptions` entirely, so "otp" never appears in
 * twoFactorMethods on a deployment that could not actually deliver it.
 */
export type SmsMode = "twilio" | "stub" | "unavailable";

export function smsMode(): SmsMode {
  const hasAccount = Boolean(
    env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN
  );
  const hasSender = Boolean(
    env.TWILIO_MESSAGING_SERVICE_SID ?? env.TWILIO_FROM_NUMBER
  );
  if (hasAccount && hasSender) return "twilio";
  // Outside production a stub keeps the whole SMS rung testable with no
  // Twilio account at all. In production, no sender means no rung.
  if (!isProductionRuntime()) return "stub";
  return "unavailable";
}

export interface OutboundSms {
  to: string;
  body: string;
}

export async function sendSms(message: OutboundSms): Promise<void> {
  const mode = smsMode();

  if (mode === "unavailable") {
    throw new Error("SMS is not configured on this deployment.");
  }

  if (mode === "stub") {
    await writeStub("sms-outbox", message);
    return;
  }

  const sid = env.TWILIO_ACCOUNT_SID!;
  const token = env.TWILIO_AUTH_TOKEN!;
  const body = new URLSearchParams({ To: message.to, Body: message.body });
  if (env.TWILIO_MESSAGING_SERVICE_SID) {
    body.set("MessagingServiceSid", env.TWILIO_MESSAGING_SERVICE_SID);
  } else {
    body.set("From", env.TWILIO_FROM_NUMBER!);
  }

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    }
  );

  if (!res.ok) {
    // Never echo the response body — it can contain the message text.
    throw new Error(`Twilio Messaging rejected the send (${res.status}).`);
  }
}
