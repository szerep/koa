# Koa — Character Bible and Asset Plan

Canonical reference: `art/reference/koala-design-sheet.png`. This is a reference only and is never displayed in the app.

## 1. Identity

**Koa, the study koala.** Gentle, a little sleepy, and quietly proud of you. Koa is a cheerful study buddy, not a coach or a drill sergeant. Koa loves eucalyptus, warm drinks, naps, and new hats. Koa doesn't nag, guilt you, or interrupt focus.

Voice: short, warm, lowercase-friendly sentences. Encouraging, never preachy. Examples: "We got this!", "One more page?", "Time for a little break.", "I'm proud of you!", "Can we get a new hat?"

## 2. Appearance (what must stay identical in every asset)

| Feature | Specification |
|---|---|
| **Render style** | Soft 3D plush or felt toy, with visible short fur texture. Warm key light from the upper left, soft ambient occlusion, gentle contact shadow. No outlines. |
| **Fur** | Natural cool-to-neutral grey (~`#B3AEAD`), slightly lighter at the edges and fluffier on the ears and crown. |
| **Head** | Large, wide, softly rounded rectangle, wider than tall (about 1.25:1). The dominant mass of the character. |
| **Ears** | Very large round, fluffy discs set high and to the sides. Each is about 55% of head width, together spanning roughly 1.5× the head width. Fur rims with **pink-cream inner ears** (`#E5BCB3`, paler toward the center). |
| **Nose** | **Large dark charcoal oval** (`#3F3837`), taller than wide, with a slight bulb at the bottom and a soft specular highlight. Centered, sitting just below the eye line, about ⅓ of the face's width. The single most recognizable feature. |
| **Eyes** | Small, glossy, near-black dots, each with one white catchlight. Set wide, level with the top of the nose. Expressions change only the eyes and mouth shapes (arcs, stars, closed lines). |
| **Cheeks** | Soft round blush patches (`#E5BCB3` at low opacity) beside the eyes, slightly below them. |
| **Muzzle and mouth** | A cream muzzle patch under the nose, with a small "ω"-like smiling mouth. Open mouth only for happy, excited, or surprised. |
| **Body** | Chibi proportions: total height ≈ **2 to 2.2 heads**. A stubby, round body with a cream belly patch (visible below the hoodie hem). |
| **Limbs** | Short, round arms covered by the hoodie sleeves down to grey paws. Short legs with oversized feet. The **foot soles show dark brown pads**: one large pad and three toe beans. |
| **Hoodie** | Sage eucalyptus green (`#8DA47C`), thick and cozy, slightly cropped. The hood is bunched behind the neck, it has a **kangaroo pocket**, and **cream drawstrings with small knots** hang at the chest. No logo. |

### Finalized identity decisions (approved 2026-11-02)

These resolve the inconsistencies in the sheet:

1. **Crown tuft:** always present. A small, soft tuft at the top center of the head, in every pose.
2. **Inner ears:** pink-cream (soft pink `#E5BCB3` fading to cream at the center).
3. **Hoodie:** cropped, with the cream belly patch visible below the hem.
4. **Study pose:** no glasses. Glasses are a purchasable accessory only.
5. **Clothing:** hoodie recolors (option A in §5).
6. **Wave pose:** not on the sheet, so it will be generated new in Gate 2 using the Master as the reference.

## 3. Asset production plan

### Why the sheet can't be cut up

The sheet is 1536×1024 RGB with no alpha channel, and each pose is only about 170px tall. The home-screen koala renders at about 280pt, which is about **840px at @3x**. Crops would be blurry, have backgrounds baked in, and suffer from the inconsistencies above. Every asset has to be produced fresh, at high resolution, using the sheet as the identity reference.

### Production spec (applies to every character asset)

- **Canvas:** 1024×1536 portrait, which is ChatGPT ImageGen's native tall size, so the image is never resampled. Every pose shares the **same camera, the same scale (head width 500px), and the same ground line (y = 1400)**, with the character centered at x = 512. This is what lets poses crossfade without jumping. The full Gate 0 specification is in `docs/phase-2/gate-0-koa-master.md`.
- **Transparent background** with PNG alpha. The soft contact shadow is **not** baked in. The app renders it, so it stays consistent across room themes.
- **Lighting:** a warm key from the upper left at the same intensity in every image. No rim light that would clash with room backgrounds.
- **Delivery:** PNG master files go in `art/` (kept outside the bundle, tracked with Git LFS if the size grows). The app uses **WebP exports at 1024px and 512px** in `public/characters/`.
- **Naming:** `koa_<pose>_<expression>.webp` (for example `koa_idle_neutral.webp`).
- **Generation route:** I can't generate raster art myself. In Phase 2 I'll write a precise prompt pack (identity block, per-pose blocks, negative prompts) for your image tool, review every output against this bible, and run the background removal, alignment, and export pipeline in code.

