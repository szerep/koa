# Phase 2 · Gate 0 — Koa Master Production Package

**Goal:** one canonical image of Koa that becomes the identity reference for every future asset.
**Asset ID:** `koa_idle_neutral` (the "Koa Master")
**Tool:** ChatGPT ImageGen
**Status:** ✅ Complete (2026-11-02). v02 approved as the **provisional** Master; blink frame produced; exports in `public/characters/`.

Nothing else is produced until the Master is approved.

---

## 1. Generation specification

### What the Master depicts

| Aspect | Specification |
|---|---|
| **Pose** | Sitting upright on the ground, facing the viewer **straight on** (0° rotation, no head tilt). Legs stretched forward and slightly apart so both **foot soles face the viewer**. Arms relaxed, paws resting on the thighs or lap. Calm and balanced, close to symmetrical. |
| **Expression** | **Neutral-content.** Eyes open, looking straight at the viewer. Small closed-mouth gentle smile. No open mouth, wink, or blush exaggeration. |
| **Framing** | One character, full body, nothing cropped (ear tips, tuft, and feet fully inside the frame). |
| **Camera** | Eye level with the koala's chest, front orthographic-like view, minimal perspective distortion (as if shot with a long lens). |
| **Lighting** | Soft warm key light from the **upper left**, gentle fill, soft ambient occlusion. No rim light, dramatic shadows, or colored light. |
| **Background** | Transparent. If transparency fails, use a flat solid `#F9EEE1` (see §5). |
| **Shadow** | **None.** No contact shadow, floor, or cushion. The app draws the shadow. |
| **Props** | **None.** No mug, book, plant, or leaf. |

### Identity (locked decisions)

| Feature | Locked value |
|---|---|
| Render style | Soft 3D plush toy, short dense felt-like fur with visible fiber texture, matte (not glossy), handcrafted collectible feel. |
| Head | Very large, wide, softly rounded; about 1.2× wider than tall. Takes up about 55–60% of the sitting figure's height. |
| Crown tuft | **Always present.** A small, soft tuft of fluffier fur at the top center of the head. Subtle, not a mohawk. |
| Ears | Very large round fluffy discs, set high on the sides of the head and slightly forward-facing. Fluffy grey rims; **pink-cream inner ears** (soft pink `#E5BCB3` fading to cream at the center). Total width including ears ≈ 1.5× head width. |
| Nose | **Large, dark charcoal** (`#3F3837`), rounded, slightly pear-shaped and taller than wide, broader and bulbous at the bottom, with a soft satin highlight. Centered, the dominant facial feature. |
| Eyes | Small, round, glossy near-black eyes with **one white catchlight** each. Set wide apart, level with the upper part of the nose. Very faint fur "brow" creases above them. |
| Cheeks | Soft, round, subtle pink blush beside and below the eyes. |
| Muzzle and mouth | A rounded **cream muzzle patch** below the nose; a small gentle smile line under the nose (a soft "w"/"ω" shape). |
| Fur color | Natural soft grey (`#B3AEAD`-ish), neutral to very slightly cool. Not blue, brown, or silver. |
| Body | Short, round, plush. **Cream belly patch** visible below the hoodie hem. |
| Hoodie | **Sage eucalyptus green** (`#8DA47C`), thick cozy cotton fleece, **cropped** (ends above the belly patch). Hood bunched behind the neck, **kangaroo pocket**, two **cream drawstrings with small knots**. Sleeves reach the wrists. No logo, print, or text. |
| Paws and feet | Grey paws. Oversized feet; each sole shows **dark brown pads: one large oval pad and three small toe beans**. |

---

## 2. Image dimensions, transparency, and composition

| Parameter | Value |
|---|---|
| **Generation size** | **1024 × 1536 (portrait)** — select the portrait/tall aspect in ChatGPT |
| **Production canvas** | 1024 × 1536 px, PNG RGBA (the master file) → WebP exports at 1024 and 512 wide |
| **Transparency** | True alpha channel. Fur edges must stay soft and natural, with no hard cut-out halo. |
| **Horizontal placement** | Centered; the figure's vertical axis sits at x = 512 |
| **Width occupancy** | Ear-tip to ear-tip ≈ **75–80%** of canvas width (about 780–820 px) |
| **Vertical placement** | Figure in the **lower part** of the canvas. Bottom of the feet and body around 90% of the height. **Generous empty headroom above** (about 35–40% of the canvas). |

