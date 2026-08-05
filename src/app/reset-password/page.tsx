import { Suspense } from "react";

import { ResetForm } from "./reset-form";

export const metadata = { title: "Choose a new password — AWKN Investor" };

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-16">
      <h1 className="font-display text-3xl">Choose a new password</h1>
      <div className="mt-8">
        <Suspense fallback={null}>
          <ResetForm />
        </Suspense>
      </div>
    </main>
  );
}