### Current state (2026-11-02)

**Approved provisional Master: `koa_master_v02`.** It is now the primary identity reference for every future asset, with the original sheet as the source for colors and style. Its known deviations from the target proportions are accepted for now and listed in `docs/phase-2/gate-0-koa-master.md` §7. A future art pass may replace it; the house grid and the manifest make that a file swap.

Assets available to the app:
- `public/characters/koa_idle_neutral.webp` (+ `-512`)
- `public/characters/koa_idle_blink.webp` (+ `-512`)

Derived assets (compositions of the approved Master, no new artwork; Phase 9 Step 2, decision D4):
- `public/icons/apple-touch-icon-180.png`, `icon-192.png`, `icon-512.png`: Koa's head and shoulders cropped from `art/master/koa_idle_neutral.normalized.png`, on cream (`--cream-100`). The outer ear rims run slightly off the sides.
- `public/icons/icon-maskable-512.png`: the same frame, fitted so the head, ears and tuft sit inside the central 80% safe circle.
- `public/icons/badge-96.png`: the favicon's leaf mark as a white silhouette (Android notification badge). Not Koa.
- All are made by `scripts/art/make_icons.py`. When the Master is replaced, re-run it; never edit the icons by hand.
- `public/splash/koa-splash-<w>x<h>.jpg` (Phase 9 Step 5, decision D7): 30 iOS startup images (12 iPhone portrait, 9 iPads in portrait and landscape). Each is the idle frame from `art/master/koa_idle_neutral.normalized.png`, unchanged and only resized (0.37× on iPhone SE up to 1.01× on the 13-inch iPad Pro, so never visibly upscaled), centered on cream (`--cream-100`, `#f9eee1`). Koa's artwork is 40% of the screen's shorter side wide, so it's the same physical size in both iPad orientations. No text, no shadow, no new drawing. JPEG quality 92 without chroma subsampling (visually identical to lossless, about ¼ the size).
- Made by `scripts/art/make_splash.py`, which also checks every image and the matching `<link>` tags in `index.html`. Re-run it when the Master is replaced; never edit the splash images by hand.

All other poses, expressions, and accessories are **deferred**. The app must work gracefully with only these two frames. For example, the study and break states keep showing idle until their art exists. A missing asset is never replaced with a substitute drawing.

### Consistency first: the gated pipeline

**Character consistency comes before quantity.** We don't batch-produce assets. Each asset is produced and approved before the next one starts. A smaller set of koalas that are unmistakably the same individual beats a large set that drifts.

**Gate 0: Koa Master (one image).**
Produce a single canonical asset, `koa_idle_neutral`: front-facing, sitting, at the full production spec. Iterate on this one image until it's approved. Once approved, the Master becomes the **primary identity reference** for everything that follows, ahead of the sheet, which stays the style and mood reference. Nothing else gets made until the Master is locked.

**Gate 1: Master variants (same pose, face only).**
`koa_idle_blink`, then `koa_idle_happy`, then `koa_idle_surprised`. These are produced by **editing the face region of the Master** (inpainting or image editing), never by generating a new image. The body, ears, fur, and hoodie stay pixel-identical, so consistency is guaranteed by construction.

**Gate 2: New poses, one at a time.**
In order: `koa_study_focused` (+ its blink frame), `koa_rest_sleepy`, `koa_celebrate_excited`, `koa_wave_happy`. Each is generated with the **Master as its image reference**, then reviewed side by side with the Master on the review page (same scale, same ground line). A pose that fails gets regenerated. It is never "fixed later in the UI".

**Gate 3: Accessories.** These start only after the base poses are locked. Begin with **two** items (beanie and round glasses) to prove the layering system (§5), then add the rest of the sheet's set (cap, scarf, headphones, flower, explorer hat) one at a time.