**Why portrait with headroom:** every later pose (standing Celebrate with raised arms, hats, explorer-hat brims, speech-bubble anchor) must fit the **same canvas at the same scale**. The empty space above the Master is reserved for them.

**Normalization (done in code after approval, not by ImageGen):** the approved image is trimmed and aligned to the house grid:

- head width (cheek fur edge to edge, ears excluded) = **500 px**
- vertical axis at **x = 512**
- **ground line** (lowest point of the body and feet) at **y = 1400**

Every later pose uses the same scale and ground line. ImageGen therefore only needs to be *roughly* right on placement. Identity is what must be exact.

---

## 3. The ChatGPT ImageGen prompt

### Before you paste the prompt

1. Start a **new ChatGPT conversation** dedicated to Koa, and keep using it for every iteration. The conversation history helps consistency.
2. Attach these reference images from `art/reference/gate0/` in this order:
   1. `ref-front.png`: front view (primary identity reference)
   2. `ref-idle-pose.png`: sitting pose reference
   3. `ref-hero-face.png`: face, fur, and material detail
   4. `ref-details.png`: eye, fur, paw pad, hoodie close-ups
3. Choose the **portrait (2:3)** aspect ratio if the UI offers it.
4. Paste the prompt below **unchanged** for the first attempt.

### Prompt (v1)

```text
Create a single production character asset of "Koa", the koala mascot shown in the attached reference images. The references define the character exactly — this is the same individual, not a new koala. Match its face, proportions, fur, colors and hoodie as closely as possible. Image 1 (front view) is the primary identity reference. Image 2 shows the sitting pose. Images 3 and 4 show material and detail quality.

FORMAT
- Portrait image, 1024 × 1536.
- Fully transparent background (PNG with real alpha channel). No backdrop, no floor, no cushion, no cast shadow, no contact shadow.
- Exactly one character. No text, no labels, no logo, no border, no design-sheet layout.

COMPOSITION
- Full body, perfectly centered horizontally, nothing cropped: ear tips, head tuft and feet completely inside the frame.
- The character sits in the lower part of the image; leave a large empty area above the head (about the top third of the image empty).
- From ear tip to ear tip the character fills about 75–80% of the image width.
- Straight front view at the koala's chest height, like a product photo taken with a long lens; minimal perspective distortion. Head not tilted, not turned.

POSE AND EXPRESSION
- Sitting upright on the ground, calm and balanced, almost symmetrical.
- Both short legs stretched forward and slightly apart, so both foot soles face the viewer.
- Arms relaxed, front paws resting on the thighs.
- Neutral, content expression: eyes open looking straight at the viewer, small gentle closed-mouth smile.

CHARACTER DESIGN (must match the references)
- Style: soft 3D plush toy, like a premium handcrafted collectible stuffed animal. Short dense felt-like fur with visible fine fiber texture, matte, never shiny or realistic.
- Head: very large, wide and softly rounded, slightly wider than tall; the head is more than half of the character's total height. A small soft tuft of fluffier fur sits at the top center of the head.
- Ears: very large, round, fluffy ears set high on the sides of the head. Fluffy grey rims and soft pink-cream inner ears (soft pink fading to cream in the center).
- Nose: a large dark charcoal nose, rounded and slightly pear-shaped, taller than wide and fuller at the bottom, with a soft satin highlight. It is the most prominent facial feature and sits in the center of the face.
- Eyes: small round glossy black eyes, each with one small white catchlight, set wide apart at the level of the upper part of the nose. Very faint soft fur creases above the eyes.
- Cheeks: subtle soft round pink blush next to and slightly below the eyes.
- Mouth: a rounded cream muzzle patch below the nose with a small, gentle smiling mouth line.
- Fur color: natural soft grey, neutral to very slightly cool — not blue, not brown, not silver.
- Body: short, round and plush, with a cream belly patch visible below the hoodie.
- Hoodie: sage eucalyptus green, thick cozy cotton fleece, cropped so it ends above the cream belly patch. Hood bunched softly behind the neck, a kangaroo pocket on the front, two cream drawstrings with small knots at the ends. Sleeves reach the wrists. No logo, no print, no text.
- Paws and feet: grey paws; oversized feet whose soles show dark brown pads — one large oval pad and three small round toe beans on each foot.

LIGHTING AND RENDER
- Soft warm key light from the upper left, gentle fill light, soft ambient occlusion in the creases. No rim light, no dramatic shadows, no colored lighting.
- High detail, clean, crisp fur edges suitable for cutting out. Calm, cozy, premium mobile-game character render.

AVOID
Realistic or photographic koala, glossy plastic or vinyl look, clay or low-poly look, 2D flat or cel-shaded style, anime style, outlines, any background or floor, cast shadow, props, accessories, glasses, hats, text, watermark, logo on the hoodie, extra limbs or fingers, open mouth, teeth, tongue, wink, angry or sad expression, head tilt, three-quarter view, side view, cropped ears or feet, multiple characters, design-sheet layout.
```

