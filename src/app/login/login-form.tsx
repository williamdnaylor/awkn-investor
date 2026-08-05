"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Fingerprint } from "lucide-react";

import { PasswordInput } from "~/components/password-input";
import { Button, Notice, TextField } from "~/components/ui";
import { authClient } from "~/lib/auth-client";

type Step = "credentials" | "2fa";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/portal";

  const [step, setStep] = useState<Step>(
    params.get("step") === "2fa" ? "2fa" : "credentials"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("error") === "unconfigured"
      ? "Sign-in is not available on this deployment yet."
      : null
  );

  const methods = (params.get("methods") ?? "totp")
    .split(",")
    .filter(Boolean);

  async function signInWithPasskey() {
    setError(null);
    setBusy(true);
    const res = await authClient.signIn.passkey();
    setBusy(false);
    if (res?.error) {
      setError(res.error.message ?? "That passkey didn't work.");
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await authClient.signIn.email({
      email,
      password,
      callbackURL: next,
    });
    setBusy(false);
    // A 2FA challenge redirects via onTwoFactorRedirect; nothing to do here.
    if (res.error) {
      setError(res.error.message ?? "Those details didn't match.");
      return;
    }
    if (res.data && "twoFactorRedirect" in res.data) return;
    router.push(next);
    router.refresh();
  }

  if (step === "2fa") {
    return <TwoFactorStep methods={methods} next={next} onBack={() => setStep("credentials")} />;
  }

  return (
    <div className="space-y-6">
      {error ? <Notice tone="error">{error}</Notice> : null}

      <Button
        variant="ghost"
        className="w-full"
        onClick={signInWithPasskey}
        disabled={busy}
      >
        <Fingerprint className="h-4 w-4" aria-hidden="true" />
        Sign in with a passkey
      </Button>

      <div className="flex items-center gap-3 text-xs text-ink-soft">
        <span className="h-px flex-1 bg-ink/15" />
        or use your password
        <span className="h-px flex-1 bg-ink/15" />
      </div>

      <form onSubmit={signInWithPassword} className="space-y-4">
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
          autoComplete="current-password"
        />
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="flex justify-between text-sm">
        <Link href="/forgot-password" className="underline underline-offset-4">
          Forgot password
        </Link>
        <Link href="/signup" className="underline underline-offset-4">
          Have an invitation?
        </Link>
      </div>
    </div>
  );
}

function TwoFactorStep({
  methods,
  next,
  onBack,
}: {
  methods: string[];
  next: string;
  onBack: () => void;
}) {
  const router = useRouter();
  const offersSms = methods.includes("otp");
  const [mode, setMode] = useState<"totp" | "otp" | "backup">("totp");
  const [code, setCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function sendSmsCode() {
    setError(null);
    const res = await authClient.twoFactor.sendOtp();
    if (res.error) {
      setError(res.error.message ?? "Couldn't send that code.");
      return;
    }
    setSent(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res =
      mode === "totp"
        ? await authClient.twoFactor.verifyTotp({ code, trustDevice })
        : mode === "otp"
          ? await authClient.twoFactor.verifyOtp({ code, trustDevice })
          : await authClient.twoFactor.verifyBackupCode({ code, trustDevice });
    setBusy(false);
    if (res.error) {
      setError(
        res.error.message ??
          "That code didn't work. Challenges expire after ten minutes — sign in again if it's been longer."
      );
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl">One more step</h2>
        <p className="mt-1 text-sm text-ink-soft">
          {mode === "totp"
            ? "Enter the six-digit code from your authenticator app."
            : mode === "otp"
              ? "Enter the code we texted you."
              : "Enter one of your backup codes. Each works once."}
        </p>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {sent && mode === "otp" ? <Notice tone="success">Code sent.</Notice> : null}

      <form onSubmit={submit} className="space-y-4">
        <TextField
          label="Code"
          value={code}
          onChange={(e) => setCode(e.target.value.trim())}
          inputMode={mode === "backup" ? "text" : "numeric"}
          autoComplete="one-time-code"
          required
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={trustDevice}
            onChange={(e) => setTrustDevice(e.target.checked)}
          />
          Trust this device for 30 days
        </label>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Checking…" : "Verify"}
        </Button>
      </form>

      <div className="flex flex-wrap gap-4 text-sm">
        {mode !== "totp" ? (
          <button className="underline underline-offset-4" onClick={() => setMode("totp")}>
            Use authenticator app
          </button>
        ) : null}
        {offersSms && mode !== "otp" ? (
          <button
            className="underline underline-offset-4"
            onClick={async () => {
              setMode("otp");
              await sendSmsCode();
            }}
          >
            Text me a code
          </button>
        ) : null}
        {mode !== "backup" ? (
          <button className="underline underline-offset-4" onClick={() => setMode("backup")}>
            Use a backup code
          </button>
        ) : null}
        <button className="underline underline-offset-4 text-ink-soft" onClick={onBack}>
          Start over
        </button>
      </div>
    </div>
  );
}
