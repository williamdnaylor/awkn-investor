"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { PasswordInput } from "~/components/password-input";
import { Button, Notice } from "~/components/ui";
import { authClient } from "~/lib/auth-client";

export function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <div className="space-y-4">
        <Notice tone="error">
          This link is missing its token. Reset links expire — request a fresh
          one.
        </Notice>
        <Link href="/forgot-password" className="underline underline-offset-4">
          Request a new link
        </Link>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    setBusy(true);
    const res = await authClient.resetPassword({ newPassword: password, token: token! });
    setBusy(false);
    if (res.error) {
      setError(res.error.message ?? "That link is no longer valid.");
      return;
    }
    setDone(true);
    router.push("/login");
  }

  if (done) {
    return <Notice tone="success">Password changed. Signing you back in…</Notice>;
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? <Notice tone="error">{error}</Notice> : null}
      <PasswordInput
        label="New password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        minLength={8}
      />
      <PasswordInput
        label="Confirm new password"
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
        minLength={8}
      />
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Saving…" : "Save password"}
      </Button>
    </form>
  );
}