### Review log

| Version | Result | Key findings |
|---|---|---|
| v03 | ⚪ Not reviewed | `art/master/candidates/koa_master_v03.png` was added after v02 was approved. It has not been through the Gate 0 review and is not used by the app. |
| v02 | ✅ **Approved as provisional Master** (after an earlier "regenerate" assessment) | Head now wider than tall (W:H about 1.3, up from about 1.2); inner ears pinker ✅. **Not fixed:** head still about 49% of sitting height (target about 60%); feet about 0.38× head width (target about 0.25×); lower body (634px) wider than the head (583px); tuft still spiky; brown iris still visible. Two text-only attempts didn't move the body proportions. |
| v01 | ❌ Not approved — regenerate | Technically sound (placement fixable by normalization). Identity drift: head too narrow and egg-shaped, about 52% of sitting height (target about 60%); feet about 2× reference size; body too broad; tuft too large and spiky; brown iris ring; inner ears too peach. Successful: nose, muzzle, smile, fur texture, cheek blush, hoodie details, plush material. |

### Prompt (v02)

**v02 differs from v1 by a correction block placed at the top.** The base specification below it is v1 unchanged. If the two ever conflict, the correction block wins.

#### Before you paste v02

1. **Start a fresh ChatGPT conversation.** Don't continue the v01 chat. Its history contains v01, and ImageGen tends to anchor on images it has already produced.
2. **Do not attach v01.** It's only a record of the previous direction, not a reference. Every identity, proportion, and color cue must come from the original sheet.
3. Attach from `art/reference/gate0/`, in this order:
   1. `ref-idle-pose.png`: sitting pose, **primary reference for head shape and proportions in v02**
   2. `ref-front.png`: front view, identity reference for face and features
   3. `ref-hero-face.png`: face, fur, and material detail
   4. `ref-details.png`: eye, fur, paw pad, and hoodie close-ups
4. Choose the **portrait (2:3)** aspect ratio and paste the full prompt below unchanged.
5. Save the download as `art/master/candidates/koa_master_v02.png`.

> Note the reference order changed: the **sitting pose is now image 1**, because the head-to-body proportion in that crop is the main correction target. The prompt text refers to the images by this new order.

#### v02 prompt

