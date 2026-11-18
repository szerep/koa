# Phase 6 — Accessory artwork needed

**Status (2026-11-18):** the shop, inventory and wardrobe are live. **Two items have artwork: the beanie and the round glasses (Phase 11).** The other seven can be bought and worn, and the outfit is saved, but Koa can't display them until their assets are delivered. Nothing is drawn in their place. (At the end of Phase 6 no accessory artwork existed at all.)

**Phase 11 (started 2026-11-09):** the artwork is now being produced, starting with **exactly two items: `beanie` and `round-glasses`**. The others in the table below are not started. The existing integration (`AccessoryArt`, `accessoryFrame()`, `hasAccessoryArt()`, the layering in `Koala.tsx`, the wardrobe and the Shop flow) stays as it is. Decisions: `docs/roadmap.md`, decisions log, 2026-11-09. **Beanie (Step 1):** delivered and approved (2026-11-13, `beanie_v02`): `public/characters/accessories/beanie@idle.webp` and `-512.webp`, registered in `accessoryArt` and precached (the glob and `check-build.mjs` changes below are done: 20 entries), committed as `cc877cd`. Production package, prompt and pipeline: `docs/phase-11/step-1-beanie.md`. **Round glasses (Step 2):** delivered and approved (2026-11-16, `round-glasses_v05`: the Master plus v04's frame, cut with the hollow mode): `public/characters/accessories/round-glasses@idle.webp` and `-512.webp`, registered in `accessoryArt` (front overlay, `bounds` for the Shop picture) and precached (22 entries), committed as `d8a40b4`. Details: `docs/phase-11/step-2-round-glasses.md`.

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
- **Shop thumbnails:** an item with an overlay shows a crop of its own precached idle frame (`AccessoryThumb`, using the entry's `bounds`; built in Phase 11 Step 1), with no separate thumbnail file. Items without art show their color swatch and "Artwork coming soon".
- **Offline (Phase 11 decision, done): accessory frames are precached.** Phase 9's glob `characters/*.webp` matched only the top level of `characters/`, so Phase 11 Step 1 added `characters/accessories/*.webp` to `injectManifest.globPatterns` in `vite.config.ts`. The expected precache list in `scripts/check-build.mjs` (`PRECACHE_FIXED`) now holds the beanie and round-glasses frames: **22 entries, 1025.4 kB** of the 1.2 MB budget (it was 18 entries, 967.8 kB, at Phase 9 Step 9). For each further accessory:
  - add both files (the 1024 and `-512` frames) to `PRECACHE_FIXED` and update its tests (the build check rejects an accessory frame that isn't listed);
  - keep the precache under the 1.2 MB budget and each frame under the character-frame size limit;
  - check offline in a production build (`pnpm build` + `pnpm preview`, fresh context), since there's no worker in `pnpm dev`.

## Later poses
Each future pose (study, rest, celebrate, wave) needs its own `@<pose>` frame per accessory, or the manifest leaves it out and the item is hidden in that pose.
