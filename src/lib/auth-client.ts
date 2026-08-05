"use client";

import { createAuthClient } from "better-auth/react";
import {
  adminClient,
  phoneNumberClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";

export const authClient = createAuthClient({
  plugins: [
    passkeyClient(),
    twoFactorClient({
      /**
       * Fired when a sign-in succeeds but a second factor is still owed. The
       * available methods travel in the query string so the 2FA step can show
       * only the rungs this deployment actually offers (SMS may be dark).
       */
      onTwoFactorRedirect: ({ twoFactorMethods }) => {
        const methods = (twoFactorMethods ?? []).join(",");
        window.location.href = `/login?step=2fa${
          methods ? `&methods=${encodeURIComponent(methods)}` : ""
        }`;
      },
    }),
    phoneNumberClient(),
    adminClient(),
  ],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
  passkey,
  twoFactor,
  admin,
  updateUser,
  changePassword,
  requestPasswordReset,
  resetPassword,
  listSessions,
  revokeSession,
  revokeOtherSessions,
  listAccounts,
} = authClient;
