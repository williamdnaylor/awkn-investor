"use client";

import { useState } from "react";

import { Button, Card, Notice, TextField } from "~/components/ui";
import { authClient } from "~/lib/auth-client";

export function PasskeySection() {
  const { data: passkeys, isPending, refetch } = authClient.useListPasskeys();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  async function add() {
    setError(null);
    setBusy(true);
    const res = await authClient.passkey.addPasskey({
      name: `${navigator.platform || "Device"} — ${new Date().toLocaleDateString()}`,
    });
    setBusy(false);
    if (res?.error) {
      setError(res.error.message ?? "That passkey couldn't be added.");
      return;
    }
    await refetch();
  }

  async function rename(id: string) {
    setBusy(true);
    await authClient.passkey.updatePasskey({ id, name: newName });
    setBusy(false);
    setRenaming(null);
    await refetch();
  }

  async function remove(id: string) {
    const last = (passkeys?.length ?? 0) <= 1;
    if (
      last &&
      !confirm(
        "This is your only passkey. Remove it and you'll need your password to sign in. Continue?"
      )
    ) {
      return;
    }
    setBusy(true);
    await authClient.passkey.deletePasskey({ id });
    setBusy(false);
    await refetch();
  }

  return (
    <div id="passkeys">
      <Card
        title="Passkeys"
        description="Sign in with your device instead of a password. Add one per device you use."
      >
        {error ? <Notice tone="error">{error}</Notice> : null}

        {isPending ? (
          <p className="text-sm text-ink-soft">Loading…</p>
        ) : passkeys && passkeys.length > 0 ? (
          <ul className="divide-y divide-ink/10">
            {passkeys.map((pk) => (
              <li key={pk.id} className="flex flex-wrap items-center gap-3 py-3">
                {renaming === pk.id ? (
                  <>
                    <div className="flex-1">
                      <TextField
                        label="Name"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                      />
                    </div>
                    <Button onClick={() => rename(pk.id)} disabled={busy}>
                      Save
                    </Button>
                    <Button variant="ghost" onClick={() => setRenaming(null)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm">
                      {pk.name ?? "Unnamed passkey"}
                    </span>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setRenaming(pk.id);
                        setNewName(pk.name ?? "");
                      }}
                    >
                      Rename
                    </Button>
                    <Button variant="danger" onClick={() => remove(pk.id)} disabled={busy}>
                      Remove
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-soft">No passkeys yet.</p>
        )}

        <Button onClick={add} disabled={busy}>
          {busy ? "Working…" : "Add a passkey"}
        </Button>
      </Card>
    </div>
  );
}
