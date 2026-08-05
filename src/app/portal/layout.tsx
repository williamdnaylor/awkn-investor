import Link from "next/link";

import { requireSession } from "~/server/auth/guards";
import { SignOutButton } from "~/components/sign-out-button";

export default async function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSession();

  return (
    <div className="min-h-dvh">
      <header className="border-b border-ink/15">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/portal" className="font-display text-lg">
            AWKN Investor
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/portal" className="hover:underline underline-offset-4">
              Materials
            </Link>
            <Link
              href="/portal/settings"
              className="hover:underline underline-offset-4"
            >
              Settings
            </Link>
            <span className="hidden text-ink-soft sm:inline">
              {session.user.email}
            </span>
            <SignOutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl px-6 py-10">{children}</main>
    </div>
  );
}
