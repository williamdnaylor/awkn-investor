# AWKN Residences — launch-page demos

Three deliberately different directions for a single-page AWKN Residences
launch page. They are **direction tests, not deliverables**: pick one, then it
gets rebuilt in this repo's stack. Nothing ships to anyone from a demo file.

## The brief, in full

> AWKN Residences. 80 lots. Every lot comes with water, Wi-Fi, and a longevity
> package (vitamin shots + two blood panels a year). 12-month leases; 6-month
> available.

That is the entire set of facts. The pages are deliberately sparse because
**no amenity, price, place detail, or process may be invented.** Three rounds of
revision went into removing things that crept in — an "invitation" CTA that
implied a selection process, "eighty porches", a figure captioned "Site Plan"
with a north mark and scale bar, a longevity-package cadence diagram. Anything
that reads as a commitment the client hasn't made is a defect, not a flourish.

## The three directions

| | Direction | The idea | Risk |
|---|---|---|---|
| **A** | **Register** | The page *is* a register: eighty numbered lines, typographic, no photographs, single light theme. Sparseness as the whole argument. | Reads austere; nothing to look at if the reader wants to see the place. |
| **B** | **Nightfall** | Photographic and dark. "Come home after the light already has" — the lamp is lit before you arrive. Copy stays grounded in what the four photos actually show. | Carries the most emotional freight, so it's the easiest to over-promise from later. |
| **C** | **Field Manual** | Technical-document voice — document header, numbered sections, hairline SVG lot index, mono captions. Precision as the tone. | The schematic must never be mistaken for a site plan; it's captioned twice to say so. |

## Where they are

Not in this repo, by instruction. The HTML lives on the ops box at
`~/.hermes/handoff/awkn-investor/demos/{a-register,b-nightfall,c-field-manual}.html`.

They are meant to live in **Claude Design**, which is where review comments and
iteration belong. That upload is **blocked on a human step**: the
`claude-design` MCP server needs Matthew to complete a browser authorization.
The authorization link is on the cargo card. Once it's done, the three pages go
up and the durable `claude.ai/design` links get recorded here and on the card.

## Open question before any of this reaches an investor

`README.md` (client-authored) describes **75 homes** with four unit types and
per-unit pricing. This brief says **80 lots**. Both numbers are recorded as
given; neither was edited. Somebody has to decide which is true.