**Later (Phase 7):** drink, leaf, look-left/right, scratch-ear, show-off, sleepy. These go through the same Gate 2 process.

**What Phase 3 needs:** only Gate 0 plus `koa_idle_blink`. The home screen can be built and polished around the locked Master while the other poses go through their gates.

### Consistency review checklist (every asset must pass)

Each candidate goes on the review page next to the Master at the same scale, with an onion-skin overlay toggle.

1. **Silhouette:** head-to-body ratio about 2–2.2 heads tall; head width-to-height about 1.25:1; ear diameter about 55% of head width; ears set high and to the sides.
2. **Nose:** same shape (taller oval with a soft bulb), same size relative to the head (about ⅓ of face width), same position (just below the eye line).
3. **Eyes:** the same small glossy dots with one catchlight, the same spacing, level with the top of the nose.
4. **Color:** fur, inner ear, hoodie, and nose sampled automatically by a script and compared to the Master within a small tolerance (no drift toward blue-grey or olive).
5. **Fur and material:** the same plush fur length and texture. No smoother, shinier, or more realistic render.
6. **Hoodie:** sage green, cropped at the belly patch, kangaroo pocket, cream drawstrings with knots, no logo.
7. **Details:** crown tuft present (if approved), pink-cream inner ears, cheek blush, cream muzzle, dark brown foot pads (1 + 3).
8. **Lighting and scale:** key light from the upper left, transparent background, feet on the shared ground line.
9. **The gut check:** placed side by side, would someone say "that's Koa", not "that's a koala"?

Any single fail means the asset is rejected.

