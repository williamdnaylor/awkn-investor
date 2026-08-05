import Link from "next/link";

import { SignupForm } from "./signup-form";

export const metadata = { title: "Create your account — AWKN Investor" };

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-16">
      <h1 className="font-display text-3xl">Create your account</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Accounts are by invitation. Use the exact address the invitation was
        sent to.
      </p>
      <div className="mt-8">
        <SignupForm />
      </div>
      <p className="mt-6 text-sm">
        Already set up?{" "}
        <Link href="/login" className="underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </main>
  );
}