```text
Create a single production character asset of "Koa", the koala mascot shown in the attached reference images. The references define the character exactly — this is the same individual, not a new koala. All identity, proportions and colors come from these reference images only.

Image 1 (sitting koala) is the primary reference for the pose AND for the head shape and head-to-body proportions. Image 2 (front view) is the identity reference for the face and features. Images 3 and 4 show material and detail quality.

=== CORRECTIONS — HIGHEST PRIORITY ===
These corrections override everything else in this prompt.

1. HEAD SHAPE AND PROPORTIONS (most important)
- The head is significantly wide and dome-shaped: a broad, soft, rounded dome that is clearly WIDER THAN TALL, full and wide at the cheeks, wide across the forehead. It must NOT be egg-shaped, oval, pear-shaped or narrowing toward the top.
- The head dominates the character: from the top of the head down to the chin, the head takes up about 60% of the character's total sitting height (measured from the top of the head to the bottom of the feet).
- Match the head shape and the head-to-body proportions of Image 1 as closely as possible.

2. FEET AND BODY
- The feet are small and short: each foot sole is only about one quarter of the head's width. The feet must not dominate the lower body.
- The torso and hoodie are narrow and compact: the body is clearly narrower than the head, about three quarters of the head's width. Not broad, not squat, not bottom-heavy.
- Keep the cute, balanced proportions of Image 1: big wide head, small compact body, small feet.

3. CROWN TUFT
- Only a small, soft, subtle tuft at the top center of the head: a little patch of slightly fluffier fur that barely rises above the head's outline. Not styled hair, not spikes, not a crest, not a mohawk.

4. EYES
- Near-black glossy eyes like small black beads, each with one small white catchlight. No visible brown iris, no iris ring, no colored eyes.

5. INNER EARS
- Slightly pinker pink-cream inner ears, as in Image 2: a soft muted pink that fades to cream toward the center. Not peach, not plain cream.

KEEP EXACTLY (these were already right):
- The large dark charcoal pear-shaped nose (taller than wide, fuller at the bottom), the cream muzzle patch, the small gentle smile, the subtle pink cheek blush, the short dense matte plush fur texture, the hoodie details (hood behind the neck, kangaroo pocket, two cream drawstrings with knots), and the overall premium plush-toy material.
- Hoodie color exactly as in the reference images: muted, soft sage green.

=== BASE SPECIFICATION ===

FORMAT
- Portrait image, 1024 × 1536.
- Fully transparent background (PNG with real alpha channel). No backdrop, no floor, no cushion, no cast shadow, no contact shadow.
- Exactly one character. No text, no labels, no logo, no border, no design-sheet layout.

COMPOSITION
- Full body, perfectly centered horizontally, nothing cropped: ear tips, head tuft and feet completely inside the frame, with clear empty margin on the left and right.
- The character sits in the lower part of the image; leave a large empty area above the head (about the top third of the image empty).
- From ear tip to ear tip the character fills about 75–80% of the image width.
- Straight front view at the koala's chest height, like a product photo taken with a long lens; minimal perspective distortion. Head not tilted, not turned.

POSE AND EXPRESSION
- Sitting upright on the ground, calm and balanced, almost symmetrical, like Image 1.
- Both short legs stretched forward and slightly apart, so both small foot soles face the viewer.
- Arms relaxed, front paws resting on the thighs.
- Neutral, content expression: eyes open looking straight at the viewer, small gentle closed-mouth smile.

CHARACTER DESIGN (must match the references)
- Style: soft 3D plush toy, like a premium handcrafted collectible stuffed animal. Short dense felt-like fur with visible fine fiber texture, matte, never shiny or realistic.
- Head: very large, wide, dome-shaped and softly rounded, clearly wider than tall; about 60% of the character's total sitting height. A small, subtle tuft of slightly fluffier fur at the top center.
- Ears: very large, round, fluffy ears set high on the sides of the head. Fluffy grey rims and soft pink-cream inner ears (soft pink fading to cream in the center).
- Nose: a large dark charcoal nose, rounded and slightly pear-shaped, taller than wide and fuller at the bottom, with a soft satin highlight. It is the most prominent facial feature and sits in the center of the face.
- Eyes: small round glossy near-black eyes with no visible iris, each with one small white catchlight, set wide apart at the level of the upper part of the nose. Very faint soft fur creases above the eyes.
- Cheeks: subtle soft round pink blush next to and slightly below the eyes.
- Mouth: a rounded cream muzzle patch below the nose with a small, gentle smiling mouth line.
- Fur color: natural soft grey, neutral to very slightly cool — not blue, not brown, not silver.
- Body: short, compact and plush, narrower than the head, with a cream belly patch visible below the hoodie.
- Hoodie: muted sage green exactly as in the reference images, thick cozy cotton fleece, cropped so it ends above the cream belly patch. Hood bunched softly behind the neck, a kangaroo pocket on the front, two cream drawstrings with small knots at the ends. Sleeves reach the wrists. No logo, no print, no text.
- Paws and feet: grey paws; small feet whose soles show dark brown pads — one large oval pad and three small round toe beans on each foot.

LIGHTING AND RENDER
- Soft warm key light from the upper left, gentle fill light, soft ambient occlusion in the creases. No rim light, no dramatic shadows, no colored lighting.
- High detail, clean, crisp fur edges suitable for cutting out. Calm, cozy, premium mobile-game character render.

AVOID
Egg-shaped, oval or narrow head; head narrower at the top; small head; big or oversized feet; broad, squat or bottom-heavy body; spiky, styled or tall hair tuft; brown or colored iris, iris ring; peach or plain cream inner ears; realistic or photographic koala, glossy plastic or vinyl look, clay or low-poly look, 2D flat or cel-shaded style, anime style, outlines, any background or floor, cast shadow, props, accessories, glasses, hats, text, watermark, logo on the hoodie, extra limbs or fingers, open mouth, teeth, tongue, wink, angry or sad expression, head tilt, three-quarter view, side view, cropped ears or feet, multiple characters, design-sheet layout.
```

