# Phase 11 · Step 1: the beanie

**Status (2026-11-13): `beanie_v02` is approved (owner's visual review of `art/review-phase11/beanie_review.png`) and wired (section 5). One open item: the speech bubble covers the pom-pom on Home (section 5). Not committed.**
- `beanie_v01` **failed** `extract` (region): the cuff's ends dropped below y = 790 at the temples (lowest y 841 at x 240, 820 at x 760; 3608 px past the line; 0 px in the eye/blink region). Its median color rgb(157, 154, 116) also leaned olive. Rejected; no rules changed.
- `beanie_v02` **passed** `extract` and `export` (eyes, region, tuft ≥ 97%, not cropped): scale 1.000, shift (0, 0), body mismatch 5.2 gray levels; 87,718 overlay px; median rgb(150, 151, 119) vs swatch rgb(141, 164, 124) (judged in review). WebPs 21.7 kB (1024) and 10.0 kB (512). `pnpm build` (check-build OK, precache still 18 entries / 968.4 kB: the beanie is not precached until wiring), `pnpm test` (635) and `pnpm lint` pass. Wiring would bring the precache to about 1000 kB (budget 1200 kB).

*Earlier status (2026-11-12): the pipeline is built and dry-run tested; the beanie candidate is pending.* No beanie artwork exists yet: it's produced by ChatGPT ImageGen (the gated pipeline, character bible §3; I can't generate raster art) and then cut out, checked and exported by `scripts/art/make_accessory.py`. Until the candidate passes and is approved, nothing is wired into the app: no manifest entry, no precache change, nothing in `public/`. Round glasses are not started.

## 1. What the app needs (from the repository)

| | |
|---|---|
| Item | `beanie`, "Sage beanie", slot `head`, 120 coins: "A chunky knit beanie with a pom-pom" (`src/config/catalog.ts`, unchanged) |
| Kind and layer | `overlay`, `front`: drawn above the base frame **and** above the blink frame (`Koala.tsx` stack: back overlays → base → blink → front overlays) |
| Poses | `idle` only (the only pose that exists). The same overlay serves both the open-eye and the blink frame, because they're pixel-aligned and differ only in the eye region |
| Files | `public/characters/accessories/beanie@idle.webp` (1024×1536) and `beanie@idle-512.webp` (512×768), the names `accessoryFrame('beanie', 'idle')` builds |
| Canvas | the house grid: 1024×1536, transparent except the beanie, already in position (no offsets in code) |

## 2. How the beanie is produced

The beanie is an **edit of the approved Master**, not a new drawing: ImageGen puts the beanie on the Master, and the script keeps only the beanie's own pixels. That gives the right fit, lighting and plush style by construction, and the Master itself is never changed (the overlay is a separate layer).

### Your part: generate the candidate

1. In ChatGPT, attach **image 1:** `art/master/koa_idle_neutral.master.png` (the Master, 1024×1536) and **image 2:** `art/reference/koala-design-sheet.png` (its "Accessory examples" row shows the beanie).
2. If you can, use the **select-area edit** on image 1 and select the top of the head (crown tuft to just above the eyebrows, between the ears). Otherwise send the prompt below as is.
3. Paste the prompt.
4. Download with the **download button** (not a screenshot) and save it as `art/accessories/candidates/beanie_v01.png` (`v02`, … for later tries). Then tell me; I run the pipeline and show you the review sheet.

### Prompt (beanie v01)

> Keep the character, pose, framing, scale, position, lighting and everything else in image 1 exactly identical, pixel for pixel. Do not move, resize, redraw or restyle the koala. Change only the following:
>
> Put a chunky knit beanie on the koala's head, like the "Beanie" in the accessory row of image 2.
> - **Fit:** it sits snugly on top of the head, centered, **between the two big round ears**. It completely covers the fluffy crown tuft (no fur sticking out above or through it). Its folded ribbed cuff ends **just above the eyebrows**: the eyebrows, eyes, nose and cheeks stay fully visible and unchanged.
> - **Ears:** both ears stay exactly as they are, fully visible beside the beanie, not squashed, covered or moved.
> - **Design:** a soft, chunky rib-knit beanie with a folded cuff and a round, fluffy **pom-pom on top in the same sage green**. Simple and cozy. No logo, label, patch, text or pattern.
> - **Color:** soft muted sage eucalyptus green, the same family as the hoodie: not olive, not mint, not teal, not saturated.
> - **Material and light:** the same soft 3D plush-toy look as the koala: matte felt-like knit with visible yarn texture, warm key light from the upper left, soft ambient occlusion where the cuff meets the fur. No outlines, no gloss.
> - **Background:** keep it fully transparent (a real alpha channel, not a checkerboard pattern). If transparency isn't possible, use a flat, uniform, solid #F9EEE1 background with no gradient or shadow.
>
> Avoid: a second koala, any change to the face, eyes, nose, ears, fur color, hoodie, body or feet; a hat that covers the ears or the eyes; a cream or white pom-pom; earflaps; strings; shadows on the floor; text or watermark.

