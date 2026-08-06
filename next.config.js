/**
 * Run `node scripts/copy-legacy.mjs` (wired as prebuild/predev/prestart) before
 * building — it mirrors the client's root-level static decks into public/.
 */
await import("./src/env.js");

/** @type {import("next").NextConfig} */
const config = {
  /**
   * The decks reference their assets relatively (`src="images/dome.jpg"`) and
   * the root deck links to them as `awkn-residences/` — WITH a trailing slash,
   * which is the shape GitHub Pages publishes. A browser resolves those
   * relative paths against the directory, so the deck must be served at
   * `/awkn-residences/`; served at `/awkn-residences`, `images/dome.jpg`
   * resolves to `/images/dome.jpg` and every photo 404s.
   *
   * Next's default is to strip trailing slashes, so that is switched off here.
   * `trailingSlash: true` would fix the decks but also rewrite every app route
   * (`/login/`, `/portal/`), so it is deliberately not used.
   *
   * The redirect that adds the slash lives in `src/proxy.ts`, not in
   * `redirects()`: a `source` of "/awkn-residences" is matched against the
   * normalised path, so it catches "/awkn-residences/" as well and redirects
   * it to itself forever. The proxy sees the raw pathname and can tell them
   * apart.
   */
  skipTrailingSlashRedirect: true,

  // The client's decks are plain .html files in public/. These rewrites restore
  // the exact URLs GitHub Pages already publishes, so links already sitting in
  // investors' inboxes resolve identically on Vercel.
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", destination: "/index.html" },
        {
          source: "/investor-presentation/",
          destination: "/investor-presentation/index.html",
        },
        {
          source: "/awkn-residences/",
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
