"use client";

import Link from "next/link";
import { useState } from "react";

import { Button, Notice, TextField } from "~/components/ui";
import { authClient } from "~/lib/auth-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });
    setBusy(false);
    // Always the same response, whether or not the address exists — otherwise
    // this page becomes an account-enumeration oracle.
    setSent(true);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-16">
      <h1 className="font-display text-3xl">Reset your password</h1>
      {sent ? (
        <div className="mt-6">
          <Notice tone="success">
            If that address has an account, a reset link is on its way.
          </Notice>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-4">
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
      <p className="mt-6 text-sm">
        <Link href="/login" className="underline underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
