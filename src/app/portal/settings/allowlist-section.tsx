"use client";

import { useState, useTransition } from "react";

import { Button, Card, Notice, TextField } from "~/components/ui";
import { inviteEmail, removeEmail } from "~/server/actions/allowlist";

interface Row {
  email: string;
  source: "manual" | "invite";
  addedBy: string | null;
}

export function AllowlistSection({ rows }: { rows: Row[] }) {
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  function invite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    start(async () => {
      const res = await inviteEmail(form);
      setMessage({ ok: res.ok, text: res.message });
      if (res.ok) setEmail("");
    });
  }

  function remove(target: string) {
    if (!confirm(`Remove ${target}? Existing accounts keep working.`)) return;
    const form = new FormData();
    form.set("email", target);
    start(async () => {
      const res = await removeEmail(form);
      setMessage({ ok: res.ok, text: res.message });
    });
  }

  return (
    <Card
      title="Who can create an account"
      description="Signup is invite-only. Only the addresses listed here can register — removing one blocks future signups but never signs anyone out."
    >
      {message ? (
        <Notice tone={message.ok ? "success" : "error"}>{message.text}</Notice>
      ) : null}

      <form onSubmit={invite} className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-56">
          <TextField
            label="Invite an address"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Working…" : "Invite"}
        </Button>
      </form>

      {rows.length > 0 ? (
        <ul className="divide-y divide-ink/10">
          {rows.map((r) => (
            <li key={r.email} className="flex flex-wrap items-center gap-3 py-3">
              <div className="flex-1">
                <p className="text-sm">{r.email}</p>
                <p className="text-xs text-ink-soft">
                  {r.source === "invite"
                    ? `invited${r.addedBy ? ` by ${r.addedBy}` : ""}`
                    : "added directly"}
                </p>
              </div>
              <Button variant="danger" onClick={() => remove(r.email)} disabled={pending}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-soft">Nobody is on the list yet.</p>
      )}
    </Card>
  );
}
