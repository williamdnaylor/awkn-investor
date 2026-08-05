import { type Config } from "drizzle-kit";

/**
 * Migrations run against the OWNER connection, never the app role.
 * `db:push` is for local scratch databases only — production schema changes
 * go through generate → review → migrate.
 */
export default {
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.MIGRATION_DATABASE_URL ??
      process.env.DATABASE_URL ??
      "postgresql://unconfigured",
  },
  tablesFilter: ["awkn_investor_*"],
} satisfies Config;
