import Link from "next/link";

import { PasskeyNudge } from "~/components/passkey-nudge";
import { requireSession } from "~/server/auth/guards";

export const metadata = { title: "Materials — AWKN Investor" };

/** The client-authored decks, served from this same host. */
const MATERIALS = [
  {
    href: "/investor-presentation",
    title: "Investor presentation",
    blurb: "The full deck.",
  },
  {
    href: "/awkn-residences",
    title: "AWKN Residences",
    blurb: "The residences overview.",
  },
  {
    href: "/",
    title: "Landing page",
    blurb: "The one-page summary that gets shared by link.",
  },
];

export default async function PortalPage() {
  const session = await requireSession();
  const firstName = session.user.name?.split(" ")[0];

  return (
    <div className="space-y-8">
      <PasskeyNudge />

      <div>
        <h1 className="font-display text-3xl">
          {firstName ? `Welcome, ${firstName}` : "Welcome"}
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Everything here is private. Please don't forward these links.
        </p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2">
        {MATERIALS.map((m) => (
          <li key={m.href}>
            <Link
              href={m.href}
              className="block h-full rounded-lg border border-ink/15 bg-white/60 p-5 transition hover:border-ink/40"
            >
              <span className="font-display text-lg">{m.title}</span>
              <span className="mt-1 block text-sm text-ink-soft">{m.blurb}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
