# Phase 11 · Step 2: the round glasses

**Status (2026-11-18): complete.** `round-glasses_v05` was approved by the owner (2026-11-16), wired into the app and the offline precache (§11), committed as `d8a40b4`, and is live in production (deployed in `d8a40b4`; production is now `c4daa76`, the docs-only Phase 11 closeout, which includes it). How it got there: the §4 pipeline additions were approved and made; `round-glasses_v01` failed the pipeline; `round-glasses_v02` passed every check but had visible defects; `round-glasses_v03` failed the eye check (§6); the owner approved a hollow cut for the glasses (§7, made and tested); `round-glasses_v04` was rejected by the owner (§8); `round-glasses_v05` (the Master plus v04's frame pixels, built deterministically) passed every check, and with the approved exact-difference selection for hollow items (§10) its overlay holds the complete frame. No other accessory is started.

*Earlier status (2026-11-13), kept as history:* No candidate is approved; nothing is in `public/` or wired. No glasses artwork exists yet, `scripts/art/make_accessory.py` is unchanged, and nothing is wired into the app (no manifest entry, no precache change, nothing in `public/`). App integration waits for the owner's visual approval of the review sheet.

Step 1 (the beanie, `step-1-beanie.md`) is complete and committed (`cc877cd`); this step reuses its pipeline and quality bar.

## 1. What the app needs (from the repository)

| | |
|---|---|
| Item | `round-glasses`, "Round glasses", slot `face`, category `glasses`, 180 coins: "Thin round frames. Instantly 20% more scholarly." Swatch `#3a2b22` (warm dark brown). `src/config/catalog.ts`, unchanged |
| Kind and layer | `overlay`, `front` (`docs/phase-6/accessory-assets.md`): drawn above the base **and** the blink frame. "Glasses must work over both the open-eye and blink frames" |
| Pose | `idle` only. One overlay serves both frames (they differ only in the eye regions) |
| Files (after approval) | `public/characters/accessories/round-glasses@idle.webp` (1024×1536) and `round-glasses@idle-512.webp`, the names `accessoryFrame('round-glasses', 'idle')` builds |

## 2. Face geometry (measured on the Master, source pixels)

| | |
|---|---|
| Eyes | centers (383, 841) and (646, 841); dark area 63×76 px each (x 353–415 / 615–677, y 803–878). On the house grid: (401, 821) and (627, 821) |
| Blink region (the eye check) | where the blink frame differs from the Master, grown 4 px: x 340–427 / 603–690, y 791–892, roughly round: **every point is within 52.3 px of the eye's center** |
| Nose | x 444–588, top at about y 772; at eye level (y 840) it spans x 453–578 |
| Brows | about y 715–730, above the eyes |
| Head | 583 px wide at the cheeks (ears excluded), about x 221–803 |

**What that means for the glasses:** the existing eye check requires the overlay to be fully transparent in the blink region, which also keeps the eyes and the blink untouched. A round rim around each eye therefore needs an **inner radius of at least ~56 px** (52.3 + the extractor's 3 px edge growth and feather), so lenses about **125–135 px across**, centered on the eyes. Lenses that size reach the sides of the nose (left lens to about x 448, right lens from about x 580): the frames will rest on the nose's upper sides and the bridge crosses the top of the nose, drawn in front of it. That's how glasses sit on a koala's large nose, but it's the main thing to judge in the review.

## 3. Your part: generate the candidate

As in Step 1: in ChatGPT, attach **image 1:** `art/master/koa_idle_neutral.master.png` and **image 2:** `art/reference/koala-design-sheet.png` (its accessory row shows the round glasses). If you can, use the select-area edit on image 1 around the eyes and the top of the nose (brows to the middle of the nose, between the cheeks). Download with the download button and save as `art/accessories/candidates/round-glasses_v01.png` (`v02`, … for later tries).

### Prompt (round glasses v01)

> Keep the character, pose, framing, scale, position, lighting and everything else in image 1 exactly identical, pixel for pixel. Do not move, resize, redraw or restyle the koala. Change only the following:
>
> Put a pair of thin round glasses on the koala's face, like the "Round glasses" in the accessory row of image 2.
> - **Fit:** each lens is a perfect circle **centered on one eye**, large enough that the whole eye and a clear ring of fur around it are inside the frame: the frame never touches or crosses the eye, the eyelid or the eye's shine. The lenses are the same size and level. The bridge is a thin curve resting on **the top of the nose**; the frames may rest lightly on the upper sides of the nose.
> - **Eyes:** the eyes, their shine, the eyebrows, the nose, the mouth and the cheeks stay exactly as they are, fully visible and unchanged. Nothing is drawn over the eyes.
> - **Lenses:** completely clear and invisible: no tint, no glare, no reflections, no shine, no glass effect over the eyes or fur.
> - **Frame:** thin, round, simple wire frames, about as thick as the eyebrows. **Warm dark chocolate brown** (like #3a2b22), not black, not gold, not grey.
> - **Arms:** no visible temple arms: the frames end at the outer edge of each lens. Nothing goes toward or touches the ears.
> - **Material and light:** matte, soft, slightly rounded, in the same soft 3D plush-toy look as the koala, warm key light from the upper left. No outlines, no gloss, no metallic shine.
> - **Background:** keep it fully transparent (a real alpha channel, not a checkerboard pattern). If transparency isn't possible, use a flat, uniform, solid #F9EEE1 background with no gradient or shadow.
>
> Avoid: a second koala, any change to the face, eyes, nose, ears, fur color, hoodie, body or feet; lenses that cover or cut across the eyes; sunglasses or tinted lenses; square or oval frames; thick frames; visible arms; nose pads; a cord or chain; shadows on the floor; text or watermark.

**If a fix is needed**, follow the Gate 0 phrasebook: the lock sentence first, then only the change. For example: "Make both lenses bigger so the frame circles the whole eye with fur showing in between." · "Keep the eyes exactly as in image 1." · "Make the lenses completely clear." · "Frame color: warm dark chocolate brown, not black." · "Remove the temple arms."

## 4. Pipeline additions for glasses (approved and made 2026-11-13)

The checks themselves stay as they are: **eyes** (fully transparent in the blink region), **region** (inside the item's allowed region, and the item must not continue past it), **not cropped**, **alignment** (body mismatch reported, warning above 14). The tuft check applies to hats only, as now. What glasses need is new **item data** and two review/export details; none of it changes how the beanie is checked:

1. **An `ITEMS` entry for `round-glasses`** (today the script knows only `beanie`), proposed:
   ```python
   "round-glasses": {
       "kind": "glasses",
       # Allowed region: across the face between the cheeks, from below the brows to above the
       # mouth. Rims around the eyes fit inside; arms reaching for the ears or frames climbing
       # into the brows fail the region check instead of being cut.
       "region": (230, 740, 795, 940),
       # The frame's color family: warm dark brown (#3a2b22 is hue 22°, saturation 0.41).
       "hue": (0, 50),
       "min_sat": 0.18,
       "swatch": (0x3A, 0x2B, 0x22),
   },
   ```
2. **A face close-up in the review sheet.** The current close-up crop (house grid y 380–900) was made for a hat: the eyes sit at y 821 and the lower rims would be at its bottom edge. Proposed: an optional per-item close-up window, `(y 640–1010, x 170–854)` for the glasses; the beanie's stays as it is.
3. **Export for review outside `public/`.** `export` writes to `public/characters/accessories/` by default, and the precache glob (`characters/accessories/*.webp`) would pick an unapproved file up (the build check would then fail on it: "not an expected entry"). Until approval, the review-stage export goes to the gitignored review folder with the script's existing option: `export round-glasses --public-dir art/review-phase11/round-glasses` (and `review` with the same option). No script change is needed for this; the export to `public/` happens only after approval.

### Commands (once approved and the candidate exists)

```
python -I scripts/art/make_accessory.py extract round-glasses art/accessories/candidates/round-glasses_v01.png
python -I scripts/art/make_accessory.py export round-glasses --public-dir art/review-phase11/round-glasses
python -I scripts/art/make_accessory.py review round-glasses --public-dir art/review-phase11/round-glasses
```

Outputs: `art/accessories/round-glasses@idle.master.png`, `art/accessories/round-glasses@idle.normalized.png`, the review-stage WebPs and `art/review-phase11/round-glasses_extract.png` / `round-glasses_review.png` (the review folder is gitignored, as in Step 1).

## 5. Risks to watch

- **Redrawn eyes fail the eye check.** The eyes' dark brown iris is in the frame's color family. If ImageGen re-renders the eyes (even slightly), those pixels count as "changed and frame-colored", are kept, and the eye check fails. That is the intended fail-safe (nothing over the eyes ships); the fix is a new candidate that leaves the eyes alone, never a rule change.
- **Near-black frames would be dropped.** Very dark, unsaturated frames fall below the saturation floor; the prompt asks for warm dark brown. The extractor reports the median color against the swatch.
- **Lens effects aren't kept.** Glare, tint or a glass sheen over the fur isn't frame-colored, so the overlay would show clear lenses regardless; a strong tint would still show up as a mismatch in the review.
- **Shadows on the fur aren't kept** (fur-colored), as with the beanie.
- **With the beanie:** the approved beanie's cuff ends at y 686–733 across the face (705 above each eye); the rims' tops would be at about y 779–785, so they shouldn't meet. Both worn together is a wiring-stage check, not part of this review.

## 6. Candidates

### `round-glasses_v01`: rejected (2026-11-13)

**It isn't an edit of the Master.** The file is the glasses alone on a transparent background (1.7% of pixels non-transparent, nothing below y 881): no koala. The pipeline cuts an item out of an edit of the Master and aligns it on Koa's body, so it has nothing to align to.

`extract` output (no rules changed; nothing written to `art/accessories/` or `public/`; `export` and `review` not run):
```
alignment: scale 0.970, shift (-26, -26) px, body mismatch 17.2 gray levels   (WARNING; both at the search limits)
median rgb(68, 45, 35) vs catalog swatch rgb(58, 43, 34)
FAIL eyes: the overlay covers 1842 px of the blink region
FAIL region: the round-glasses continues 10994 px past its allowed region (x 200-770, y 638-741)
```
The failures aren't only caused by the meaningless alignment. **Taken as placed (no alignment)** the glasses still fail both checks: 1762 px in the blink region and 5369 px above the region (y 687–739, the brows). Its geometry: lens openings centered at (368, 784) and (654, 784), **57 px above Koa's eyes** (383/646, 841), and **179×170 px** across (the plan: ~112 inner / 125–135 outer); the frames span x 234–788, y 687–881. So the lower rims cross the eyes and the tops climb into the brows. It also has gold rivets and short temple stubs at the outer edges (the prompt asked for no arms). The color (median rgb(68, 45, 35)) is right.

Diagnostic panels: `art/review-phase11/round-glasses_extract.png` (gitignored).

**For v02:** generate it as an edit of image 1 (the Master), so the result shows Koa wearing the glasses with everything else unchanged. Suggested additions to the §3 prompt, after the lock sentence: "The result must show the koala from image 1, exactly as it is, wearing the glasses; do not output the glasses on their own." · "Each lens is centered exactly on one eye, at the height of the eye's center, not above it." · "Smaller lenses: each about twice as wide as the eye." · "No rivets and no arms: plain round rims and a bridge."

### `round-glasses_v02`: passes the checks; visual defects; awaiting the owner's decision (2026-11-13)

A Master-based edit (alpha distribution like the Master's). Commands as in §4; the review-stage WebPs went to `art/review-phase11/round-glasses/` (gitignored), **not** `public/`. One environment hiccup: the first `extract` crashed writing the debug panel (Windows `Errno 22`, the old v01 panel was briefly locked); the identical re-run succeeded.

| Check | Result |
|---|---|
| Alignment | scale **1.005**, shift (0, 0), body mismatch **5.0** gray levels (beanie v02: 1.000, 5.2) |
| Eyes (blink region) | **pass**: 0 overlay px |
| Region (x 230–795, y 740–940, no continuation past it) | **pass** |
| Not cropped | **pass** |
| Overlay | 24,300 px; bounds x 303–717, y 757–931 (Master space); house grid: glasses top y 749 |
| Color | median rgb(87, 58, 44) vs swatch rgb(58, 43, 34): lighter and warmer (fur fringes are included in the median) |
| Exports (review only) | 17.0 kB (1024), 9.2 kB (512) |
| With the beanie | 0 overlapping px; works together |

**Visual findings (checks don't catch these):**
- **ImageGen redrew the eyes and nose.** Outside the overlay, the eyes differ from the Master by 25.9 mean gray levels (20.3% of pixels above 28) and the nose by 22.2 (14.8%); the approved beanie edit had 15.4 (9.3%) and 11.3 (4.7%), and the body is the same for both (12.0 vs 12.1). The candidate's nose is a different shape and **the rims pass behind it**. None of those redrawn pixels are in the overlay (the app keeps the Master's eyes and nose), but:
- **The rims are open where the candidate's nose hid them** (C-shaped lenses; the inner arcs stop at the nose's sides), and the bridge piece carries **a strip of the candidate's grey fur over the top of the Master's nose** (a lighter patch above the bridge).
- Light fur fringes along parts of the rims (especially the lower right).
- At app size the glasses read well (centered on the eyes, level, clear lenses, no arms or rivets); the defects show at close range.

Review sheet: `art/review-phase11/round-glasses_review.png` (with the face close-up); diagnostics: `round-glasses_extract.png`.

**If a v03 is wanted:** add to the prompt: "The glasses sit in front of the nose: the bridge crosses over the top of the nose, and both rims are complete circles drawn on top of the fur and the nose." · "Do not change the nose or the eyes in any way."

### `round-glasses_v03`: rejected (2026-11-13)

Described as built directly from the Master with only the glasses added; the file doesn't match that:
- **No alpha channel:** an RGB image on a black background (the pipeline keyed out rgb(0, 0, 0)); the Master's alpha isn't preserved.
- **Not Master pixels:** compared directly (no alignment), 0.01% of Koa's pixels are identical to the Master and the mean difference is 15.3 gray levels, the body included (15.4); alignment again needs scale 1.005. It isn't derived from v02 either (mean difference 11.8, 0.05% identical). It's another full re-render.

`extract` output (no rules changed; nothing written to `art/accessories/` or `public/`; export and review not run):
```
candidate alpha: keyed background rgb(0, 0, 0)
alignment: scale 1.005, shift (0, 0) px, body mismatch 6.6 gray levels
median rgb(123, 95, 84) vs catalog swatch rgb(58, 43, 34)
FAIL eyes: the overlay covers 6924 px of the blink region
```
Cause: the **left** rim is a closed circle, so the extractor's hole filling took the whole lens, **the candidate's own left eye and the fur inside it** into the overlay (6,924 px is the entire left blink region). The check is doing its job: shipping it would replace Koa's left eye with a redrawn one and break the blink. The right rim is still open at the nose (as in v02), so it wasn't filled; the bridge again comes in fragments. The median color is pulled toward fur/eye colors by the filled lens.

Diagnostics: `art/review-phase11/round-glasses_extract.png` (now v03's). `art/accessories/round-glasses@idle.master.png` / `.normalized.png` and the review-stage WebPs are still v02's (a failed extract writes nothing).

**Note for the pipeline (not changed):** a complete round rim is exactly what the glasses need, but `binary_fill_holes` fills a closed rim's interior, so any candidate with closed rims will fail the eye check this way, whatever its quality. Lens interiors must stay empty for glasses. Changing this (e.g. not filling holes for `kind: "glasses"`) is a rule change that needs the owner's approval; it was not made.

## 7. Hollow cut for outline accessories (owner-approved 2026-11-14, made and tested)

The owner identified the v03 failure as an extractor assumption: the beanie is a solid item, so filling enclosed regions is right for it; glasses are an outline, so filling the closed rims turned the lens openings into accessory pixels over Koa's eyes. Approved change, scoped to outline items:

- `ITEMS["round-glasses"]["hollow"] = True` (the beanie doesn't set it; default `False`).
- The cut moved, unchanged, from `extract()` into `cut_item(cfg, changed, item_color, a_c)` (and `region_mask()`). For a hollow item, `binary_fill_holes` is skipped (both places) and the result is limited to pixels the Master comparison marked as changed, so the closing can't bridge unchanged Master pixels in. For a solid item, the code path is identical to before.
- **Not changed:** `check_overlay` (eyes/blink region, allowed region, crop, empty overlay, tuft), the spill check, `align`, the alignment warning, `color_report`, the changed/item-color masks, the feather, export and review. No check has an exemption for hollow items.

Tests: `scripts/art/test_make_accessory.py` (stdlib `unittest`; `python -I scripts/art/test_make_accessory.py`, with `KOA_ART_SLOW=1` for the alignment test and the beanie regression). They cover: a closed frame keeps its lens interior empty; the lens opening is exactly transparent beyond the feather's reach (7 px in from the rim) and below the existing 0.01 overlay cut-off from 3 px in; only changed pixels are kept; the same frame through the solid cut is filled (and then fails the eye check); a solid outline still fills (beanie behavior); a genuine opaque or faint pixel over an eye still fails the eye check with the same message; the region, crop, empty-overlay and colour results are unchanged; the Master aligns to itself at scale 1.0, shift (0, 0); and **re-extracting `beanie_v02` reproduces the committed `beanie@idle.master.png` pixel for pixel**.

## 8. `round-glasses_v04`: rejected by the owner (2026-11-16)

First run of the hollow cut (§7), code and rules unchanged. `extract` output:
```
candidate alpha: alpha channel
alignment: scale 1.005, shift (0, 0) px, body mismatch 6.5 gray levels
median rgb(81, 52, 36) vs catalog swatch rgb(58, 43, 34)
overlay written: art/accessories/round-glasses@idle.master.png  (28295 px)
```
Eyes, region, spill, crop and empty-overlay checks pass in Master space and again on the house grid (`export`). Overlay bounds (Master px): x 295–727, y 752–931; 21,617 px with alpha > 0 in the written file (9,633 opaque). Export went only to `art/review-phase11/round-glasses/` (20.0 kB, 10.2 kB); review sheet `art/review-phase11/round-glasses_review.png`.

- **Lens openings:** transparent. 0 overlay px within 52 px of either eye centre (the blink region); the openings stay holes (the left one is enclosed, 13,535 px). The blink reads through both lenses on the review sheet.
- **Not Master-preserved:** compared directly, 0.03% of Koa's pixels are identical to the Master (body 0.05%, mean difference 13.1 gray levels, the body included); alpha matches on 92.2% of the canvas; alignment needs scale 1.005. The eyes, nose (lighter, re-textured), brows and fur are redrawn. Not derived from v02 either (0.14% identical).
- **Rims and bridge:** the candidate draws two complete rims and a bridge arching over the nose, but over the Master's dark nose the brown frame isn't "changed" enough (difference ≤ 28 and the nose already has the frame's hue), so the **bridge is missing** from the overlay and the **right rim has a gap** on its nose side (11°). Instead, **5,383 px of the redrawn, lighter nose** (median rgb(110, 91, 84) vs the Master's rgb(83, 70, 66)) are in the overlay: a grey patch over the Master's nose (x 449–582, y 778–891). Rims elsewhere: rgb(86, 56, 41).

## 9. `round-glasses_v05`: the Master plus v04's frame; passes the checks; frame gaps over the nose (2026-11-16)

Built at the owner's request without ImageGen. The base is the Master PNG, unchanged. Only v04's glasses frame was composited onto it. **Reproducible:** `python -I scripts/art/compose_glasses_v05.py --check` rebuilds it from the tracked Master and `round-glasses_v04.png` (v04's alignment found by the pipeline's own `align()`) and confirms it is identical to the tracked `round-glasses_v05.png`, pixel for pixel and byte for byte.
- **Aligning v04:** v04 was mapped onto the Master with the pipeline's own transform (`affine`, scale 1.005, shift (0, 0)).
- **Finding the frame:** frame pixels are v04 pixels with hue ≤ 50°, saturation ≥ 0.33 and value 0.10–0.60, inside the glasses region and outside 58 px discs around the eyes (the irises are just as saturated). The largest connected piece is kept: both rims joined by the bridge, 11,059 px. A separate 3,085 px piece, v04's own redrawn nostril area, is dropped.
- **Edges:** coverage comes from the frame's own shape, softened by 0.8 px. Each edge pixel takes the colour of the nearest v04 frame pixel. A first build took edge coverage from v04's saturation and let in 437 light v04 fur and blush pixels; it was rebuilt before the final run.
- **Kept from the Master:** every other pixel, and the alpha channel everywhere.

**Master preserved:**
- 1,557,790 of 1,572,864 RGBA pixels (99.04%) are identical to the Master.
- Outside the frame, all 1,557,751 pixels are identical (100%). The alpha channel is identical everywhere.
- The 15,074 differing pixels all lie inside the frame (x 299–724, y 755–919). None is within 58 px of an eye centre.
- Both lens openings stay open, at 14,249 and 13,862 px.

`extract` output (rules and code unchanged, `hollow` included):
```
candidate alpha: alpha channel
alignment: scale 1.000, shift (0, 0) px, body mismatch 0.3 gray levels
median rgb(77, 49, 33) vs catalog swatch rgb(58, 43, 34)
overlay written: art/accessories/round-glasses@idle.master.png  (22555 px)
```
- **Checks:** eyes, region, spill, crop and empty overlay all pass, in Master space and again on the house grid.
- **Overlay bounds:** x 298–725, y 754–920. 16,574 px have alpha > 0 in the saved file; 8,039 are opaque.
- **Review export:** `art/review-phase11/round-glasses/` only (16.3 kB, 8.9 kB). Review sheet: `art/review-phase11/round-glasses_review.png`.
- **Eyes:** 0 overlay px within 58 px of either eye centre. The blink reads through both lenses.
- **Lens openings:** transparent.
- **Frame coverage:** the overlay holds 93.4% of the frame. The missing 729 px are where the brown frame crosses the Master's dark nose, which already has the frame's hue and is often within 28 levels of it, so those pixels don't count as "changed". The gaps:
  - the right rim's nose side, 318 px (x 567–582, y 822–870), so the right lens isn't closed in the overlay;
  - three pieces of the bridge across the top of the nose (187, 106 and 23 px);
  - 22 px on the left rim at the nose.
- **Edge feather:** 2,085 overlay px at alpha ≤ 132 lie just outside the frame. Their colour is the Master's own, so they're invisible over the Master.

## 10. Exact Master differences for hollow items (owner-approved 2026-11-16, made and tested)

v05 showed the remaining defect was the 28-level "changed" threshold: the frame where it crosses the Master's dark nose is within 28 levels of it. Approved change, scoped to `"hollow": True` items:

- **`exact_changes(cfg, cand, master, scale, dx, dy, resized)`:** a byte-for-byte RGBA comparison of the **candidate as loaded** with the Master. It is available only for a hollow item whose candidate sits on the Master exactly: no resize, alignment scale 1 and no shift. Otherwise it returns `None` and the 28-level test applies alone (the run prints which).
  - The resampled candidate can't be used for this: `affine` at identity changes 1.23 million pixels, mostly fully transparent ones.
- **In `extract`:** when the exact comparison is available, the selection is `exact & (a_c > 0.5)` instead of the thresholded comparison. Every pixel over the threshold differs exactly too, so the 28-level case is kept.
  - A first version used `changed | exact`. An end-to-end test caught 2 unchanged Master nose pixels in the overlay: resampling noise had pushed them into the item's colours through the existing "newly in the item's color" test. So the exact difference now replaces the threshold rather than adding to it.
- **In `cut_item` (hollow only):** the overlay alpha is zeroed outside the item's own pixels. The 0.9 px feather now softens the frame's edge without spreading onto unchanged Master pixels.
- **Unchanged:** the spill check still uses the thresholded `changed`. `check_overlay` (eyes, region, crop, empty, tuft), `align` and `color_report` are untouched; the beanie path is unchanged, and re-extracting `beanie_v02` is pixel-identical to the committed overlay.

Tests: `scripts/art/test_make_accessory.py`, **24/24 pass** with `KOA_ART_SLOW=1` (19 pass and 5 skip without it). New tests:
- the exact comparison applies only to hollow items placed exactly (it isn't used after a resize, a rescale or a shift), and a 1-level colour or alpha difference counts;
- the hollow feather stays on changed pixels, while the solid feather still spreads as before;
- end to end through `extract`, a Master-preserved candidate whose uniform brown frame crosses the nose within 28 levels (over 300 px within 10 levels):
  - every one of those pixels is kept, where the threshold alone would lose most of them;
  - the frame pixels above 28 levels are kept too;
  - the lens openings are transparent and the overlay contains no unchanged pixel;
- end to end, a faint ring over an eye (a few levels off the Master) still fails the eye check;
- end to end, an arm running past the allowed region still fails the spill check.

**`round-glasses_v05` re-extracted** (code otherwise unchanged):
```
candidate alpha: alpha channel
alignment: scale 1.000, shift (0, 0) px, body mismatch 0.3 gray levels
exact Master comparison: 15074 px differ from the Master (2940 of them not picked by the 28-level threshold)
median rgb(80, 51, 36) vs catalog swatch rgb(58, 43, 34)
overlay written: art/accessories/round-glasses@idle.master.png  (15074 px)
```
- **Checks:** all pass, in Master space and on the house grid.
- **Overlay:** exactly v05's 15,074 changed pixels (11,349 opaque); 0 unchanged Master pixels; bounds x 299–724, y 755–919.
- **Frame:** all 11,061 frame pixels are in it at alpha > 128, including every one of the 729 that were missing before. It is one connected piece (15,071 px at alpha > 128). Both rims cover 360° and the bridge is continuous over the nose.
- **Eyes:** 0 overlay px within 58 px of either eye centre. Both lens openings are transparent and enclosed (14,249 and 13,862 px).
- **Review export:** `art/review-phase11/round-glasses/` only (14.5 kB, 8.8 kB). Review sheet: `art/review-phase11/round-glasses_review.png`.

## 11. Integration (owner-approved 2026-11-16; committed as `d8a40b4`)

Following the beanie's pattern (`docs/phase-11/step-1-beanie.md` §3), with no artwork, extractor, validation or beanie changes:

- **Assets:** `python -I scripts/art/make_accessory.py export round-glasses` (unchanged export, every check re-run and passed) wrote `public/characters/accessories/round-glasses@idle.webp` (1024×1536, 14.5 kB) and `round-glasses@idle-512.webp` (512×768, 8.8 kB), byte-identical to the reviewed files in `art/review-phase11/round-glasses/`.
- **Manifest:** `accessoryArt['round-glasses'] = { kind: 'overlay', layer: 'front', frames: { idle: accessoryFrame('round-glasses', 'idle') }, bounds: { x: 321, y: 739, width: 382, height: 158 } }`. The bounds are measured like the beanie's: pixels with alpha > 32 (x 329–694, y 747–888) plus 8 px. They sit below the figure's top (557), so `headroomAbove` and the bubble lift are 0 for the glasses.
- **Catalog:** unchanged. `round-glasses` was already listed: Round glasses, `glasses` category, `face` slot, 180 coins. Purchase, ownership and equip use the existing flow; the Shop card shows the `bounds` crop through `AccessoryThumb` instead of the swatch.
- **Beanie and glasses together:** they share no pixels (0 overlapping px; at least 42 rows apart in every column), so their stacking order doesn't matter.
- **Offline:** `scripts/check-build.mjs` `PRECACHE_FIXED` gained both WebPs (11 fixed entries). The existing glob `characters/accessories/*.webp` already matched. The build check now gives **22 precache entries, 1,025.4 kB** (budget 1,200 kB), and `dist/sw.js` lists both files.
- **Tests:**
  - `manifest.test.ts`: the glasses entry, its bounds (on the face, centred on the axis), the Shop preview, and no headroom next to the beanie;
  - `Koala.test.tsx`: the glasses above the base and blink frames, kept on top while the eyes are closed, in both sizes and decorative, and worn with the beanie;
  - `AccessoryThumb.test.tsx`: the glasses crop;
  - `check-build.test.ts`: 11 fixed entries; an unapproved frame (the scarf) is still rejected;
  - `e2e/shop.e2e.ts`: see `docs/phase-10/e2e-suite.md`.
  - Results: **unit 661 / 661, lint clean, build `check-build: OK`, E2E 81 / 81.**
- **Checked in the running production build** (`pnpm preview`, 390×844, 820×1180, 1440×900, DPR 2), with the glasses alone, the glasses with the beanie, and the beanie alone:
  - the glasses frame is stacked after the base and blink frames, on exactly their box;
  - the 1024 frame is chosen at all three sizes;
  - with the blink frame forced on (after the images decode), the closed eyes show through clean lenses;
  - the beanie alone looks as before;
  - the Shop card shows the glasses at all three sizes;
  - no console errors.
  - At first a few forced-blink screenshots looked wrong (open eyes, or no glasses in one). The cause was the screenshots firing before the `decoding="async"` images had painted: the layer list showed every frame present at full opacity, and waiting for `img.decode()` gave correct shots everywhere.
