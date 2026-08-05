"use client";

import type { ComponentProps, ReactNode } from "react";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "ghost" | "danger" }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
  const variants = {
    primary: "bg-ink text-bone hover:bg-ink/90",
    ghost: "border border-ink/20 text-ink hover:bg-ink/5",
    danger: "border border-red-700/30 text-red-800 hover:bg-red-700/5",
  } as const;
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function TextField({
  label,
  className = "",
  ...props
}: ComponentProps<"input"> & { label: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium">{label}</span>
      <input
        className={`w-full rounded-md border border-ink/20 bg-white px-3 py-2 text-ink placeholder:text-ink-soft/60 disabled:opacity-60 ${className}`}
        {...props}
      />
    </label>
  );
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "error" | "success";
  children: ReactNode;
}) {
  const tones = {
    info: "border-ink/15 bg-ink/5 text-ink",
    error: "border-red-700/25 bg-red-700/5 text-red-900",
    success: "border-emerald-700/25 bg-emerald-700/5 text-emerald-900",
  } as const;
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-md border px-3 py-2 text-sm ${tones[tone]}`}
    >
      {children}
    </p>
  );
}

export function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-ink/15 bg-white/60 p-5">
      <h2 className="font-display text-lg">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm text-ink-soft">{description}</p>
      ) : null}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}
