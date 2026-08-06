import "~/styles/globals.css";

import type { Metadata, Viewport } from "next";

import { baseURL } from "~/lib/base-url";

const TITLE = "AWKN Investor Materials";
const DESCRIPTION =
  "Within | AWKN Ranch and AWKN Residences — private investor materials.";

export const metadata: Metadata = {
  // Absolute URLs for og:image. Without it Next emits a relative path and most
  // scrapers drop the image.
  metadataBase: new URL(baseURL()),
  title: TITLE,
  description: DESCRIPTION,
  // The decks are shared by link, not indexed. next.config.js sets the same
  // header on every non-portal path.
  robots: { index: false, follow: false },
  // favicon.ico / icon.png / apple-icon.png / opengraph-image.jpg sit beside
  // this file; Next emits the tags and the sizes from the files themselves.
  // Every link to this host redirects a signed-out visitor — and therefore
  // every unfurl bot — to /login, so this card is what any shared link shows,
  // whichever deck it pointed at. It says nothing a recipient of the link
  // doesn't already know.
  openGraph: {
    type: "website",
    siteName: TITLE,
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
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
