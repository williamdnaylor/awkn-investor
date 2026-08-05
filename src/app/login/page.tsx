import { Suspense } from "react";

import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in — AWKN Investor" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-16">
      <h1 className="font-display text-3xl">AWKN Investor</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Private materials. Sign in with the address your invitation was sent to.
      </p>
      <div className="mt-8">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