#### What v02 is checked against
The full §6 checklist, with particular attention to:
- **I3:** head wider than tall, dome-shaped, about 60% of sitting height
- **I12:** foot size about ¼ of head width; body narrower than the head
- **I4:** tuft subtle
- **I7:** no iris ring
- **I5:** inner-ear pink

Anything that was a pass in v01 (nose, muzzle, smile, blush, fur, hoodie details) must not regress.

### Iteration phrasebook (use after the first result)

**Keep fixes surgical.** For small, local problems, use ChatGPT's **select-area edit** and ask only for that change. For global problems (wrong proportions, wrong style), regenerate with the full prompt plus one corrective sentence at the top.

The lock sentence goes at the start of every edit request:

> *Keep the character, pose, framing, lighting and everything else exactly identical. Change only the following:*

| Problem | Correction to append |
|---|---|
| Nose too small or wrong shape | "Make the nose larger, the clear focal point of the face: dark charcoal, rounded, taller than wide and fuller at the bottom, exactly like reference image 1." |
| Eyes too large or "cute-anime" | "Make the eyes smaller: simple small glossy black dots with one tiny white catchlight, set wide apart, like reference image 1." |
| Ears too small or set too low | "Make the ears larger and rounder, set higher on the head, so the total width with ears is about one and a half times the head width." |
| Tuft missing or too big | "Add / reduce the tuft to a small, soft tuft of slightly fluffier fur at the top center of the head — subtle." |
| Hoodie too long, belly hidden | "Crop the hoodie shorter so it ends above a visible cream belly patch." |
| Hoodie color drift | "Hoodie color: soft muted sage eucalyptus green, not olive, not mint, not saturated." |
| Fur too blue or brown | "Fur color: natural neutral soft grey, not blue-grey, not brown." |
| Looks too realistic or too glossy | "Make the material a soft matte plush toy with short felt-like fur, like a premium stuffed animal, not a real koala and not plastic." |
| Shadow or floor appears | "Remove the floor and all shadows below the character; fully transparent background." |
| Feet pads wrong | "Each foot sole shows dark brown pads: one large oval pad and three small round toe beans." |
| Character cropped or too large | "Zoom out: show the full body with empty space above the head; the character fills about 75–80% of the width." |

**Iteration log:** save every candidate to `art/master/candidates/` as `koa_master_v01.png`, `v02`, and so on, and note what changed. That lets us return to an earlier version if a later edit makes things worse.

---

## 4. Visual elements to avoid (full negative list)

ChatGPT ImageGen has no separate negative-prompt field, so the essentials are in the prompt's AVOID block. This is the complete reference list used during review.

**Style and material**
- Photorealistic or real koala anatomy, realistic fur clumping
- Glossy vinyl, plastic, porcelain, or clay; low-poly; 2D flat, cel-shaded, or vector; anime or chibi-manga eyes
- Outlines, ink lines, painterly brushstrokes, film grain, depth-of-field blur on the character

