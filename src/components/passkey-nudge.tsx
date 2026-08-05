"use client";

import { useEffect, useState } from "react";
import { Fingerprint, X } from "lucide-react";

import { authClient } from "~/lib/auth-client";

const DISMISSED = "awkn-passkey-nudge-dismissed";

/**
 * Shown once per browsing session to accounts with no passkey. Dismissal is
 * sessionStorage, not a database flag — it should come back on the next visit
 * until they actually have one.
 */
export function PasskeyNudge() {
  const { data: passkeys } = authClient.useListPasskeys();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISSED) === "1");
  }, []);

  if (dismissed || !passkeys || passkeys.length > 0) return null;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-lantern/50 bg-lantern/10 px-4 py-3 text-sm">
      <Fingerprint className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="flex-1">
        Add a passkey and you can sign in with your device instead of a
        password.{" "}
        <a href="/portal/settings#passkeys" className="underline underline-offset-4">
          Set one up
        </a>
        .
      </p>
      <button
        aria-label="Dismiss"
        onClick={() => {
          sessionStorage.setItem(DISMISSED, "1");
          setDismissed(true);
        }}
        className="text-ink-soft hover:text-ink"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
