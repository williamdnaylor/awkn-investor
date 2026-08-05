/**
 * "Production" for fail-closed checks means the production DEPLOYMENT, not
 * merely NODE_ENV=production — Vercel preview builds also run with
 * NODE_ENV=production and must not hard-throw on missing secrets.
 */
export function isProductionRuntime(): boolean {
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === "production";
  return process.env.NODE_ENV === "production";
}

/** True while `next build` is collecting page data — no live secrets needed. */
export function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}
