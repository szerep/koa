# Phase 6 — Accessory artwork needed

**Status:** the shop, inventory and wardrobe are live. **No accessory artwork exists yet.** Items can be bought and worn, and the outfit is saved, but Koa can't display them until these assets are delivered. Nothing is drawn in their place.

**Phase 11 (started 2026-11-09):** the artwork is now being produced, starting with **exactly two items: `beanie` and `round-glasses`**. The others in the table below are not started. The existing integration (`AccessoryArt`, `accessoryFrame()`, `hasAccessoryArt()`, the layering in `Koala.tsx`, the wardrobe and the Shop flow) stays as it is. Decisions: `docs/roadmap.md`, decisions log, 2026-11-09. **Beanie (Step 1):** delivered and approved (2026-11-13, `beanie_v02`): `public/characters/accessories/beanie@idle.webp` and `-512.webp`, registered in `accessoryArt` and precached (the glob and `check-build.mjs` changes below are done: 20 entries). Production package, prompt and pipeline: `docs/phase-11/step-1-beanie.md`. **Round glasses (Step 2):** delivered and approved (2026-11-16, `round-glasses_v05`: the Master plus v04's frame, cut with the hollow mode): `public/characters/accessories/round-glasses@idle.webp` and `-512.webp`, registered in `accessoryArt` (front overlay, `bounds` for the Shop picture) and precached (22 entries). Details: `docs/phase-11/step-2-round-glasses.md`.

## What to produce (per character bible §3 gates; one asset at a time)

All files go on the **house grid**: a 1024×1536 transparent PNG, already positioned for the pose. Use the approved `art/master/koa_idle_neutral.normalized.png` as the placement base, so each accessory sits exactly on the Master.

| Item id | Name | Kind | Layer | Files for the idle pose |
|---|---|---|---|---|
| `beanie` | Sage beanie | overlay | front | `beanie@idle` |
| `cap` | Sand cap | overlay | front | `cap@idle` |
| `explorer-hat` | Explorer hat | overlay | front | `explorer-hat@idle` |
| `round-glasses` | Round glasses | overlay | front | `round-glasses@idle` |
| `knit-scarf` | Cocoa scarf | overlay | front | `knit-scarf@idle` |
| `headphones` | Cream headphones | overlay | front (+ optional `back` band) | `headphones@idle` |
| `daisy` | Daisy | overlay | front | `daisy@idle` |
| `hoodie-honey` | Honey hoodie | **outfit** | n/a | `hoodie-honey@idle` (base) + `hoodie-honey@idle-blink` |
| `hoodie-blush` | Blush hoodie | **outfit** | n/a | `hoodie-blush@idle` (base) + `hoodie-blush@idle-blink` |

- **Overlays** contain only the accessory (transparent everywhere else), drawn exactly where it sits on the Master. Hats must sit over the crown tuft, and glasses must work over both the open-eye and blink frames.
- **Outfits** are full re-renders of the idle pose with the recolored hoodie, plus a matching blink frame. Everything except the hoodie stays pixel-identical.
  - **Deferred decision:** these *could* be produced the way the blink was, by recoloring only the hoodie region of the approved Master in code. That counts as new character art, so it is **not done until explicitly approved**. Until then the honey and blush hoodies can be bought and worn, but they don't change Koa's look.
- **Exports:** WebP at 1024 and 512 wide in `public/characters/accessories/`, named `<id>@<pose>.webp` and `<id>@<pose>-512.webp` (see `accessoryFrame()` in `src/features/koala/manifest.ts`).
- **Hooking one up:** add an entry to `accessoryArt` in `src/features/koala/manifest.ts`. The koala component, shop preview and home screen pick it up automatically, and the shop's "Artwork coming soon" label disappears for that item.
- **Shop thumbnails:** the cards currently show the item's color swatch. Once overlays exist, a card can show the item cropped from its overlay, with no separate thumbnail file needed. That crop is not built yet.
- **Offline (Phase 11 decision): accessory frames must be precached.** The worker's precache glob in `vite.config.ts` is `characters/*.webp`, which matches only the top level of `characters/`, not the nested `characters/accessories/` folder, so as configured today the accessory frames would load online but be missing offline. When the first assets are added:
  - extend `injectManifest.globPatterns` to cover `characters/accessories/*.webp` (both the 1024 and `-512` files);
  - add each file to the expected precache list in `scripts/check-build.mjs` (today exactly 18 entries, the 4 Koa frames among them) and update its tests;
  - keep the precache under the 1.2 MB budget (967.8 kB at Phase 9 Step 9) and each frame under the character-frame size limit;
  - check offline in a production build (`pnpm build` + `pnpm preview`, fresh context), since there's no worker in `pnpm dev`.

## Later poses
Each future pose (study, rest, celebrate, wave) needs its own `@<pose>` frame per accessory, or the manifest leaves it out and the item is hidden in that pose.
