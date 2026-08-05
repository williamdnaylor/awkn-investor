/**
 * Mirror the client-authored static decks into public/ at build time.
 *
 * NOTE: index.html, investor-presentation/ and awkn-residences/ are authored by
 * William Naylor and live at the REPO ROOT, where GitHub Pages serves them from
 * (https://williamdnaylor.github.io/awkn-investor/...). Those links are already
 * circulating with investors. We never move or rewrite those files — this script
 * copies them into public/ so Vercel serves byte-identical content at the same
 * paths. Both hosts stay live and identical.
 *
 * The copies under public/ are gitignored; the originals at root are the source
 * of truth. Next rewrites (see next.config.js) map / and the two deck paths onto
 * these copies.
 */
import { cp, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");

/** Client-authored artifacts, relative to the repo root. */
const LEGACY = ["index.html", "investor-presentation", "awkn-residences"];

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

for (const entry of LEGACY) {
  const from = path.join(root, entry);
  const to = path.join(publicDir, entry);

  if (!(await exists(from))) {
    console.warn(`[copy-legacy] MISSING at repo root: ${entry} — skipping`);
    continue;
  }

  // Remove the previous copy so deletions upstream propagate.
  await rm(to, { recursive: true, force: true });
  await cp(from, to, { recursive: true });
  console.log(`[copy-legacy] ${entry} -> public/${entry}`);
}