**Identity drift**
- Small or flat nose; pink, brown, or button nose; a nose shaped like a cat's or a bear's
- Large, sparkly, colored, or white-sclera eyes; eyelashes; eyebrows as distinct shapes
- Small, pointed, or low-set ears; missing pink inner ear; pure white inner ear
- Missing crown tuft, or a large hair-like tuft
- Blue-grey, silver, brown, or white fur; patterned fur
- Missing cream muzzle; missing blush, or heavy cartoon blush circles
- Long torso or adult proportions; a head smaller than the body

**Hoodie drift**
- Olive, mint, teal, forest, or saturated green; a zip-up hoodie, sweater, or jacket
- Long hoodie hiding the belly; missing pocket or drawstrings; logo, text, print, or patch

**Composition and technical**
- Background, floor, cushion, cast or contact shadow, vignette
- Fake transparency (a checkerboard pattern painted into the image)
- Cropped ears or feet; off-center figure; three-quarter, side, or tilted view; strong perspective
- Props, accessories, glasses, hats, a second character, text or watermark
- Extra or missing limbs, fused paws, extra toe beans

**Expression**
- Open mouth, teeth, tongue, wink, closed eyes, angry, sad, smug, or sleepy expression

---

## 5. Transparency plan

ChatGPT ImageGen can usually produce a true transparent PNG when asked. Known failure modes and what to do:

| Result | Action |
|---|---|
| ✅ True alpha, soft fur edges | Use it. |
| ❌ Checkerboard pattern painted into the image | Not transparent. Ask: "The background must be truly transparent with an alpha channel, not a checkerboard pattern." |
| ❌ Hard, jagged, or haloed cut-out fur edges | Regenerate on a flat background (below) and we cut it out in code. |
| ❌ Transparency keeps failing | Fallback: ask for a **flat, uniform, solid background color #F9EEE1** (warm cream, no gradient, no shadow). We remove it in the pipeline. Any residual edge tint is cream, which blends with the app's own cream background. |

Don't use a green-screen or chroma-key background. It would bleed into the sage hoodie and the grey fur.

**Download:** use the image's **download button** to get the original file. A screenshot loses the alpha channel and the resolution.

---

## 6. Evaluation checklist

Every check must pass for approval. A fail is labelled **Edit** (fix with a local edit) or **Regen** (regenerate from the prompt).

### A. Technical (I verify these with a script when you add the file)

| # | Check | Pass criteria | If it fails |
|---|---|---|---|
| T1 | Dimensions | 1024 × 1536 portrait | Regen |
| T2 | Real alpha | RGBA PNG; background pixels are fully transparent (alpha = 0); no painted checkerboard | §5 |
| T3 | Clean edges | Soft natural fur edges with no colored halo, jaggies, or leftover background | §5 fallback |
| T4 | No shadow or floor | No semi-transparent dark pixels under the feet | Edit |
| T5 | Not cropped | No opaque pixels touching the canvas edges | Regen |
| T6 | Placement | Ear-span 70–85% of width; empty headroom of at least 30% of the height; figure roughly centered | Normalization can correct mild deviations |
| T7 | Clean image | No text, watermark, props, or second character | Edit or Regen |
| T8 | Resolution quality | Fur texture crisp at 100% zoom; no smeared or AI-melted areas around the eyes, paws, or drawstrings | Edit |

### B. Identity (we review these together, side by side with `ref-front.png` and `ref-idle-pose.png`)

