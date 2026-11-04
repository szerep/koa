# Koa — the study koala

Koa is a cozy Pomodoro timer with a koala companion. Focus sessions earn **Coins**, and Coins buy accessories for Koa. The goal is to make studying feel rewarding and calm, like a small indie mobile game rather than another productivity dashboard.

It's built as a web app for **iPhone first** (it also works on iPad and desktop browsers). It installs as an app (Add to Home Screen on iPhone and iPad, Install in Chrome and Edge) and works offline after the first visit.

> **Status:** early development. Phases 1–8 of 10 are complete. Phase 9 (PWA and mobile optimization) is in progress: Steps 1–9 of 10 are done (offline service worker, safe updates, app icons, iOS splash screens, install help, notifications through the service worker, export through the share sheet in installed apps, mobile layout and a performance budget). Step 10 is in progress: the local checks are done (Lighthouse mobile: Performance 92, Accessibility 96, Best Practices 100, median of 3; Accessibility 100 after a coin pill fix; the deployment configuration is verified and approved). Koa is deployed at **https://koa-5cl.pages.dev** (Cloudflare Pages). On an Android phone (Samsung Galaxy Note 10+, Chrome), installing, offline use, notification delivery and tap-to-open, and updates have been checked. On a Windows laptop, installing, offline use and updates in browser tabs have been checked. iPhone and iPad are **not tested yet** (no device available), so Phase 9 stays open until Koa is confirmed to install on an iPhone. See [`docs/roadmap.md`](docs/roadmap.md) and [`docs/phase-9/pwa-plan.md`](docs/phase-9/pwa-plan.md).

## Features

**Pomodoro timer**
- Focus (25 min), short break (5 min) and long break (20 min) by default, with a long break after every 4 focus sessions. All four can be changed in Settings
- Start, pause, resume, reset and skip. Skipping a started focus session asks for confirmation
- Timestamp-based timing, so the timer stays accurate if the tab is suspended or the phone is locked. It survives page refreshes and catches up when you return to the app
- A circular progress ring around Koa, cycle progress shown as leaves, and the countdown in the browser tab title
- Focus mode: the surrounding interface quietly fades back while you study

**Coins and rewards**
- 1 coin per focus minute, a bonus of up to 30 for finishing a cycle (the full 30 for 100 focus minutes, less for shorter cycles), and a +50 bonus for reaching the daily goal (100 focus minutes per day by default, adjustable in Settings)
- Only completed focus sessions pay. Breaks and skipped sessions don't
- Every payout is recorded once in a ledger, so refreshes, relaunches or two open tabs can never pay a session twice
- A short reward moment: coins fly to your balance and Koa hops

**Shop and wardrobe**
- 9 items across Hats, Glasses, Clothes, Scarves and Extras
- Two-step purchases, protection against buying the same item twice or overspending, and an owned-items inventory
- Equip and unequip items, one per slot (head, face, neck, ear, body)
- The wallet keeps earned and spent coins in separate records. The balance is always calculated from them, and spending never touches earned rewards

**Koa**
- A soft 3D plush koala that breathes and blinks
- Little idle habits: a sway, a curious tilt, a stretch, a slow blink, and the occasional short comment
- Taps get different reactions (a squish, a wiggle, a bounce). Tap quickly and Koa giggles, then gets startled
- Short speech bubbles for greetings, breaks and finished sessions, plus a hint when you can afford something in the shop
- Calm during focus: no chatter, no wandering, slower breathing
- A gentle hop and a kind word when a session finishes (a bigger one for a full cycle or the daily goal)
- Dozes off when you've been away for a while, and wakes up when you're back
- Respects `prefers-reduced-motion`

**Stats**
- Today's focus minutes against your daily goal, in a ring that echoes the timer
- Focus sessions today, current and best streak (consecutive days with at least one finished focus session), and all-time focus time
- A 7-day bar chart with the goal line, readable by screen readers
- Everything is calculated from your existing reward history, including sessions finished before Stats existed

**Settings**
- Focus (1–120 min, with 15 · 25 · 45 · 50 presets), short break (1–30 min), long break (1–60 min) and long break interval (2–8 sessions). Changes apply from the next session; a running or paused session keeps its length
- Daily goal from 25 to 480 minutes
- **Keep screen on** during focus sessions, using the Screen Wake Lock API. It's held only while a focus session is running and the app is visible, and released on pause, at the end of the session and during breaks. It needs a supporting browser: Safari 16.4 or later on iPhone and iPad (in an installed Home Screen app only from iOS 18.4), and current Chrome and Edge. Elsewhere the switch is disabled with an explanation, and low power modes can refuse the request
- **Session notifications** (off by default) when a session ends while Koa is in the background. Your browser asks for permission only when you turn the switch on, and nothing is shown while you're looking at Koa. A completion noticed more than 5 minutes late (the app was closed or suspended) isn't announced. If notifications are unsupported, blocked or the prompt was dismissed, the row says why
- **Sounds** (off by default): one soft two-note chime when a session ends, synthesized with the Web Audio API (no audio files). Turning it on plays it once as a preview. Browsers only allow audio after a tap, so after a reload the chime is ready once you tap anywhere in Koa; until then completions are silent. Stale completions (more than 5 minutes late) don't chime

