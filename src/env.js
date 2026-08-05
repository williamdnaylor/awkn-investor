import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Every var here is OPTIONAL by design: a zero-env `next build` must stay green
 * (Vercel builds the app before env is attached, and CI runs bare). Anything
 * genuinely required fails CLOSED at runtime instead — see src/server/auth
 * (secret + database) and the delivery modules (email/otp/sms), each of which
 * hard-throws in production when its provider is missing.
 */
export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    /** Neon pooled connection, app role. */
    DATABASE_URL: z.string().url().optional(),
    /**
     * Connection used by the Better Auth drizzle adapter. Falls back to
     * DATABASE_URL; split out so auth writes can be scoped to their own role
     * later without touching call sites.
     */
    AUTH_DATABASE_URL: z.string().url().optional(),

    BETTER_AUTH_SECRET: z.string().min(32).optional(),
    BETTER_AUTH_URL: z.string().url().optional(),

    /**
     * "closed"  — nobody may sign up; allowlist rows are the only way in
     * "gated"   — signup allowed iff the email is on the allowlist (default)
     * "open"    — anyone may sign up (must be set EXPLICITLY, never inferred)
     */
    ALLOWLIST_MODE: z.enum(["closed", "gated", "open"]).default("gated"),

    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),

    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    /** Twilio Verify service — phone-number enrolment (Twilio owns the code). */
    TWILIO_VERIFY_SERVICE_SID: z.string().optional(),
    /** Twilio Messaging — 2FA OTP delivery (Better Auth owns the code). */
    TWILIO_MESSAGING_SERVICE_SID: z.string().optional(),
    TWILIO_FROM_NUMBER: z.string().optional(),

    /** Set by Vercel; used to derive baseURL on preview deployments. */
    VERCEL_URL: z.string().optional(),
    VERCEL_BRANCH_URL: z.string().optional(),
    VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),
  },

  client: {},

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_DATABASE_URL: process.env.AUTH_DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    ALLOWLIST_MODE: process.env.ALLOWLIST_MODE,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_VERIFY_SERVICE_SID: process.env.TWILIO_VERIFY_SERVICE_SID,
    TWILIO_MESSAGING_SERVICE_SID: process.env.TWILIO_MESSAGING_SERVICE_SID,
    TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER,
    VERCEL_URL: process.env.VERCEL_URL,
    VERCEL_BRANCH_URL: process.env.VERCEL_BRANCH_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