**If a fix is needed**, follow the Gate 0 phrasebook (`docs/phase-2/gate-0-koa-master.md` §3): the lock sentence first, then only the change. For example: "Move the beanie's cuff up so it ends above the eyebrows." · "Make the beanie cover the crown tuft completely." · "Hat color: soft muted sage, not olive." · "Keep both ears exactly as in image 1."

### My part: the pipeline (`scripts/art/make_accessory.py`)

```
python -I scripts/art/make_accessory.py extract beanie art/accessories/candidates/beanie_v01.png
python -I scripts/art/make_accessory.py export beanie
python -I scripts/art/make_accessory.py review beanie
```

| Step | What it does | Output |
|---|---|---|
| `extract` | Reads the candidate's alpha (or keys out a flat #F9EEE1 background, only where it's connected to the border). **Aligns** the candidate to the Master: it searches scale 0.97–1.03 and a shift of ±26 px, matching the body below the head, which the edit must not change, and reports the remaining mismatch (a warning above 14 gray levels: the edit redrew the koala). Keeps the pixels that changed **and** are sage (hue 35–120°, saturation ≥ 0.14), cleans the shape (largest parts, holes filled, edges grown 3 px into changed pixels, 0.9 px feather). Every overlay pixel is a candidate pixel; nothing is drawn | `art/accessories/beanie@idle.master.png` (Master pixel space) and `art/review-phase11/beanie_extract.png` (aligned candidate · changed/kept mask · overlay · overlay over the Master) |
| `export` | Applies **exactly** the idle transform of `normalize_export.py` (same bbox, scale 0.8576, offset), extended past the Koa bbox so a pom-pom above the head isn't cropped. Writes the WebPs with the same settings as the Koa frames (`quality=88, alpha_quality=95`) | `art/accessories/beanie@idle.normalized.png`, `public/characters/accessories/beanie@idle.webp` and `-512.webp` |
| `review` | Stacks the **exported WebPs** exactly as `Koala.tsx` does, at 1024 and 512, on cream and dark, with idle and blink, next to the Master alone, plus a head close-up | `art/review-phase11/beanie_review.png` |

**Checks** (run by `extract` and again by `export`, on the house grid; any failure exits non-zero and writes nothing):
- **Eyes:** the overlay is fully transparent where the blink frame differs from the Master (source y 795–888, plus 4 px), so both frames keep their eyes and the blink stays readable under the beanie.
- **Region:** the overlay stays between the outer ear rims and above y = 790 (source), and the beanie itself must not **continue** past that line (so a hat over the eyes fails instead of being silently cut).
- **Tuft:** at least 97% of the crown tuft (source box x 420–620, y 530–640) is covered at ≥ 95% opacity ("Hats must sit over the crown tuft").
- **Not cropped:** nothing touches the canvas edges.
- **Reported, judged in review:** the beanie's median color vs the catalog swatch `#8da47c`, and the body alignment error.

**Dry run (2026-11-12), outside the repository:** the pipeline was tested on a synthetic input (a flat sage shape pasted on the Master, shifted by (6, −4) px and flattened on cream, kept only in a temporary folder, never in `art/` or `public/`). Results: shift recovered exactly, body mismatch 0.6 levels; the export lines up with `normalize_export.py`'s own crop-and-resize within 1 level (99th percentile); WebPs 14.7 kB and 5.9 kB. A shape reaching over the eyes and one leaving the tuft uncovered were both **rejected** with nothing written. One defect found and fixed: sage can be within 26 levels per channel of the warm grey fur, so "changed" now also includes pixels that newly have the item's hue.

## 3. Wiring once the beanie is approved (not done yet)

