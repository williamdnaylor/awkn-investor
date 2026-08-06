import { env } from "~/env";

/**
 * Where this deployment lives.
 *
 * Preview deployments get a fresh VERCEL_URL per deployment, which breaks
 * passkey origins and email links; VERCEL_BRANCH_URL is stable per branch, so
 * prefer it. BETTER_AUTH_URL always wins when set explicitly.
 *
 * Deliberately shared rather than duplicated: Better Auth uses it for passkey
 * origins and email links, and the root layout uses it as `metadataBase` so
 * `og:image` resolves to an absolute URL. A scraper following an origin the
 * auth layer disagrees with would unfurl against a host that redirects it.
 * This file imports nothing but `env`, so it is safe on both the client and
 * the edge.
 */
export function baseURL(): string {
  if (env.BETTER_AUTH_URL) return env.BETTER_AUTH_URL;
  if (env.VERCEL_ENV === "preview" && env.VERCEL_BRANCH_URL) {
    return `https://${env.VERCEL_BRANCH_URL}`;
  }
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return "http://localhost:3000";
}
