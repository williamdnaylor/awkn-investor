"use client";

import { useState } from "react";

import { Button, Card, Notice, TextField } from "~/components/ui";
import { authClient } from "~/lib/auth-client";

export function PhoneSection() {
  const { data: session, refetch } = authClient.useSession();
  const current = (session?.user as { phoneNumber?: string | null } | undefined)
    ?.phoneNumber;
  const verified = (
    session?.user as { phoneNumberVerified?: boolean } | undefined
  )?.phoneNumberVerified;

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"enter" | "verify">("enter");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function send() {
    setError(null);
    setBusy(true);
    const res = await authClient.phoneNumber.sendOtp({ phoneNumber: phone });
    setBusy(false);
    if (res.error) {
      setError(res.error.message ?? "Couldn't send a code to that number.");
      return;
    }
    setStage("verify");
  }

  async function verify() {
    setError(null);
    setBusy(true);
    const res = await authClient.phoneNumber.verify({
      phoneNumber: phone,
      code,
      updatePhoneNumber: true,
    });
    setBusy(false);
    if (res.error) {
      setError(res.error.message ?? "That code didn't match.");
      return;
    }
    setStage("enter");
    setCode("");
    setNote("Phone number verified.");
    await refetch();
  }

  return (
    <Card
      title="Phone number"
      description="Used only as a last-resort second factor. Enter it in international format, e.g. +15125550123."
    >
      {error ? <Notice tone="error">{error}</Notice> : null}
      {note ? <Notice tone="success">{note}</Notice> : null}

      {current ? (
        <p className="text-sm">
          On file: <span className="font-medium">{current}</span>{" "}
          {verified ? "(verified)" : "(unverified)"}
        </p>
      ) : null}

      {stage === "enter" ? (
        <div className="space-y-4">
          <TextField
            label={current ? "Replace with" : "Phone number"}
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value.trim())}
            autoComplete="tel"
            placeholder="+15125550123"
          />
          <Button onClick={send} disabled={busy || !phone}>
            {busy ? "Sending…" : "Send code"}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <TextField
            label="Code"
            value={code}
            onChange={(e) => setCode(e.target.value.trim())}
            inputMode="numeric"
            autoComplete="one-time-code"
          />
          <div className="flex gap-3">
            <Button onClick={verify} disabled={busy}>
              {busy ? "Checking…" : "Verify"}
            </Button>
            <Button variant="ghost" onClick={() => setStage("enter")}>
              Use a different number
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
