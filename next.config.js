/**
 * Run `node scripts/copy-legacy.mjs` (wired as prebuild/predev/prestart) before
 * building — it mirrors the client's root-level static decks into public/.
 */
await import("./src/env.js");

/** @type {import("next").NextConfig} */
const config = {
  // The client's decks are plain .html files in public/. Next's static handler
  // serves them at /index.html, /investor-presentation/index.html, etc. — these
  // rewrites restore the exact URLs GitHub Pages already publishes, so links
  // already in investors' inboxes resolve identically on Vercel.
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", destination: "/index.html" },
        {
          source: "/investor-presentation",
          destination: "/investor-presentation/index.html",
        },
        {
          source: "/awkn-residences",
          destination: "/awkn-residences/index.html",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },

  async headers() {
    return [
      {
        // The decks are direct-link-only, exactly as the client authored them
        // (every page carries <meta name="robots" content="noindex, nofollow">).
        // Mirror that at the header level so crawlers honour it on Vercel too.
        source: "/:path((?!portal).*)",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default config;