**Props and decor (later):** pillow (part of #6), book (part of #4), mug, eucalyptus sprig, sparkle particles. Room backgrounds are separate illustrated layers (bedroom, library, garden, study room).

## 4. Character states (how the koala "lives")

A small **finite state machine** in `src/core/koala/` decides what the koala is doing. A presentation component (`<KoalaStage>`) only renders the result.

```
               app open
                  │
                  ▼
   ┌────────► GREETING (wave, 2s) ─────────┐
   │                                       ▼
   │   ┌──── tap ──── IDLE ◄──── timeout ──── REACT (happy / surprised)
   │   │           │   ▲ │
   │   ▼   ambient │   │ │ 5 min no input
   │ REACT     (look,  │ ▼
   │           drink,  │ NAPPING (rest_sleepy)
   │           leaf…)  │
   │                   │
   │  timer: study ─► STUDYING (study_focused + blink) — ambient & speech muted
   │  timer: break ─► RESTING (rest_sleepy)
   │  study complete ─► CELEBRATING (celebrate, 3s) ─► IDLE / RESTING
   │  item equipped ─► SHOWING_OFF (2s) ─► IDLE
   └────────────────────────────────────────────
```

- **Priority order:** timer-driven states (Studying, Resting, Celebrating) are higher than user-driven states (React, Showing Off), which are higher than ambient states (looking around, drinking, napping).
- **While studying,** taps produce at most a soft blink or a small squish. There are no speech bubbles and no pose changes. Studying always wins.
- **Ambient picker:** in Idle, a weighted random ambient action runs every 12–25s. It never repeats the same action twice in a row.
- **Taps:** one tap gives a happy reaction plus a squish. Five taps within 3s gives Surprised. A cooldown prevents spam.
- **Speech bubbles:** come from a line pool keyed by context (greeting, break, celebrate, idle, shop hint). At most one bubble per about 90s, and it auto-dismisses after 3.5s.

### As built in Phase 7 (only the idle frames exist)

The machine lives in `src/core/koala/brain.ts`, with tuning in `src/config/koalaBehavior.ts` and lines in `src/config/koalaLines.ts`. Poses that don't exist yet (wave, study, rest, celebrate, look, drink) are **not substituted**. Every behavior is either a transform of the approved idle frame (sway, tilt, stretch, wiggle, hop, squish) or uses the approved blink frame (slow blink, eyes closed while napping). When new poses pass their gates, the brain's states map onto them without rule changes.

| Situation | What Koa does |
|---|---|
| **App opens** | A time-of-day greeting after 1.2s (skipped during focus, or if Koa is already celebrating). No wave pose yet. |
| **Idle** | Every 12–25s a weighted ambient action: sway, tilt, stretch, slow blink, wiggle, or a short line. Never the same action twice in a row. |
| **Speech, unprompted** | At most once every **2 minutes** (raised from 90s to keep Koa subtle). Shop hints only when something unowned is affordable. Lines aren't repeated until 6 others have been said. |
| **Tap** | A squish, wiggle or bounce, never the same twice in a row; sometimes a short reply (at most one every 20s). The 3rd quick tap tickles (giggle + line), the 5th within 3s startles Koa (jump + "Whoa!"), then 4s of soft squishes only. |
| **Focus running** | Koa settles in, then stays calm: slower breathing and blinks, no ambient actions, no speech, no naps. Taps get a soft squish at most every 1.2s. |
| **Break running or paused** | A stretch and a break suggestion (a long-break line after a cycle), calmer ambient actions every 18–35s, calm tempo. |
| **Session finished** | A hop with the coin fly-up (a double hop for a cycle or the daily goal). The line waits until the coin labels have floated away (2.3–3s) so they never overlap. A finished break gets a stretch and "Break's over". |
| **No input** | Dozes off after 5 minutes idle (3 in a break, never during focus): eyes closed (held blink frame), slow breathing, drifting "z" glyphs. Any input wakes Koa with a stretch and a line; that same touch doesn't also count as a tap. |
| **Item equipped** | Show-off wiggle and a thank-you line (in the shop the toast speaks; the line shows on Home if you return within 3.5s). |
| **Reduced motion** | No movement at all; blinks, eyes closed, bubbles (fade) and static "z" glyphs remain. |

## 5. Accessories (layering approach)

*Implemented in Phase 6. Replaces the original anchor-offset plan.*

Accessories are **separate transparent images stacked on the pose image**. Each accessory frame is exported **on the same 1024×1536 house-grid canvas as its pose, already in position**, so layering is a plain stack of same-sized images with no per-item offsets in code. (This replaced the earlier idea of per-pose anchor data. Placing each item on the canvas during art production is simpler and pixel-exact.)

- **Manifest:** `accessoryArt` in `src/features/koala/manifest.ts`, keyed by shop item id.
  - `overlay` items (hats, glasses, scarf, daisy, headphones) set a `layer` of `front` or `back` and have one frame per pose.
  - `outfit` items (hoodie recolors) replace the pose's base and blink frames.
- **Slots:** each shop item has one slot (`head`, `face`, `neck`, `ear` or `body`), and Koa wears one item per slot.
- **Poses:** an item without a frame for the current pose is simply not drawn in that pose. Pose-specific variants (`<id>@rest`) can be added item by item.
- **Missing art is never substituted.** As of Phase 6, **no accessory artwork exists**. The full list of required files is in `docs/phase-6/accessory-assets.md`.
- **Clothes = hoodie recolors (option A, approved).** Each colorway needs a full pose set: a base and a blink frame per pose.
  - **Deferred decision:** the recolors *could* be made the way the blink frame was, by recoloring only the hoodie region of the approved Master in code. That counts as new character art, so it waits for explicit approval.
  - The rejected options were B (overlays worn over the hoodie) and C (a hoodie-less base koala).

## 6. Animation implementation

All animation runs on the GPU (transform and opacity only) and respects reduced motion.

| Layer | Technique |
|---|---|
| **Breathing** | A 4s CSS loop scaling the koala from 1 to 1.015 on the Y axis, from the feet. It runs in every state except Celebrating. |
| **Blink** | Swap to the `_blink` frame for 140ms at random intervals of 3–7s. This works because frames are pixel-aligned. |
| **Pose changes** | Crossfade two stacked `<img>`s over 300ms with a small scale "settle" (0.98 to 1). Every pose is preloaded with `decode()` so nothing flashes. |
| **Tap squish** | A spring on scale (0.94 to 1.04 to 1). Tap reactions, ambient actions and celebrations are Motion keyframes in `src/features/koala/motions.ts` (transforms only). |
| **Celebration** | A short hop on the Y axis, honey and eucalyptus sparkle particles (about 12 DOM nodes), and a coin fly-up to the coin pill. |
| **Speech bubble** | Pops in with scale and fade, positioned above Koa's head. |
| **Sleep "zZz"** | Three small glyphs drifting upward on a CSS loop. |

**Library:** **Motion** (`motion`, previously Framer Motion) for springs, `AnimatePresence`, and the coin fly-up. Everything else stays in plain CSS. This is the only animation dependency, and it's added in Phase 3 once it's actually used.