Only after the review sheet is approved:
1. `src/features/koala/manifest.ts`: `accessoryArt = { beanie: { kind: 'overlay', layer: 'front', frames: { idle: accessoryFrame('beanie', 'idle') } } }`. The Home companion, the Shop preview and the Shop's "Artwork coming soon" label pick it up with no other change.
2. `vite.config.ts`: add `'characters/accessories/*.webp'` to `injectManifest.globPatterns`.
3. `scripts/check-build.mjs`: add both beanie files to `PRECACHE_FIXED` (18 → 20 entries) and update its tests. The existing 150 kB per-frame limit already covers `dist/characters/**`; the precache must stay under 1.2 MB (967.8 kB + about 20 kB).
4. Tests: `hasAccessoryArt('beanie')` and the overlay registration; a focused `Koala` render test (the beanie `<img>` after the blink image, for idle and blink) if the existing test setup supports it.
5. `pnpm test`, `pnpm lint`, `pnpm build`, then Playwright at 390×844 (Home and Shop preview, idle and blink, the bubble above the pom-pom) and an offline check against `pnpm preview` in a fresh context.

## 4. Known limitations
- **Sage only:** the cut-out keeps sage-colored parts (plus their shaded edges). A cream pom-pom or a non-sage detail would be dropped, so the prompt asks for a sage pom-pom.
- **No cast shadow on the fur:** a soft shadow the beanie casts on the forehead is fur-colored, so it isn't kept. The cuff's own ambient occlusion is.
- **Above the figure box:** the pom-pom will sit above the figure box Koa is laid out with (`figure.y` = 557), so it draws into the space above Koa. `.koala` doesn't clip, so it shows; the speech bubble and the Shop preview must be checked in the running app.

## 5. Wiring and validation (2026-11-13, after approval)

`beanie_v02` was approved by the owner from the review sheet on 2026-11-13. Section 3 was then carried out as planned; the accessory validation rules in `make_accessory.py` are unchanged.

**Changes**
- `src/features/koala/manifest.ts`: `accessoryArt.beanie = { kind: 'overlay', layer: 'front', frames: { idle: accessoryFrame('beanie', 'idle') } }`. Nothing else in the app changed: the Home companion, the Shop preview and the Shop card ("Artwork coming soon" is gone for the beanie only) pick it up through the existing architecture.
- `vite.config.ts`: `'characters/accessories/*.webp'` added to `injectManifest.globPatterns`.
- `scripts/check-build.mjs`: both beanie files added to `PRECACHE_FIXED` (7 → 9 fixed entries; the precache goes from 18 to 20 entries). Tests in `scripts/check-build.test.ts`: the fixed list holds exactly the two beanie frames as accessories, each is required, and an unapproved accessory frame (e.g. round glasses) is rejected.
- New tests: `src/features/koala/manifest.test.ts` (`hasAccessoryArt('beanie')`, the overlay registration and file names, no art for any other item) and `src/features/koala/Koala.test.tsx` (static render: base → blink → beanie, open eyes and eyes closed, both sizes in `srcSet`, decorative `alt=""`, nothing drawn for items without art).

**Results**
- `pnpm test`: 645 passed (was 635). `pnpm lint`: clean. `pnpm test:e2e`: 75 / 75 passed (iPhone-size Chromium and WebKit, desktop Chromium; the shop journeys now buy a beanie that has art).
- `pnpm build`: `check-build: OK`; **precache 20 entries, 1000.3 kB** (budget 1200 kB); beanie frames 21.7 kB and 10.0 kB (frame limit 150 kB); entry JS 151.4 kB gzip (budget 160).
- Playwright, 390×844, Chromium, against `vite preview`:
  - Shop: with 200 seeded coins, the beanie was bought through the real two-step flow ("Buy for 120?"), equipped automatically, the toast read "Sage beanie is yours. Koa is wearing it now.", and the card's "Artwork coming soon" label is gone (still shown on the other items). The Shop preview shows the beanie with the whole pom-pom inside the card.
  - Home: the beanie is drawn on Koa; layer order in the DOM is `koa_idle_neutral` → `koa_idle_blink` → `beanie@idle` in both Home and the Shop preview. With the blink frame showing, the eyes close under the cuff and the beanie stays on top.
  - No console or page errors.
- Offline (fresh context, service worker on, `pnpm preview` build): both beanie files are in the precache (`__WB_REVISION__` entries); after going offline and reloading, Home and the Shop preview render the beanie, and both files are served offline (200, 21,718 and 9,968 bytes).

**Open item: the speech bubble covers the pom-pom (check failed).** On Home at 390×844, a bubble ("So cozy!") sits over the pom-pom: the bubble's bottom is 35 px (CSS) below the top of the pom-pom and hides it almost completely. Cause: `.koa-bubble-anchor` is placed at `bottom: 98%` of Koa's figure box, which ends at the top of the crown (`figure.y` = 557); the pom-pom draws above that box (known limitation in section 4). The art is fine; the fix is a layout decision (e.g. raise the bubble when a head item with art is worn). Not changed yet, awaiting the owner's decision.

## 6. Two UI fixes after wiring (2026-11-13)

