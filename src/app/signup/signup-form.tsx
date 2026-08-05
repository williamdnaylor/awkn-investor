"use client";

import { useState } from "react";

import { PasswordInput } from "~/components/password-input";
import { Button, Notice, TextField } from "~/components/ui";
import { authClient } from "~/lib/auth-client";

export function SignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    setBusy(true);
    const res = await authClient.signUp.email({ name, email, password });
    setBusy(false);
    if (res.error) {
      setError(res.error.message ?? "We couldn't create that account.");
      return;
    }
    // requireEmailVerification: no session is issued until the link is clicked.
    setDone(true);
  }

  if (done) {
    return (
      <Notice tone="success">
        Check your email — we sent a link to confirm your address. You'll be
        signed in once you open it.
      </Notice>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? <Notice tone="error">{error}</Notice> : null}
      <TextField
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="name"
        required
      />
      <TextField
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        required
      />
      <PasswordInput
        label="Password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        minLength={8}
        describedBy="pw-hint"
      />
      <p id="pw-hint" className="text-xs text-ink-soft">
        At least 8 characters. Passwords found in known breaches are rejected.
      </p>
      <PasswordInput
        label="Confirm password"
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
        minLength={8}
      />
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Creating…" : "Create account"}
      </Button>
    </form>
  );
}
