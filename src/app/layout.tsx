import "~/styles/globals.css";

import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "AWKN Investor",
  description: "Private investor materials.",
  // The decks are shared by link, not indexed. next.config.js sets the same
  // header on every non-portal path.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#161815",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-bone text-ink antialiased">{children}</body>
    </html>
  );
}