**Your data**
- **Export:** downloads everything Koa keeps as a JSON file (`koa-data-YYYY-MM-DD.json`): a small versioned envelope (`format: "koa-export"`, `exportVersion: 1`) around the exact `koa:v1` save, including the full reward history, purchases, outfit, timer and settings. There's no import
- **Reset progress:** a two-step confirmation that lists your own numbers. It deletes coins, purchases, the outfit, stats and streaks, the timer and cycle progress (a session in progress stops without paying). **Settings and the browser's notification permission are kept.** A backup of your data is written to this browser first (`koa:backup:reset`), and if that fails nothing is deleted. Other open tabs drop their session too

**Install and offline** (Phase 9, in progress)
- **Works offline** after the first online visit: the app, fonts and Koa's artwork are cached by a service worker. Your data stays in LocalStorage and is never touched by it
- **Install Koa:** a quiet card in Settings. In Chrome and Edge it has an Install button (the browser's prompt opens only when you tap it); on iPhone and iPad it shows the Share → Add to Home Screen steps; other browsers get their menu command. It's hidden once Koa runs as an installed app. No banners
- **Safe updates:** a new version waits until you tap Update in a small "Koa has an update" card (or Later). It never reloads on its own and never appears during a running focus session
- App icons and iOS splash screens made from the approved Koa artwork, and the app version as a caption in Settings
- Built for the notch and home indicator in portrait and landscape; pinch zoom stays available

Everything is saved locally in the browser (LocalStorage). Damaged save data is validated and safely reset.

## Current limitations

- **Accessory artwork is not implemented yet.** You can buy and wear items, and your outfit is saved, but Koa can't show accessories until their artwork is made. Shop cards show a color swatch and "Artwork coming soon" instead. Nothing is drawn as a stand-in. The required files are listed in [`docs/phase-6/accessory-assets.md`](docs/phase-6/accessory-assets.md).
- Koa currently has a single pose (sitting idle, plus a blink frame). Personality is expressed through gentle movement of that pose and its blink frame; study, rest, celebrate and other poses come with a later art pass.
- The current Koa artwork is a **provisional** master with known proportion deviations from the design sheet.
- **Notifications on iPhone and iPad** work only in the installed Home Screen app (iOS 16.4 or later), and even there nothing arrives while the phone is locked or Koa is in the background, because Koa has no push server. Desktop background tabs can delay a notification or chime by up to about a minute. Notifications go through the service worker; tapping one brings an open Koa window to the front, or opens Koa.
- **Sounds** need a tap after each reload and don't play while the page is suspended. The iPhone silent switch may mute them.
- **Export** uses a regular download in the browser. In an installed app that can share files (for example a Home Screen app on iPhone) it opens the share sheet instead, where you can pick Save to Files; a real iPhone check is in Phase 9 Step 10. A download the browser blocks silently can't be detected. The reset backup lives in the same browser storage, so clearing site data removes it too; export first if you want your own copy.
- **The installed iPhone app keeps its own data**, separate from Safari's, so it may start with 0 coins. There's no import.
- **The first launch needs the network**, on every platform, before Koa works offline. iOS has no install prompt, so installing there is always Share → Add to Home Screen.
- **iOS splash screens** cover current iPhones (portrait) and iPads (portrait and landscape). Other devices show a plain launch screen.
- **Small phones and page zoom:** in a Safari tab on an iPhone SE (with the toolbars showing) Home needs a short scroll before Start; the installed app doesn't. In phone landscape the navigation moves to a rail on the left. Page zoom down to a 320 px wide layout works; a phone at 200% page zoom (about 195 px) scrolls sideways.
- **Not tested yet on iPhone or iPad** (Phase 9 Step 10; no device available): installing, the splash screen, offline use, landscape safe areas around the notch, sharing a file from the installed iPhone app, notifications and updates. On Android the notification's leaf badge and Koa icon aren't verified (a plain bell icon showed during testing), and the system back gesture isn't tested. Lighthouse's simulated mobile LCP is 3.1 s, over the 2.5 s target in the performance budget. The scores themselves pass, and this is an accepted, documented deviation: getting under 2.5 s would need structural changes (see the Phase 9 plan).
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
| 7 | Koa's personality and interactions | ✅ |
| 8 | Statistics and settings (custom durations, daily goal, stats and streaks, keep screen on, notifications, sounds, export and reset) | ✅ |
| 9 | PWA, offline support, mobile optimization (Steps 1–9 of 10 done; Step 10: deployed, Android and Windows checks pass, iPhone and iPad not tested) | In progress |
| 10 | Testing and polish | Planned |

## Tech stack

- [React 19](https://react.dev), [TypeScript](https://www.typescriptlang.org) and [Vite](https://vite.dev), with pnpm
- Custom CSS with design tokens (no UI framework)
- [Motion](https://motion.dev) for animation
- [Lucide](https://lucide.dev) for interface icons
- Self-hosted [Fredoka](https://fonts.google.com/specimen/Fredoka) and [Nunito Sans](https://fonts.google.com/specimen/Nunito+Sans) fonts via Fontsource
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app) and Workbox for the manifest and the offline service worker (build-time only)
- [Vitest](https://vitest.dev) for unit tests and ESLint for linting
- Python with Pillow and NumPy for the art pipeline scripts (icons and splash screens are generated locally and committed)

## Getting started

Requirements: **Node.js 24+** and **pnpm** (12.14.0 is used locally). Python 3 with Pillow and NumPy is needed only for the art scripts.

```bash
pnpm install
pnpm dev          # start the dev server (http://localhost:5173)
```

| Command | Description |
|---|---|
| `pnpm dev` | Development server with hot reload |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm lint` | ESLint |
| `pnpm build` | Type check, production build into `dist/`, then the build check (`scripts/check-build.mjs`) |
| `pnpm preview` | Serve the production build locally (the only way to try the service worker and offline mode) |
| `python -I scripts/art/make_icons.py` | Regenerate the app icons from the Koa Master |
| `python -I scripts/art/make_splash.py` | Regenerate the iOS splash screens (`--links` prints the `index.html` tags) |

The service worker is never active in `pnpm dev`. For an emergency, `KOA_SW_KILL_SWITCH=1 pnpm build` builds a worker that removes itself and Koa's caches (data is kept); see the Phase 9 plan.

> **TypeScript setup note:** `tsc` runs TypeScript 7 (package alias `@typescript/native`). The `typescript` package is aliased to TypeScript 6 (`@typescript/typescript6`) because typescript-eslint needs the TS 6 API until TS 7.1. This is intentional.

## Project structure

```
src/
  core/        Pure TypeScript business logic (timer engine, wallet and rewards, shop rules, settings, stats, export and reset,
               update and install rules), unit tested
  features/    Feature stores and components: timer, rewards, shop, koala (character manifest), settings, stats, wake lock,
               notifications, sounds, data (export and reset), pwa (registration, updates, install help)
  app/         App shell, screens, feature wiring, tab navigation
  ui/          Design-system primitives (buttons, stepper, switch, progress ring, coin pill, navigation)
  storage/     Storage adapter and versioned save format (LocalStorage key "koa:v1")
  config/      Timer defaults, reward values, shop catalog, settings ranges, notification copy, chime
  styles/      Design tokens and base styles
  sw.ts        The service worker (precache and offline navigation)
public/characters/   Exported Koa frames (WebP), the only character art shipped in the app
public/icons/        App icons and the notification badge (generated)
public/splash/       iOS splash screens (generated)
art/                 Character art sources: approved Master, candidates, the reference design sheet (art/reference/, never shipped)
scripts/art/         Art pipeline: normalization/export, blink frame, app icons, splash screens
scripts/check-build.mjs  Post-build check: no reference art, image size limits, the exact offline precache, splash links, the performance budget
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
- [PWA and mobile plan (Phase 9)](docs/phase-9/pwa-plan.md): steps, decisions, deployment to Cloudflare Pages

## Deployment

Koa is hosted on **Cloudflare Pages** (Free plan) at https://koa-5cl.pages.dev, from this GitHub repository (every push to `main` deploys production): production branch `main`, build command `pnpm build`, output directory `dist`, Node 24 and pnpm 12.14.0 pinned, and caching headers that keep `index.html` and `sw.js` fresh. The repository is ready for it: `.node-version`, the `packageManager` field and `public/_headers` are in place and were checked with Cloudflare's local emulator (`wrangler pages dev`). In the Pages project, the `PNPM_VERSION` environment variable is set to `12.14.0`. A self-contained `404.html` gives unknown paths a real 404. Setup steps and rollback are in the Phase 9 plan, section 9. No paid services are needed.

## License

No license has been chosen yet. All rights reserved by the author until one is added.
