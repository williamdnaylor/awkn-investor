"use client";

import { useEffect, useState } from "react";

import { Button, Card, Notice } from "~/components/ui";
import { authClient } from "~/lib/auth-client";

interface SessionRow {
  id: string;
  token: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt: Date | string;
}

export function SessionsSection({ currentToken }: { currentToken: string }) {
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await authClient.listSessions();
    if (res.error) {
      setError(res.error.message ?? "Couldn't load your sessions.");
      return;
    }
    setRows(res.data as SessionRow[]);
  }

  useEffect(() => {
    void load();
  }, []);

  async function revoke(token: string) {
    setBusy(true);
    await authClient.revokeSession({ token });
    setBusy(false);
    await load();
  }

  async function revokeOthers() {
    setBusy(true);
    await authClient.revokeOtherSessions();
    setBusy(false);
    await load();
  }

  return (
    <Card
      title="Signed-in devices"
      description="Revoking a session signs that device out the next time it makes a request."
    >
      {error ? <Notice tone="error">{error}</Notice> : null}

      {rows ? (
        <ul className="divide-y divide-ink/10">
          {rows.map((s) => {
            const isCurrent = s.token === currentToken;
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="flex-1">
                  <p className="text-sm">
                    {s.userAgent ?? "Unknown device"}
                    {isCurrent ? (
                      <span className="ml-2 rounded bg-ink/10 px-1.5 py-0.5 text-xs">
                        this device
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {s.ipAddress ?? "no address recorded"} ·{" "}
                    {new Date(s.createdAt).toLocaleString()}
                  </p>
                </div>
                {!isCurrent ? (
                  <Button variant="danger" onClick={() => revoke(s.token)} disabled={busy}>
                    Revoke
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-ink-soft">Loading…</p>
      )}

      <Button variant="ghost" onClick={revokeOthers} disabled={busy}>
        Sign out everywhere else
      </Button>
    </Card>
  );
}