Requested by the owner after section 5. The beanie artwork, its coordinates and the accessory validation rules are unchanged; no new asset was made.

**1. The speech bubble no longer covers the pom-pom.**
- `manifest.ts`: an overlay entry may now carry `bounds`, the item's box in its idle frame (canvas px, measured from the exported file plus 8 px). The beanie's is `{ x: 289, y: 456, width: 443, height: 320 }` (opaque pixels x 297–723, y 464–767). `headroomAbove(wearing)` = how far worn art reaches above the figure box (beanie: 557 − 456 = 101 canvas px); `bubbleLiftPercent(wearing)` = the same as a share of the figure height (11.98%).
- `KoaCompanion.tsx`: with a lift, the bubble anchor gets `koa-bubble-anchor--over-hat` and `--bubble-lift`. `koa-companion.css`: `.koa-bubble-anchor--over-hat { bottom: calc(100% + var(--bubble-lift) + 7px) }`, so the tail tip (5 px below the bubble) sits just above the pom-pom. Without a hat that has art, nothing changes (`bottom: 98%`, no inline style); Koa doesn't move.
- Measured with Playwright (production build, a real bubble from tapping Koa; gap = pom-pom top − tail tip, in CSS px):

  | Viewport | With beanie: gap to pom-pom | Bubble top vs the ring's leaf marker | Without a hat |
  |---|---|---|---|
  | 390×844 | +2.7 | touches (−0.1) | unchanged (anchor 98%) |
  | 375×667 (iPhone SE) | +0.7 | **overlaps by 14.7 px** | unchanged |
  | 820×1180 | +2.3 | 14.3 clear | unchanged |
  | 1440×900 | +4.4 | 11.8 clear | unchanged |
  | 844×390 (landscape rail) | +2.4 | **overlaps by 11.6 px** (narrow bubbles don't reach it) | unchanged |

  Before the fix the bubble covered the pom-pom by 35 px (390×844). Idle and blink checked at 390×844: the bubble sits above the pom-pom in both.
- **Known trade-off (for the owner):** on short screens there isn't room for a bubble between the pom-pom and the top of the ring. On the iPhone SE (and with a wide line in phone landscape), the lifted bubble covers the ring's leaf marker and the top of the ring while it's showing. Bubbles are short-lived and never shown during focus. Removing it would need moving Koa or the bubble's placement (e.g. beside the head), which this fix was asked not to do.

**2. The Shop card shows the beanie itself.**
- New `AccessoryThumb` (`src/features/koala/AccessoryThumb.tsx` + `accessory-thumb.css`): shows the `bounds` crop of the item's own idle frame (the same precached `beanie@idle.webp` / `-512.webp`, chosen by `srcSet`), 62% of the card's art area, decorative (`aria-hidden`, `alt=""`). `accessoryPreview(id)` returns the frame and box, or null.
- `ShopScreen.tsx`: the card shows `AccessoryThumb` when `accessoryPreview` has one, otherwise the swatch as before. Items without art keep the swatch and "Artwork coming soon"; "Owned", the price, "Buy for N?" and "Wearing" are unchanged.
- Checked at 390×844, 375×667, 820×1180, 1440×900 and 844×390: the beanie is centered and fully visible in the card (e.g. 90×65 px in a 145×109 area at 390 wide; 129×93 in 208×156 at 820 and 1440).

**Validation**
- Unit tests: **654 passed** (new: `bounds`, `accessoryPreview`, `headroomAbove`, `bubbleLiftPercent` in `manifest.test.ts`; `AccessoryThumb.test.tsx`). Lint clean.
- `pnpm build`: `check-build: OK`, **precache unchanged at 20 entries** (1001.9 kB of 1200 kB). Accessory files in `public/characters/accessories/`: only `beanie@idle.webp` and `beanie@idle-512.webp` (no round glasses or other art).
- New E2E test in `shop.e2e.ts`: "the beanie shows its own artwork in the shop and on Koa, and Koa's speech clears the pom-pom". It earns 170 coins, checks the picture, buys the beanie, taps Koa on Home until it speaks, and asserts the tail tip is above the pom-pom. The suite is now 26 tests × 3 projects = 78 runs. `shop.e2e.ts`: 9 / 9. Full suite: **78 / 78** (1.7 min). Before that, one full run had 4 WebKit failures (two `accessibility`, two `data` tests) that passed when re-run on their own; a second run was invalid because the computer slept mid-run (`ERR_NETWORK_IO_SUSPENDED`, 11.9 h).
- Offline (fresh context, service worker on): both beanie files precached, Home and the Shop card render the beanie offline.
