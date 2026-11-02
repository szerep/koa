# Koa — the study koala

Koa is a cozy Pomodoro timer with a koala companion. Focus sessions earn **Coins**, and Coins buy accessories for Koa. The goal is to make studying feel rewarding and calm, like a small indie mobile game rather than another productivity dashboard.

It's built as a web app for **iPhone first** (it also works on iPad and desktop browsers). Installable PWA support and offline use are planned.

> **Status:** early development. Phases 1–6 of 10 are complete. Phase 7 (Koa's personality and interactions) is next and has not started. See [`docs/roadmap.md`](docs/roadmap.md).

## Features

**Pomodoro timer**
- Focus (25 min), short break (5 min) and long break (20 min), with a long break after every 4 focus sessions
- Start, pause, resume, reset and skip. Skipping a started focus session asks for confirmation
- Timestamp-based timing, so the timer stays accurate if the tab is suspended or the phone is locked. It survives page refreshes and catches up when you return to the app
- A circular progress ring around Koa, cycle progress shown as leaves, and the countdown in the browser tab title
- Focus mode: the surrounding interface quietly fades back while you study

**Coins and rewards**
- 1 coin per focus minute, a +30 bonus for finishing a cycle, and a +50 bonus for reaching the daily goal (100 focus minutes per day by default)
- Only completed focus sessions pay. Breaks and skipped sessions don't
- Every payout is recorded once in a ledger, so refreshes, relaunches or two open tabs can never pay a session twice
- A short reward moment: coins fly to your balance and Koa hops

**Shop and wardrobe**
- 9 items across Hats, Glasses, Clothes, Scarves and Extras
- Two-step purchases, protection against buying the same item twice or overspending, and an owned-items inventory
- Equip and unequip items, one per slot (head, face, neck, ear, body)
- The wallet keeps earned and spent coins in separate records. The balance is always calculated from them, and spending never touches earned rewards

**Koa**
- A soft 3D plush koala that breathes, blinks, and squishes when tapped
- Respects `prefers-reduced-motion`
- Everything is saved locally in the browser (LocalStorage). Damaged save data is validated and safely reset

## Current limitations

- **Accessory artwork is not implemented yet.** You can buy and wear items, and your outfit is saved, but Koa can't show accessories until their artwork is made. Shop cards show a color swatch and "Artwork coming soon" instead. Nothing is drawn as a stand-in. The required files are listed in [`docs/phase-6/accessory-assets.md`](docs/phase-6/accessory-assets.md).
- Koa currently has a single pose (sitting idle, plus a blink frame). Study, rest, celebrate and other poses come with a later art pass.
- The current Koa artwork is a **provisional** master with known proportion deviations from the design sheet.
- The Stats and Settings tabs are placeholders. Custom timer durations and an adjustable daily goal are planned for Phase 8.
- There are no system notifications or offline/PWA install yet.
- Data lives only in this browser. There are no accounts or sync.

## Roadmap

| Phase | | Status |
|---|---|---|
| 1 | Product and visual design | ✅ |
| 2 | Character artwork (Koa Master and blink) | ✅ |
| 3 | Design system and home screen | ✅ |
| 4 | Pomodoro timer | ✅ |
| 5 | Coins and rewards | ✅ |
| 6 | Shop and customization | ✅ |
| 7 | Koa's personality and interactions | Next |
| 8 | Statistics and settings (custom durations, daily goal, notifications) | Planned |
| 9 | PWA, offline support, mobile optimization | Planned |
| 10 | Testing and polish | Planned |

## Tech stack

- [React 19](https://react.dev), [TypeScript](https://www.typescriptlang.org) and [Vite](https://vite.dev), with pnpm
- Custom CSS with design tokens (no UI framework)
- [Motion](https://motion.dev) for animation
- [Lucide](https://lucide.dev) for interface icons
- Self-hosted [Fredoka](https://fonts.google.com/specimen/Fredoka) and [Nunito Sans](https://fonts.google.com/specimen/Nunito+Sans) fonts via Fontsource
- [Vitest](https://vitest.dev) for unit tests and ESLint for linting
- Python with Pillow for the character art pipeline scripts

## Getting started

Requirements: **Node.js 24+** and **pnpm**. Python 3 with Pillow is needed only for the art scripts.

```bash
pnpm install
pnpm dev          # start the dev server (http://localhost:5173)
```

| Command | Description |
|---|---|
| `pnpm dev` | Development server with hot reload |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm lint` | ESLint |
| `pnpm build` | Type check and production build into `dist/` |
| `pnpm preview` | Serve the production build locally |

> **TypeScript setup note:** `tsc` runs TypeScript 7 (package alias `@typescript/native`). The `typescript` package is aliased to TypeScript 6 (`@typescript/typescript6`) because typescript-eslint needs the TS 6 API until TS 7.1. This is intentional.

## Project structure

```
src/
  core/        Pure TypeScript business logic (timer engine, wallet and rewards, shop rules), unit tested
  features/    Feature stores and components: timer, rewards, shop, koala (character manifest)
  app/         App shell, screens, feature wiring, tab navigation
  ui/          Design-system primitives (buttons, progress ring, coin pill, navigation)
  storage/     Storage adapter and versioned save format (LocalStorage key "koa:v1")
  config/      Timer defaults, reward values, shop catalog
  styles/      Design tokens and base styles
public/characters/   Exported Koa frames (WebP) and the reference design sheet
art/                 Character art sources: approved Master, candidates, reference crops
scripts/art/         Art pipeline: normalization/export and blink-frame generation
docs/                Design brief, character bible, architecture, roadmap, phase plans
```

**Design principles in the code:**
- Business rules are pure functions that take the current time as a parameter, which makes them easy to test.
- Features communicate through events. For example, a completed session triggers rewards through `src/app/connect.ts`.
- Saved data is validated slice by slice, with a backup for unreadable saves.

More detail is in [`docs/architecture.md`](docs/architecture.md).

## Documentation

- [Design brief](docs/design-brief.md): visual identity, palette, typography, layout
- [Character bible](docs/character-bible.md): who Koa is, appearance rules, asset pipeline, accessory layering
- [Architecture](docs/architecture.md): how the app is put together
- [Roadmap](docs/roadmap.md): phases, status and decision log
- [Accessory artwork needed](docs/phase-6/accessory-assets.md)
- [Settings plan (Phase 8)](docs/phase-8/settings-plan.md)

## License

No license has been chosen yet. All rights reserved by the author until one is added.
