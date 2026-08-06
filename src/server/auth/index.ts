import "server-only";

import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins/admin";
import { haveIBeenPwned } from "better-auth/plugins/haveibeenpwned";
import { phoneNumber } from "better-auth/plugins/phone-number";
import { twoFactor } from "better-auth/plugins/two-factor";
import { passkey } from "@better-auth/passkey";

import { env } from "~/env";
import { baseURL } from "~/lib/base-url";
import { authDb } from "~/server/db/auth-client";
import {
  account,
  passkey as passkeyTable,
  rateLimit,
  session,
  twoFactor as twoFactorTable,
  user,
  verification,
} from "~/server/db/schema";
import { checkAllowlist } from "~/server/auth/allowlist";
import { sendEmail } from "~/server/email";
import { checkPhoneVerification, otpMode, startPhoneVerification } from "~/server/otp";
import { isBuildPhase, isProductionRuntime } from "~/server/runtime-env";
import { sendSms, smsMode } from "~/server/sms";

const APP_NAME = "AWKN Investor";

/**
 * Development-only fallback secret. Production refuses to boot without a real
 * one — a predictable secret would let anyone forge the cookie-cache snapshot
 * the edge gate trusts.
 */
const DEV_SECRET = "awkn-investor-development-secret-do-not-use-in-production";

if (isProductionRuntime() && !isBuildPhase()) {
  if (!env.BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_SECRET is required in production.");
  }
  if (!env.AUTH_DATABASE_URL && !env.DATABASE_URL) {
    throw new Error("AUTH_DATABASE_URL (or DATABASE_URL) is required in production.");
  }
}

function trustedOrigins(): string[] {
  const origins = new Set<string>([baseURL()]);
  if (env.VERCEL_URL) origins.add(`https://${env.VERCEL_URL}`);
  if (env.VERCEL_BRANCH_URL) origins.add(`https://${env.VERCEL_BRANCH_URL}`);
  if (env.NODE_ENV !== "production") origins.add("http://localhost:3000");
  return [...origins];
}

/** Deliberately identical for "not invited" and "already registered". */
const GATE_MESSAGE =
  "This address can't create an account. If you were sent an invitation, use the exact address it was sent to.";

export const auth = betterAuth({
  appName: APP_NAME,
  baseURL: baseURL(),
  secret: env.BETTER_AUTH_SECRET ?? DEV_SECRET,
  trustedOrigins: trustedOrigins(),

  database: drizzleAdapter(authDb, {
    provider: "pg",
    schema: {
      user,
      session,
      account,
      verification,
      twoFactor: twoFactorTable,
      passkey: passkeyTable,
      // Literal key — the adapter resolves the rate-limit model by this name.
      rateLimit,
    },
  }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // No session is issued until the verification link is clicked.
    requireEmailVerification: true,
    sendResetPassword: async ({ user: target, url }) => {
      await sendEmail({
        to: target.email,
        subject: `Reset your ${APP_NAME} password`,
        text: [
          `Someone asked to reset the password for this ${APP_NAME} account.`,
          "",
          url,
          "",
          "If that wasn't you, ignore this message — nothing has changed.",
        ].join("\n"),
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user: target, url }) => {
      await sendEmail({
        to: target.email,
        subject: `Confirm your ${APP_NAME} address`,
        text: [
          `Confirm this address to finish setting up your ${APP_NAME} account.`,
          "",
          url,
        ].join("\n"),
      });
    },
  },

  databaseHooks: {
    user: {
      create: {
        /**
         * The allowlist gate, and the one place a role is granted at signup.
         * Runs before the row exists, so a rejected signup leaves nothing
         * behind.
         *
         * The role comes from the invitation rather than from a list of
         * addresses in code, so promoting someone is a row and not a deploy.
         * `role` is not in `user.additionalFields` and the admin plugin marks
         * it `input: false`, so a client cannot send one — the only value that
         * can reach the row is the one this hook reads out of the database.
         */
        before: async (candidate) => {
          const verdict = await checkAllowlist(
            candidate.email,
            env.ALLOWLIST_MODE
          );
          if (!verdict.allowed) {
            throw new APIError("FORBIDDEN", { message: GATE_MESSAGE });
          }
          return {
            data: verdict.role
              ? { ...candidate, role: verdict.role }
              : candidate,
          };
        },
      },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    /**
     * Signed snapshot the edge gate can verify without a DB round trip. It
     * expires long before the session does — see src/proxy.ts for the refresh
     * bounce that keeps an expired snapshot from reading as "logged out".
     */
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },

  rateLimit: {
    enabled: true,
    // Serverless instances share no memory; in-memory counters enforce nothing.
    storage: env.AUTH_DATABASE_URL ?? env.DATABASE_URL ? "database" : "memory",
  },

  user: {
    additionalFields: {
      phoneNumber: { type: "string", required: false, input: false },
      phoneNumberVerified: { type: "boolean", required: false, input: false },
    },
  },

  plugins: [
    passkey({ rpName: APP_NAME }),

    twoFactor({
      issuer: APP_NAME,
      // Passkey-only accounts have no password to re-prompt for.
      allowPasswordless: true,
      backupCodeOptions: { allowPasswordless: true },
      /**
       * SMS 2FA rides here, not on the phoneNumber plugin. The conditional
       * spread matters: configuring sendOTP unconditionally would advertise
       * "otp" in twoFactorMethods on a deployment that cannot deliver it.
       */
      ...(smsMode() !== "unavailable"
        ? {
            otpOptions: {
              sendOTP: async ({ user: target, otp }) => {
                const phone = (target as { phoneNumber?: string | null })
                  .phoneNumber;
                const verified = (
                  target as { phoneNumberVerified?: boolean | null }
                ).phoneNumberVerified;
                if (!phone || !verified) {
                  throw new APIError("BAD_REQUEST", {
                    message: "Add and verify a phone number before using SMS codes.",
                  });
                }
                await sendSms({
                  to: phone,
                  body: `${otp} is your ${APP_NAME} verification code.`,
                });
              },
            },
          }
        : {}),
    }),

    /**
     * Phone enrolment — Twilio Verify custody: it generates and checks the
     * code, so the `code` Better Auth hands us here is deliberately discarded.
     *
     * Registered unconditionally (a conditional entry would collapse the
     * plugin tuple and lose type inference for every plugin after it); the
     * rung is gated by otpMode() instead — startPhoneVerification throws when
     * no Verify service exists, and the settings surface is hidden entirely.
     */
    phoneNumber({
      sendOTP: async ({ phoneNumber: to }) => {
        if (otpMode() === "unavailable") {
          throw new APIError("BAD_REQUEST", {
            message: "Phone verification isn't available on this deployment.",
          });
        }
        await startPhoneVerification(to);
      },
      verifyOTP: async ({ phoneNumber: to, code }) =>
        otpMode() === "unavailable" ? false : checkPhoneVerification(to, code),
    }),

    /**
     * Two roles, no more. A `viewer` reads the decks and manages their own
     * account; an `admin` additionally invites people. Everyone who signs up
     * through an invitation is a viewer — admin is granted out of band by
     * `npm run seed:admin`, so the portal has no path to escalate itself.
     */
    admin({ defaultRole: "viewer", adminRoles: ["admin"] }),
    haveIBeenPwned(),

    // MUST stay last: it flushes Better Auth's Set-Cookie headers into the
    // Next.js response.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
