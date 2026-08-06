"use client";

import { useEffect, useState } from "react";

import { PasswordInput } from "~/components/password-input";
import { Button, Card, Notice } from "~/components/ui";
import { authClient } from "~/lib/auth-client";

/** Mirrors `emailAndPassword.minPasswordLength` in src/server/auth/index.ts. */
const MIN_LENGTH = 8;

export function PasswordSection() {
  /**
   * A passkey-only account has no `credential` row and therefore no password
   * to change — Better Auth would reject the call. Ask the server which
   * providers are linked rather than guessing from the session.
   */
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void authClient.listAccounts().then((res) => {
      if (!live) return;
      setHasPassword(
        (res.data ?? []).some((a) => a.providerId === "credential")
      );
    });
    return () => {
      live = false;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNote(null);

    if (next !== confirm) {
      setError("The new passwords don't match.");
      return;
    }
    if (next.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`);
      return;
    }

    setBusy(true);
    const res = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: signOutOthers,
    });
    setBusy(false);

    if (res.error) {
      setError(
        res.error.message ??
          // haveIBeenPwned rejects here too, with its own message.
          "That didn't work. Check your current password and try again."
      );
      return;
    }

    setCurrent("");
    setNext("");
    setConfirm("");
    setNote(
      signOutOthers
        ? "Password changed. Every other session has been signed out."
        : "Password changed."
    );
  }

  if (hasPassword === null) return null;

  if (!hasPassword) {
    return (
      <Card title="Password">
        <p className="text-sm text-ink-soft">
          This account signs in with a passkey and has no password set. To add
          one, sign out and use{" "}
          <span className="font-medium">Forgot password</span> — the emailed
          link sets a password without disturbing your passkey.
        </p>
      </Card>
    );
  }

  return (
    <Card
      title="Password"
      description="Changing it does not affect your passkeys or your second factor."
    >
      {error ? <Notice tone="error">{error}</Notice> : null}
      {note ? <Notice tone="success">{note}</Notice> : null}

      <form onSubmit={submit} className="space-y-4">
        <PasswordInput
          label="Current password"
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
        />
        <PasswordInput
          label="New password"
          value={next}
          onChange={setNext}
          autoComplete="new-password"
          minLength={MIN_LENGTH}
        />
        <PasswordInput
          label="Confirm new password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          minLength={MIN_LENGTH}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={signOutOthers}
            onChange={(e) => setSignOutOthers(e.target.checked)}
          />
          Sign out everywhere else
        </label>
        <Button type="submit" disabled={busy || !current || !next}>
          {busy ? "Saving…" : "Change password"}
        </Button>
      </form>
    </Card>
  );
}
