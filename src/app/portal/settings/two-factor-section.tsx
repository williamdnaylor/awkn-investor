"use client";

import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";

import { PasswordInput } from "~/components/password-input";
import { Button, Card, Notice, TextField } from "~/components/ui";
import { authClient } from "~/lib/auth-client";

/**
 * Enrolment is deliberately three explicit steps — password, scan, confirm —
 * because backup codes are shown exactly once and a user who breezes past them
 * has no way back in if they lose the authenticator.
 */
export function TwoFactorSection({ smsAvailable }: { smsAvailable: boolean }) {
  const { data: session, refetch } = authClient.useSession();
  const enabled = Boolean(session?.user.twoFactorEnabled);

  const [password, setPassword] = useState("");
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function begin() {
    setError(null);
    setBusy(true);
    const res = await authClient.twoFactor.enable({ password });
    setBusy(false);
    if (res.error) {
      setError(res.error.message ?? "That password didn't match.");
      return;
    }
    setTotpUri(res.data.totpURI);
    setBackupCodes(res.data.backupCodes);
    setPassword("");
  }

  async function confirmEnrolment() {
    setError(null);
    setBusy(true);
    const res = await authClient.twoFactor.verifyTotp({ code });
    setBusy(false);
    if (res.error) {
      setError(res.error.message ?? "That code didn't match.");
      return;
    }
    setTotpUri(null);
    setCode("");
    setNote("Two-factor authentication is on.");
    await refetch();
  }

  async function disable() {
    setError(null);
    setBusy(true);
    const res = await authClient.twoFactor.disable({ password });
    setBusy(false);
    if (res.error) {
      setError(res.error.message ?? "That password didn't match.");
      return;
    }
    setPassword("");
    setBackupCodes(null);
    setNote("Two-factor authentication is off.");
    await refetch();
  }

  async function regenerate() {
    if (
      !window.confirm(
        "Generating new backup codes invalidates every old one. Continue?"
      )
    ) {
      return;
    }
    setError(null);
    setBusy(true);
    const res = await authClient.twoFactor.generateBackupCodes({ password });
    setBusy(false);
    if (res.error) {
      setError(res.error.message ?? "That password didn't match.");
      return;
    }
    setBackupCodes(res.data.backupCodes);
    setPassword("");
  }

  return (
    <Card
      title="Two-factor authentication"
      description={
        smsAvailable
          ? "An authenticator app is the primary second factor. Text-message codes are available as a fallback once you've verified a phone number."
          : "An authenticator app is the second factor. Backup codes cover you if you lose the app."
      }
    >
      {error ? <Notice tone="error">{error}</Notice> : null}
      {note ? <Notice tone="success">{note}</Notice> : null}

      {backupCodes ? (
        <div className="space-y-2 rounded-md border border-lantern/50 bg-lantern/10 p-4">
          <p className="text-sm font-medium">
            Save these backup codes now — they're shown once.
          </p>
          <ul className="grid grid-cols-2 gap-1 font-mono text-sm sm:grid-cols-3">
            {backupCodes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <Button variant="ghost" onClick={() => setBackupCodes(null)}>
            I've saved them
          </Button>
        </div>
      ) : null}

      {totpUri ? (
        <div className="space-y-4">
          <p className="text-sm">Scan this with your authenticator app.</p>
          <div className="inline-block bg-white p-3">
            <QRCodeSVG value={totpUri} size={168} />
          </div>
          <details>
            <summary className="cursor-pointer text-sm text-ink-soft">
              Can't scan? Enter the setup key manually
            </summary>
            <code className="mt-2 block break-all rounded bg-ink/5 p-2 text-xs">
              {totpUri}
            </code>
          </details>
          <TextField
            label="Code from the app"
            value={code}
            onChange={(e) => setCode(e.target.value.trim())}
            inputMode="numeric"
            autoComplete="one-time-code"
          />
          <Button onClick={confirmEnrolment} disabled={busy}>
            {busy ? "Checking…" : "Turn on two-factor"}
          </Button>
        </div>
      ) : enabled ? (
        <div className="space-y-4">
          <Notice tone="success">Two-factor authentication is on.</Notice>
          <PasswordInput
            label="Confirm your password"
            value={password}
            onChange={setPassword}
            required={false}
          />
          <div className="flex flex-wrap gap-3">
            <Button variant="ghost" onClick={regenerate} disabled={busy}>
              Regenerate backup codes
            </Button>
            <Button variant="danger" onClick={disable} disabled={busy}>
              Turn off
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <PasswordInput
            label="Confirm your password"
            value={password}
            onChange={setPassword}
            required={false}
          />
          <Button onClick={begin} disabled={busy}>
            {busy ? "Working…" : "Set up two-factor"}
          </Button>
        </div>
      )}
    </Card>
  );
}
