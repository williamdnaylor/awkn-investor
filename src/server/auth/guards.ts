import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth, type Session } from "~/server/auth";

/**
 * DB-backed session read. The edge gate works off a five-minute cookie
 * snapshot; anything that authorises an action must ask the database instead,
 * so a revoked session or a fresh ban takes effect immediately.
 */
export async function getSessionOrNull(): Promise<Session | null> {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireSession(): Promise<Session> {
  const session = await getSessionOrNull();
  if (!session) redirect("/login");
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (session.user.role !== "admin") {
    throw new Error("FORBIDDEN");
  }
  return session;
}

export async function isAdmin(): Promise<boolean> {
  const session = await getSessionOrNull();
  return session?.user.role === "admin";
}
