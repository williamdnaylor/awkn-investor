import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "~/env";
import * as schema from "./schema";

/**
 * Better Auth's Postgres connection.
 *
 * Constructed eagerly (the drizzleAdapter needs a live object at
 * config-build time), but postgres.js connects LAZILY on first query — so a
 * missing AUTH_DATABASE_URL never breaks the zero-env build. The placeholder
 * string keeps construction from throwing; production without a real URL is
 * refused explicitly in src/server/auth/index.ts (fail closed there, not here).
 */
const globalForAuthDb = globalThis as unknown as {
  authConn: ReturnType<typeof postgres> | undefined;
};

const connectionString =
  env.AUTH_DATABASE_URL ??
  env.DATABASE_URL ??
  "postgresql://unconfigured:unconfigured@localhost:5432/unconfigured";

const authConn =
  globalForAuthDb.authConn ?? postgres(connectionString, { prepare: false });
if (env.NODE_ENV !== "production") globalForAuthDb.authConn = authConn;

export const authDb = drizzle(authConn, { schema });