| # | Check | Pass criteria | If it fails |
|---|---|---|---|
| I1 | **Gut check** | At first glance it's *Koa from the sheet*, not "a cute koala" | Regen |
| I2 | Style and material | Matte plush with short felt fur; same premium 3D-toy feel as the sheet | Regen |
| I3 | Head proportion | Head wider than tall (about 1.2:1); head is more than half of the sitting height | Regen |
| I4 | Crown tuft | Present, small, soft, centered | Edit |
| I5 | Ears | Very large, round, high-set; span about 1.5× head width; fluffy grey rims; pink-cream inner ears | Edit (small) or Regen |
| I6 | Nose | Large dark charcoal, slightly pear-shaped, taller than wide, fuller at the bottom; dominant and centered | Edit |
| I7 | Eyes | Small glossy black dots, one catchlight each, set wide, level with the upper nose; faint brow creases at most | Edit |
| I8 | Cheeks | Subtle soft pink blush, symmetrical | Edit |
| I9 | Muzzle and mouth | Cream muzzle patch; small closed gentle smile | Edit |
| I10 | Fur color | Neutral soft grey, matching the sheet, not blue or brown | Regen (global) |
| I11 | Hoodie | Sage eucalyptus green; cropped above the cream belly patch; hood behind the neck; kangaroo pocket; two cream drawstrings with knots; no logo | Edit |
| I12 | Feet | Soles facing the viewer; dark brown pads, one large and three toe beans each | Edit |
| I13 | Paws | Two grey paws resting on the thighs; correct count, no fused or extra digits | Edit |
| I14 | Pose | Straight front view, no tilt, close to symmetrical, calm upright sitting | Regen |
| I15 | Expression | Neutral-content: eyes open, looking at the viewer, gentle closed smile | Edit |
| I16 | Lighting | Warm key light from the upper left, soft, no rim or colored light | Regen |

### C. Usability as the Master (forward-looking)

| # | Check | Why it matters |
|---|---|---|
| U1 | Eyes are clearly separated, readable shapes | Gate 1 face edits (blink, happy, surprised) must be able to change only the eyes and mouth |
| U2 | Head silhouette is clean and unobstructed | Hats, headphones, and the flower anchor onto it |
| U3 | Face area and neck are unobstructed | Glasses and the scarf anchor there |
| U4 | The hoodie reads as one clean garment | Hoodie recolors (clothing option A) must be possible |
| U5 | It still reads at small size | Check at 25% zoom (about the size of the shop thumbnail) |

### Approval

The Master is approved when **every T, I, and U check passes** and you sign off on it. On approval:

1. The file is saved as `art/master/koa_idle_neutral.master.png` (untouched source).
2. I normalize it to the house grid and export `public/characters/koa_idle_neutral.webp` (1024 and 512).
3. `docs/character-bible.md` gets the Master's measured **proportions**. These become the numeric targets for every later gate. **Colors (including the hoodie) are always sampled from the original reference sheet, never from a generated candidate.** The palette tokens get corrected from the sheet, since the current `--euca-500` (`#8DA47C`) is greener than the sheet's hoodie.

---

## 7. Outcome (2026-11-02)

**v02 is approved as the provisional Koa Master.** The iteration loop was stopped deliberately: the priority is a working app, and the artwork can be improved later. Because every pose shares the house grid and the manifest, a future improved Master can replace these files without code changes.

### Known deviations (accepted for now, revisit in a future art pass)
- Head is about 49% of sitting height (target about 60%); the top of the head narrows slightly.
- Feet are about 0.38× head width (target about 0.25×); the lower body is wider than the head.
- Crown tuft is larger and spikier than intended.
- A brown iris is visible in the open eyes.

### Files
| File | What it is |
|---|---|
| `art/master/candidates/koa_master_v02.png` | Original ImageGen output (untouched, sha256 `f098d7f4…dc3f`) |
| `art/master/koa_idle_neutral.master.png` | Byte-identical copy used as the pipeline's source |
| `art/master/koa_idle_blink.master.png` | Blink frame. Made by `scripts/art/make_blink.py`, which edits **only the two eye regions** of the Master (fur filled by gradient-domain blending from the forehead, plus a closed-eye arc in the style of the sheet's Sleepy and Drink faces). The script checks that no pixel outside the eye regions changed. |
| `art/master/*.normalized.png` | Both frames on the house grid |
| `public/characters/koa_idle_neutral.webp` / `-512.webp` | App exports: 108 KB / 33 KB |
| `public/characters/koa_idle_blink.webp` / `-512.webp` | App exports: 109 KB / 33 KB |

### Normalization result (`scripts/art/normalize_export.py`)
- Scale 0.8576 (head 583 → 500px). The figure is 814×843px at offset (105, 557).
- Ear span 79.5% of the width ✅, headroom 36.3% ✅, center x = 511.5 ✅, ground line y = 1399 ✅.
- Stray background pixels removed and the body made fully opaque.
- Neutral and blink frames have **identical alpha**; they differ only in the eye area (x 365–663, y 779–864), so the blink swap is jump-free.
