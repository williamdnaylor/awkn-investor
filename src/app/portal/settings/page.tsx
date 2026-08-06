import { listAllowlist } from "~/server/actions/allowlist";
import { requireSession } from "~/server/auth/guards";
import { otpMode } from "~/server/otp";
import { smsMode } from "~/server/sms";

import { AllowlistSection } from "./allowlist-section";
import { PasskeySection } from "./passkey-section";
import { PasswordSection } from "./password-section";
import { PhoneSection } from "./phone-section";
import { SessionsSection } from "./sessions-section";
import { TwoFactorSection } from "./two-factor-section";

export const metadata = { title: "Settings — AWKN Investor" };

export default async function SettingsPage() {
  const session = await requireSession();
  const admin = session.user.role === "admin";

  // Rungs that can't deliver aren't offered. See src/server/sms.ts.
  const smsAvailable = smsMode() !== "unavailable";
  const phoneAvailable = otpMode() !== "unavailable";

  const invitations = admin ? await listAllowlist() : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Settings</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Signed in as {session.user.email} ·{" "}
          {admin ? "Administrator" : "Viewer"}
        </p>
      </div>

      <PasskeySection />
      <PasswordSection />
      <TwoFactorSection smsAvailable={smsAvailable} />
      {phoneAvailable ? <PhoneSection /> : null}
      <SessionsSection currentToken={session.session.token} />
      {admin ? (
        <AllowlistSection
          rows={invitations.map((r) => ({
            email: r.email,
            source: r.source,
            addedBy: r.addedBy,
          }))}
        />
      ) : null}
    </div>
  );
}
