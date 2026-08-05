"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * The password field for the whole app — login, signup, reset, and every
 * settings prompt. One component so the show/hide affordance and its
 * accessible labelling can never drift between surfaces.
 */
export function PasswordInput({
  label,
  value,
  onChange,
  autoComplete = "current-password",
  required = true,
  minLength,
  disabled,
  describedBy,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  disabled?: boolean;
  describedBy?: string;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          disabled={disabled}
          aria-describedby={describedBy}
          className="w-full rounded-md border border-ink/20 bg-white px-3 py-2 pr-11 text-ink placeholder:text-ink-soft/60 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-soft hover:text-ink"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
