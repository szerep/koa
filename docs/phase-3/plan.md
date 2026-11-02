# Phase 3 — Design System and Home Screen (plan)

**Status:** ✅ implemented and approved (2026-11-02). Review screenshots are kept locally in `art/review-phase*/` and are not committed.

## Goal

A real, installable-looking Koa shell: the design system in code, the four-tab app frame, and a polished **home screen featuring the real koala** (breathing and blinking). The home screen *looks* finished but has no timer logic yet. Phase 4 plugs the engine into components built here.

## In scope

1. **Starter cleanup.** Remove the Vite demo (`src/App.css`, `src/assets/*`, `public/icons.svg`, the starter `index.css`). In `index.html`: `<title>Koa</title>`, `theme-color`, `viewport-fit=cover`, `apple-mobile-web-app-*` meta.
2. **Dependencies** (all approved in Phase 1):
   - `lucide-react`
   - `@fontsource-variable/fredoka`
   - `@fontsource-variable/nunito-sans`
   - `motion`

   I'll check current versions and APIs with Context7 before using them.
3. **Design tokens** in `src/styles/tokens.css`: palette, type scale, radii, spacing, warm shadows, motion durations and easings, and safe-area helpers. Plus `src/styles/base.css` (reset, fonts, body).
   - **Palette correction from the original sheet** (per the colors rule). The sheet's swatches sample as fur `#ADA6A5`, inner ear `#E5BCB3`, hoodie `#96A07E`, cream `#F1E1CF`, brown `#936F57`. `--euca-500` moves from `#8DA47C` to the sheet's `#96A07E`, and the eucalyptus scale is re-derived around it. Every text/background pair is checked for WCAG AA.
4. **UI primitives** in `src/ui/`, built for real use rather than as a demo:
   - `Button` (primary pill with a pressed "base", secondary, ghost)
   - `IconButton`
   - `Chip` / `SegmentedControl` (Focus · Short break · Long break)
   - `Card`
   - `ProgressRing` (SVG, rounded cap with the leaf end-cap)
   - `CoinPill`
   - `BottomNav` (floating pill on phones, left rail on wide screens)
5. **App shell** in `src/app/`: four screens (Home, Shop, Stats, Settings), switching tabs with a soft transition, mirrored to `location.hash`. Shop, Stats, and Settings get a designed "coming soon" state using the real koala, not empty pages or fake features.
6. **Koala rendering** in `src/features/koala/`:
   - `manifest.ts`: typed entries for the two existing frames, with the house-grid metadata (canvas 1024×1536, ground line 1400, axis 512) and `srcset` for the 512 and 1024 exports.
   - `<KoalaStage>`: the app-drawn soft contact shadow, the pose image, a breathing loop (CSS, scales from the feet), and random blinks every 3–7s (a 140ms frame swap, preloaded with `decode()`). Tapping gives a small squish. Respects `prefers-reduced-motion`.
   - Only the two existing frames are used. No placeholder poses.
7. **Home screen**, static composition per design brief §5:
   - Top bar: wordmark, streak, and coin pill.
   - Mode chips.
   - Room stage with the koala inside the progress-ring halo.
   - Timer numerals at `25:00`.
   - Cycle dots.
   - Controls: Reset · Start · Skip, visual only until Phase 4.
   - Bottom nav.
   - Responsive layouts: iPhone, iPad (side by side), desktop (centered, max about 960px).

## Out of scope

Timer logic, coins and rewards, shop data, persistence, PWA and service worker, new art, speech bubbles, and the koala state machine. These belong to Phases 4–9.

## Folder layout after Phase 3

```
src/
  main.tsx
  app/        App.tsx, screens/{Home,Shop,Stats,Settings}Screen.tsx
  features/
    koala/    manifest.ts, KoalaStage.tsx, koala.css
    timer/    TimerDisplay.tsx, TimerControls.tsx, ModeChips.tsx   (presentational only)
  ui/         Button, IconButton, SegmentedControl, Card, ProgressRing, CoinPill, BottomNav
  styles/     tokens.css, base.css
```

(`src/core/` and `src/storage/` start in Phase 4.)

## Verification

- `pnpm build` and `pnpm lint` are clean.
- Playwright screenshots at **390×844** (iPhone), **820×1180** (iPad), and **1440×900** (desktop). Each is reviewed against the design brief.
- Checks: no horizontal scroll; safe-area padding; nav reachable; blink and breathing visible; reduced-motion mode shows no movement; tab switching works; no console errors.
- Images: the koala uses the 512 export on phones at 1×/2× and the 1024 export on 3× screens; no layout shift while it loads.

## Done when

The home screen on iPhone, iPad, and desktop matches the brief, uses only design tokens, shows the real koala breathing and blinking, and you approve the look.
