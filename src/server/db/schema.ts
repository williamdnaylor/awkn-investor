/**
 * awkn-investor database schema.
 *
 * Everything here is Better Auth's storage for the gated investor portal at
 * /portal. The client-authored decks at /, /investor-presentation and
 * /awkn-residences are static and touch no database at all.
 *
 * Table names are prefixed `awkn_investor_` via pgTableCreator so this schema
 * can share a Neon project with other AWKN apps without collisions.
 */
import {
  bigint,
  boolean,
  index,
  integer,
  pgTableCreator,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const createTable = pgTableCreator((name) => `awkn_investor_${name}`);

export const user = createTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    phoneNumber: text("phone_number"),
    phoneNumberVerified: boolean("phone_number_verified")
      .notNull()
      .default(false),
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
    // admin plugin columns — nullable, the plugin declares them required:false
    // and writes null/absent on some paths.
    role: text("role"),
    banned: boolean("banned").default(false),
    banReason: text("ban_reason"),
    banExpires: timestamp("ban_expires", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("awkn_investor_user_email_idx").on(t.email)]
);

export const session = createTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    /** Set by the admin plugin during impersonation sessions. */
    impersonatedBy: text("impersonated_by"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("awkn_investor_session_token_idx").on(t.token),
    index("awkn_investor_session_user_idx").on(t.userId),
  ]
);

export const account = createTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("awkn_investor_account_user_idx").on(t.userId)]
);

export const verification = createTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("awkn_investor_verification_identifier_idx").on(t.identifier)]
);

/** twoFactor plugin — TOTP secrets, backup codes, lockout counters. */
export const twoFactor = createTable("two_factor", {
  id: text("id").primaryKey(),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  verified: boolean("verified").notNull().default(false),
  failedVerificationCount: integer("failed_verification_count")
    .notNull()
    .default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
});

/** passkey plugin — WebAuthn credentials, the primary factor. */
export const passkey = createTable("passkey", {
  id: text("id").primaryKey(),
  name: text("name"),
  publicKey: text("public_key").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  credentialID: text("credential_id").notNull(),
  counter: integer("counter").notNull(),
  deviceType: text("device_type").notNull(),
  backedUp: boolean("backed_up").notNull(),
  transports: text("transports"),
  createdAt: timestamp("created_at", { withTimezone: true }),
  aaguid: text("aaguid"),
});

/**
 * Signup access gate. Investor materials are invite-only: a row here is the
 * only way an address can create an account. Never infer "open" from an empty
 * table — ALLOWLIST_MODE must be set explicitly to open it up.
 */
export const allowlist = createTable("allowlist", {
  email: text("email").primaryKey(),
  source: text("source", { enum: ["manual", "invite"] }).notNull(),
  addedBy: text("added_by"),
  /**
   * The role this address gets when it signs up, applied once by the
   * user-create hook. It is the *invitation's* role, not the account's — the
   * account's lives on `user.role` and is what every authorisation check reads.
   * Editing this afterwards changes nothing for anyone who has already
   * registered, which is deliberate: promotion and demotion are account
   * operations, not allowlist ones.
   */
  role: text("role", { enum: ["admin", "viewer"] })
    .notNull()
    .default("viewer"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Better Auth rate-limit store. Serverless instances share no memory, so
 * counters must live in the DB. The TS property keys `key`/`count`/
 * `lastRequest` are an adapter contract — drizzleAdapter resolves the fields
 * by these exact names. Rows self-prune on window rollover.
 */
export const rateLimit = createTable(
  "rate_limit",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    count: integer("count").notNull(),
    lastRequest: bigint("last_request", { mode: "number" }).notNull(),
  },
  (t) => [uniqueIndex("awkn_investor_rate_limit_key_idx").on(t.key)]
);
