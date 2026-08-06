# AWKN Residences — launch-page demos

Three deliberately different directions for a single-page AWKN Residences
launch page. They are **direction tests, not deliverables**: pick one, then it
gets rebuilt in this repo's stack. Nothing ships to anyone from a design URL.

## Where they live

In Claude Design, **not in this repo** — that is where review comments and
iteration belong, and keeping the explorations out of the repo keeps the
project tree to shipped code.

Project: [AWKN Residences — launch pages](https://claude.ai/design/p/ea8266cd-9d43-4310-b7d3-04d1ab4c454c)

| | Direction | The idea |
|---|---|---|
| **A** | [Register](https://claude.ai/design/p/ea8266cd-9d43-4310-b7d3-04d1ab4c454c?file=register.html) | The page *is* a register: eighty numbered lines, typographic, no photographs. Sparseness as the whole argument. |
| **B** | [Daylight](https://claude.ai/design/p/ea8266cd-9d43-4310-b7d3-04d1ab4c454c?file=daylight.html) | Warm paper palette, editorial serif, four photographs. "Eighty lots. One standard, kept." — the argument is that nothing is tiered or upsold. |
| **C** | [Nightfall](https://claude.ai/design/p/ea8266cd-9d43-4310-b7d3-04d1ab4c454c?file=nightfall.html) | Photographic and dark — the lamp is lit before you arrive. Carries the most emotional freight, so it's the easiest to over-promise from later. |

Comment on whichever one you want to pursue; the comments come back as a work
queue and the chosen direction gets rebuilt here on a feature branch.

## The brief, in full

> AWKN Residences. 80 lots. Every lot comes with water, Wi-Fi, and a longevity
> package (vitamin shots + two blood panels a year). 12-month leases; 6-month
> available.

That is the entire set of facts. The pages are deliberately sparse because
**no amenity, price, place detail, or process may be invented.** Anything that
reads as a commitment the client hasn't made is a defect, not a flourish.

Two things were caught and removed during generation, and are worth knowing
about before anyone edits these pages:

- All three invented a plausible contact address (`hello@awknresidences.com`
  and similar). Each closing CTA is now a non-link styled the same way, with an
  HTML comment marking the address as TBC. **Do not hardcode a mailto** until
  the client supplies one.
- `awkn-residences/images/location-aerial-75.jpg` has "75 homes", "9.5 acres"
  and "10 minutes from downtown" baked into the pixels, and
  `ranch-aerial.jpg` shows a pool and sport court that aren't in the brief.
  Neither may be used on these pages. No current page references either.

## Note on the source photography

The pages use the client's own photographs, loaded from the public GitHub Pages
copies of the decks. If those are taken down (see `TODO.md`), the images in
these mockups go with them — the chosen direction should be rebuilt against
repo-hosted assets rather than left pointing at Pages.

## Resolved

`README.md` (client-authored) describes 75 homes; the launch brief says 80.
Matthew confirmed **80 lots** on 2026-08-05. `README.md` is client-authored and
was left as written.
