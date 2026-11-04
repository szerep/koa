# Phase 9 — PWA and mobile optimization plan

**Status:** plan approved (2026-11-03), with the decisions in section 8. **Steps 1–3 approved (2026-11-03; the icons provisionally, their composition may be revisited in a polish pass; Step 3 including the direct `workbox-window` dev dependency). Steps 4–6 approved (2026-11-03); Steps 1–6 are committed together. Steps 7 (notifications through the service worker) and 8 (export through the share sheet) approved 2026-11-04. Step 9 (mobile optimization and the performance budget) approved 2026-11-04 with one open item: the Lighthouse rows are not measured yet and move to Step 10. Steps 7–9 committed together 2026-11-04. Step 10 is in progress (2026-11-04): the local verification is done and reviewed (Lighthouse 92 / 96 / 100; LCP 3.1 s vs the ≤ 2.5 s target, accepted as a documented deviation; the coin pill accessibility fix made and verified; deployment files added; headers verified in Cloudflare's local emulator; the Cloudflare configuration approved). Cloudflare Pages is not connected or deployed yet, and no real-device check has been run.** Each step below is implemented, verified and documented on its own, then waits for explicit approval, like Phase 8.

## 1. Goals and scope

**Goal:** Koa installs on iPhone (and Android and desktop), opens and works fully offline after its first online visit, updates safely, and feels like an app when launched from the Home Screen.

**Done when** (roadmap):
- Koa installs on iPhone.
- Koa works offline.
- "Lighthouse PWA checks pass". Lighthouse 12 (2024) removed the PWA category, so this is replaced by the approved criterion in decision D1: an installable manifest with no DevTools errors, the former PWA audits as a written checklist, and Lighthouse mobile Performance ≥ 90, Accessibility ≥ 95 and Best Practices ≥ 95.

**In scope** (from the roadmap):
- `vite-plugin-pwa`: Web App Manifest and a service worker.
- Apple touch icon and iOS splash screens (startup images).
- Offline caching of the app shell, character artwork and fonts.
- Safe update behavior when a new version is deployed.
- Standalone polish (status bar, safe areas, no browser chrome, install help).
- Mobile optimization and a performance budget.
- Keeping the reference design sheet out of the shipped build.
- Connecting the existing notifier to the service worker (Android Chrome needs this, and clicking a notification should open Koa).
- Exporting data through the Web Share API in installed iOS apps.

### What already exists (no rework needed)

| Area | As built | Phase 9 impact |
|---|---|---|
| `index.html` | `viewport-fit=cover`, `theme-color` `#f9eee1`, `apple-mobile-web-app-capable`, `mobile-web-app-capable`, status bar style `default`, `apple-mobile-web-app-title`, preload of the idle frame | Add manifest link, touch icon, splash links; `theme-color` stays |
| Safe areas | `--safe-*` tokens from `env(safe-area-inset-*)`, used by the app shell, bottom nav and shop toast | Verify in standalone (portrait and landscape); fix only what's wrong |
| Layout | `100dvh`, `overscroll-behavior-y: none`, `touch-action: manipulation` on buttons, stepper input at 2rem (no iOS focus zoom) | Verify; no changes expected |
| Fonts | Fontsource variable fonts, bundled by Vite as hashed `woff2` (8 subsets, about 150 KB) | Precache them |
| Character art | 4 WebP frames in `public/characters/` (about 290 KB together), `srcset` 512/1024 | Precache them |
| Reference sheet | `public/characters/reference/koala-design-sheet.png`, **2.0 MB, currently copied into `dist/`** | Move out of `public/` (Step 1) |
| Notifications | `browserNotificationEnv().show()` already prefers `navigator.serviceWorker.getRegistration()` and falls back to `new Notification` | Add the service worker side (`notificationclick`), use the *active* registration (Step 7, done) |
| Export | `browserDownload` (Blob + `<a download>`), injected into `createProgressData` as `download` | Add a share path for installed apps (Step 8, done) |
| Persistence | One LocalStorage key `koa:v1`, validated slices, `koa:backup`, `koa:backup:reset` | **No change.** The service worker never touches app data |
| Build (2026-11-03) | One JS bundle 460 KB (146 KB gzip), CSS 32 KB (7.3 KB gzip), no dynamic imports, `dist/` 3.0 MB of which 2.0 MB is the reference sheet | Baseline for the budget (Step 9) |

## 2. Platform compatibility overview

These are platform facts as far as they're known today. Every one marked *(verify)* gets checked on a real device in Step 10 and the doc is corrected if it's wrong.

### iPhone and iPad (Safari, iOS/iPadOS 16.4+)

| Topic | Safari tab | Installed Home Screen app |
|---|---|---|
| Install | Only manually: Share → Add to Home Screen. **No install prompt API** (`beforeinstallprompt` doesn't exist). Recent iOS opens Home Screen sites as web apps by default *(verify)* | — |
| Service worker and offline | Yes | Yes |
| **Storage** | Safari's own | **Separate from Safari** *(verify)*. Data from Safari does **not** carry over to the installed app, and the installed app needs one online launch before it works offline |
| Storage eviction | Script-writable storage can be cleared after 7 days without a visit (ITP) | Home Screen apps are exempt from the 7-day rule |
| Notifications | **None** (no Notification API in Safari tabs on iPhone) | iOS 16.4+, page-triggered through the service worker registration. **Nothing while Koa is suspended or the phone is locked**, because Koa has no push server |
| Wake lock | Safari 16.4+ | Only from iOS 18.4 (already documented) |
| Splash screen | — | Only with `apple-touch-startup-image` links, one exact image per device size and orientation. Without them iOS shows a plain screen briefly *(verify)* |
| Icon | — | `apple-touch-icon` (180×180, opaque; transparent pixels turn black) |
| Downloads | `<a download>` saves to Files | `<a download>` is unreliable in standalone mode *(verify)*; the share sheet works with files (`navigator.share({ files })`) |
| Reload / back | Browser UI | **No reload button, no back button, no pull-to-refresh.** Updates need an in-app way to reload |
| Update checks | On navigation | iOS often resumes the app from memory without a navigation, so new versions are found late unless Koa checks for them itself |
| Manifest `orientation`, `shortcuts`, `screenshots` | — | Ignored |

### Android (Chrome)

- **Install:** the browser menu (Install app) or the `beforeinstallprompt` event. Needs HTTPS, a manifest with `name`/`short_name`, 192 and 512 px icons, `start_url` and `display: standalone`. Chrome builds a WebAPK, so Koa appears as a normal app.
- **Notifications:** `new Notification()` **throws** on Android ("Illegal constructor"). Only `ServiceWorkerRegistration.showNotification()` works. This is why notifications fail there today. With a service worker they work while Koa's page can still run. Once Chrome freezes a background page, the timer can't complete in the background and nothing is announced (the existing 5-minute staleness rule then also suppresses it on return).
- A monochrome `badge` icon is used in the status bar; without one Android shows a generic shape.
- No push server, so no notifications while Chrome is fully closed.

### Desktop

- **Chrome and Edge:** installable (address bar icon or menu), offline via the service worker, notifications as today (now through the service worker).
- **Safari 17+ on macOS:** File → Add to Dock creates a web app. Offline and notifications work.
- **Firefox:** the service worker and offline work. Install support is limited or missing depending on the platform; Koa doesn't depend on it.

### Every platform

- **The very first visit must be online.** A browser that has never loaded Koa has nothing cached. Nothing can change that.
- A service worker needs a secure context: HTTPS, or `localhost`. **Testing on a real iPhone needs an HTTPS deployment** (a LAN address like `http://192.168.x.x` won't register a service worker). Koa will be deployed to Cloudflare Pages for that (decision D2, section 9).

## 3. Key technical choices (proposed)

1. **`injectManifest` with a small hand-written `src/sw.ts`**, not `generateSW`. Koa needs a `notificationclick` handler (open or focus Koa), which `generateSW` can't express cleanly. The worker stays tiny: Workbox precaching, one navigation route, `notificationclick`, and a `SKIP_WAITING` message. No runtime caching (Koa makes no network requests besides its own files), no background sync, no push.
2. **Precache everything Koa needs, nothing else:** `index.html`, the JS and CSS bundles, the font files, the 4 character frames, `favicon.svg` and the manifest. **Excluded:** splash images (iOS fetches them itself at install), manifest icons (the OS stores them), anything under `reference/`, source maps.
3. **Hash-based content versioning.** Workbox stores each file with a revision. A deploy changes only the files that changed; `cleanupOutdatedCaches()` removes old precaches and Workbox removes entries that are no longer listed. Cache names get a `koa` prefix (`cacheId`).
4. **Update with a prompt, never automatically** (`registerType: 'prompt'`, decision D3). A new worker installs in the background and waits. Koa shows a small "A new version of Koa is ready" card with an Update button, **never during a running focus session**. If the user ignores it, the new version activates the next time every Koa window is closed. Reloading is safe for the timer (timestamp-based, survives reloads, tested since Phase 4), but it costs the Sounds unlock (needs a tap again) and interrupts the user, so it's their choice.
5. **Koa checks for updates itself** on launch and when it becomes visible again (at most once an hour), so installed iOS apps that resume from memory still find new versions.
6. **No service worker in development.** `devOptions.enabled` stays off, so `pnpm dev` never caches dev files. The worker is tested on `pnpm build && pnpm preview`.
7. **No storage changes.** The service worker can't read LocalStorage and won't use IndexedDB. `koa:v1`, the slices, the backups, Reset progress and Export stay exactly as they are. Reset progress doesn't touch caches (they hold only app files).
8. **The PWA client code follows the existing architecture:** pure rules in `src/core/pwa/`, a framework-agnostic store in `src/features/pwa/` with the browser API injected (`PwaEnv`, mocked in tests), wiring in `connect.ts`, presentation-only components.

## 4. Step-by-step implementation plan

Ten steps. Steps 1–2 need no new dependency. Every step ends with `pnpm test`, `pnpm lint` and `pnpm build` passing, the doc updated, and a stop for approval.

---

### Step 1 — Keep the reference sheet out of the build, and a build check

**Goal:** the shipped build contains only what the app uses, and a script proves it on every build.

**Scope:**
- Move `public/characters/reference/koala-design-sheet.png` to `art/reference/koala-design-sheet.png` with `git mv` (history kept). Nothing in `src/` references it.
- Update the path in `docs/character-bible.md`, `CLAUDE.md` and `MASTER_PROMPT.md` (approved, D13). They cite it as the style reference.
- Add `scripts/check-build.mjs` (plain Node, no dependency), run after `vite build`:
  - fails if `dist/` contains anything under `reference/` or a file named `koala-design-sheet.*`;
  - fails if a character frame in `dist/characters/` is larger than 150 KB (the image budget applies to precached app art only);
  - **app icons and splash screens are checked by their own limits** (D12), which are set in Steps 2 and 5 after the real files exist, so legitimate icons are never rejected by the character-art limit. Until then they're only reported;
  - reports gzip sizes of JS and CSS and the total precache size (later steps), compared with the budget (Step 9 sets the final numbers; Step 1 starts with the forbidden-file checks only);
  - wired as `"build": "tsc -b && vite build && node scripts/check-build.mjs"`. Cloudflare Pages runs the same `pnpm build`, so a deployment with the reference sheet or an oversized bundle fails before it's published.

**Files:** `public/characters/reference/` → `art/reference/`, `scripts/check-build.mjs` (new), `package.json` (script only), `docs/character-bible.md`, `CLAUDE.md`, `MASTER_PROMPT.md`, this plan.

**Dependencies:** none.

**Tests:** the check's pure part (classifying a file list against the rules) in a small `scripts/check-build.test.ts`, or kept trivially simple and checked by running it against a `dist/` containing a planted file. Decide during the step; no new tooling either way.

**Browser checks:** none needed (no UI change); one smoke load at 390×844 to confirm Koa still renders.

**Acceptance:** `dist/` drops from about 3.0 MB to about 1.0 MB; the reference sheet isn't in `dist/`; the build fails if it's put back in `public/`.

**Risks:** the art scripts or docs could point at the old path; grep confirms only docs do (`CLAUDE.md`, `docs/character-bible.md`, `MASTER_PROMPT.md`).

#### As built (2026-11-03, approved)

- The sheet was moved with `git mv` to `art/reference/koala-design-sheet.png` (the empty `public/characters/reference/` folder is gone). Paths updated in `CLAUDE.md`, `MASTER_PROMPT.md` and `docs/character-bible.md`; `README.md`'s project layout updated as well. No art script referenced the old path.
- `scripts/check-build.mjs` (plain Node: `fs`, `path`, `zlib`) walks `dist/` (or a directory given as its argument) and **fails** (exit 1) when:
  - any directory in a file's path is named `reference` (case-insensitive), or a file is named `koala-design-sheet.*`;
  - an image in `dist/characters/` is larger than 150 kB;
  - **any PNG is larger than 300 kB** (added at approval of Step 1 as a general safety net). Steps 2 and 5 set the icon and splash limits from the real files; if a legitimate splash image ever needs more than 300 kB, that limit is revisited there rather than worked around.
  - It reports the file count, total size, gzip sizes of JS and CSS and every image with its size. The JS/CSS budget isn't enforced yet (Step 9). Sizes are decimal kB like Vite's; its gzip figures can differ slightly from Vite's output (146.3 vs 147.7 kB for JS) because of the compression settings, so Step 9 budgets refer to this script's numbers.
- `package.json`: `"build": "tsc -b && vite build && node scripts/check-build.mjs"`.
- **Tests:** the rules are a pure exported function, `checkFiles(files)`, covered by `scripts/check-build.test.ts` (10 tests: current files pass, the sheet in its old place, `reference/` at any depth, the sheet by name in any format, names that merely contain "reference", the 150 kB frame limit at and over the boundary, no frame limit outside `characters/`, the 300 kB PNG limit at and over the boundary, no PNG limit for other types, the image report). The script runs its `main` only when executed directly, so the test imports it without side effects.
- **Planted-file checks:** with a copy of the sheet put back in `public/characters/reference/`, `pnpm build` failed with 3 errors (reference file, frame limit, PNG limit) and exit code 1; the copy was removed. A 350 kB PNG planted in a scratch copy of `dist/` failed with exit code 1. The clean build passes.
- **Results:** `pnpm test` 450 tests in 26 files, `pnpm lint` and `pnpm build` pass. `dist/` is **937 kB in 16 files** (was about 3.0 MB): JS 460.6 kB (146.3 kB gzip), CSS 32.2 kB (7.3 kB gzip), 4 character frames 292 kB in total (largest 111.8 kB), 8 font files. No file under `reference/` and no design sheet in `dist/`.
- **Smoke check** (`pnpm preview`, Chromium, 390×844): Home renders with Koa, both frames load, no horizontal scroll, no console errors or warnings. The old sheet URL now returns the app's HTML fallback, not the image.
- No application code or UI changed; no dependency added.

---

### Step 2 — App icons (from existing approved art)

**Goal:** proper icons for the Home Screen, Android, desktop installs and notifications.

**Scope:**
- A Python script `scripts/art/make_icons.py` (Pillow, like the existing pipeline) composes icons from **existing approved art only** (approved D4: Koa's head and shoulders cropped from the approved Master frame) on the cream background token color. No redrawing, no new generation, no CSS/SVG Koa.
- The generated PNGs are **committed**. The Cloudflare build doesn't run Python.
- Outputs in `public/icons/`:
  - `apple-touch-icon-180.png` (opaque, no rounded corners: iOS rounds them)
  - `icon-192.png`, `icon-512.png` (`purpose: any`)
  - `icon-maskable-512.png` (`purpose: maskable`, artwork inside the central 80% safe zone)
  - `badge-96.png`: a monochrome, transparent notification badge for Android, made from the existing **leaf mark** (already the favicon; approved D4). A Koa silhouette would be a redraw.
- `favicon.svg` stays.
- **Icon size limits (D12):** after generating, record each file's size and set per-file limits for icons in the build check with sensible headroom (soft plush art compresses less well than flat icons). Icons aren't precached, so they don't count toward the precache budget.

**Files:** `scripts/art/make_icons.py` (new), `public/icons/*` (new, generated), `docs/character-bible.md` (icons listed as derived assets), this plan.

**Dependencies:** none (Pillow already used by the art scripts).

**Tests:** the script asserts output sizes, opacity of the touch icon and the maskable safe zone (it measures the artwork's bounding box).

**Checks:** visual review of every icon at 1× and on a mock Home Screen grid (light and dark wallpaper), plus the maskable icon in a circle, squircle and rounded-square mask (screenshots in `art/review-phase9/`, gitignored like earlier reviews).

**Acceptance:** you approve the icons. They're recognizably Koa (or the leaf, per D4), crisp at 180 px, and nothing is clipped by the maskable mask.

**Risks:** at 180 px the Master's known deviations (spiky tuft, large feet) matter less in a head crop, but they're still the provisional Master. Replacing the icons later is a file swap plus a re-run of the script.

#### As built (2026-11-03, approved provisionally)

- **`scripts/art/make_icons.py`** (Pillow + NumPy, like the other art scripts; `python -I scripts/art/make_icons.py`). It only reads existing approved files and never writes to them:
  - `art/master/koa_idle_neutral.normalized.png`: the approved Master on the house grid (the same pixels as the shipped idle frame, already cleaned of stray alpha by `normalize_export.py`). The raw Master PNG has a faint semi-transparent halo, so the normalized frame is the better source. The Master files were hash-checked before and after: unchanged.
  - `src/styles/tokens.css`: the cream is read from `--cream-100` (`#f9eee1`, also `theme-color`), so the token stays the only source of the color.
  - `public/favicon.svg`: the leaf's two paths (body and vein) are parsed and rasterized at 8x supersampling.
- **Crop (app icons, `purpose: any`):** a 700 px square of the house-grid frame, centered on the axis, from y = 530. The tuft has a small top margin and the cut runs across the hoodie, above the feet. Koa's ear span (~800 px) is about his whole sitting height, so a head-and-shoulders crop that kept both ears whole would leave about a third of the icon empty (or turn into a full-body crop). The outer ear rims therefore run slightly off the sides (~50 source px each, under a fifth of an ear). Candidates compared during review: ears whole with the bust (mostly empty top), near full body, and three tighter crops.
- **Maskable:** its own fit. Every artwork pixel above the chin line (source row 950: head, ears, tuft) is inside the central safe circle (radius 40% = 204.8 px) with a small margin. The script searches for the vertical center that needs the smallest radius (measured: 198.7 px). Below the chin, the hoodie and the tops of the paws and feet continue to the bottom edge, so any mask cuts the body, never the head. Pixels outside the frame become cream.
- **Badge:** the favicon's leaf body plus its vein. The vein is a stem drawn mostly *outside* the body, along its inner edge, so in one color the two are joined (round caps), keeping the favicon's silhouette. It's fitted to 84% of the 96 px canvas, white on transparent. Cutting the vein out was tried first and removed almost nothing, because the vein barely overlaps the body.
- **Outputs** (`public/icons/`, committed; lossless 24-bit PNG, `optimize=True`):

  | File | Size | Bytes | Notes |
  |---|---|---|---|
  | `apple-touch-icon-180.png` | 180x180 | 43.8 kB | RGB, no alpha channel, square corners |
  | `icon-192.png` | 192x192 | 49.4 kB | RGB, `purpose: any` |
  | `icon-512.png` | 512x512 | 350.7 kB | RGB, `purpose: any` |
  | `icon-maskable-512.png` | 512x512 | 215.0 kB | RGB, `purpose: maskable` |
  | `badge-96.png` | 96x96 | 2.4 kB | RGBA, white only |

- **Script assertions** (run on the files after reading them back; any failure exits non-zero):
  - all five have the exact dimensions;
  - the touch icon and both `any` icons are mode RGB with no transparency key (iOS turns transparent pixels black);
  - the maskable head lies within the safe radius, and anything outside it is below the icon's center and reaches the bottom edge;
  - the badge has an alpha channel, only white pixels, is mostly transparent, and the leaf isn't too small.

  The script is deterministic: a re-run produces the same files.
- **Size limits (D12)** in `scripts/check-build.mjs`: `ICON_LIMITS`, one limit per file in `dist/icons/` with about 30% headroom (60, 65, 450, 280 and 8 kB).
  - They replace the general 300 kB PNG rule **for `icons/` only**. Nested folders and other folders keep the PNG rule, and a file in `icons/` without an entry fails the build, so every new icon must get a limit.
  - Why `icon-512.png` is over 300 kB: the plush fur compresses poorly. A 256-color palette brought it down to 88–147 kB, but visibly dithered the blush and the nose and eye highlights, and flattened the brown iris, so the icons stay lossless. Icons aren't precached; the 512 is fetched once at install.
  - 3 new tests in `scripts/check-build.test.ts`: the generated sizes pass, every limit at and over its boundary, icons without a limit, and nested or other folders.
- **Visual review** (`art/review-phase9/`, gitignored; made by a throwaway review script, not committed):
  - `step2-actual-size.png`: every icon at 1:1, plus the badge on dark (white) and light (system tint) at 96 px and at Android's 72 px.
  - `step2-home-grid-light.png`, `step2-home-grid-dark.png`: a 4-column iPhone Home Screen at @3x (180 px, iOS-like continuous corners) between plain neighbor tiles, plus 120 px (Spotlight) and 60 px.
  - `step2-maskable-masks.png`: the maskable icon with the safe circle drawn, under circle, squircle and rounded-square masks, the minimum safe zone only, and at 144, 96 and 48 px.
  - Results: Koa is recognizable at every size down to 60 px (the nose, eyes and ears carry it) and crisp at 180 px. No mask clips any part of the head, ears or tuft. The cream reads cleanly on both wallpapers. In the squircle and the rounded square, the tops of the feet show at the bottom corners (part of the same Master frame, cut by the edge).
- `favicon.svg`, the Master files, application code and UI are unchanged, and no dependency was added. The app doesn't reference the icons yet; the manifest and the `apple-touch-icon` link come in Step 3.
- **Results:** `pnpm test` 453 tests in 26 files, `pnpm lint` and `pnpm build` pass, and `check-build` is OK with the 5 icons (21 files in `dist/`).

---

### Step 3 — `vite-plugin-pwa`, manifest and the offline service worker

**Goal:** Koa is installable and works offline after one online visit.

**Scope:**
- **Before installing anything:** confirm the current `vite-plugin-pwa` release supports **Vite 8** (peer dependencies, changelog, Context7) and that its `injectManifest` build works with Vite 8's bundler. The dependencies are approved only on that condition (D5): **if it isn't compatible, stop and report** before writing any worker code. A fallback (hand-written worker and static manifest) would need a new decision.
- `vite.config.ts`: `VitePWA({ strategies: 'injectManifest', srcDir: 'src', filename: 'sw.ts', registerType: 'prompt', injectRegister: false, manifest: {...}, injectManifest: { globPatterns, globIgnores }, devOptions: { enabled: false } })`.
- **Manifest:** `id: "/"`, `name: "Koa"`, `short_name: "Koa"`, description from `index.html`, `start_url: "/"`, `scope: "/"`, `display: "standalone"`, `background_color` and `theme_color` = cream (`#f9eee1`, `--cream-100`), `lang: "en"`, `categories: ["education", "productivity"]`, icons from Step 2. No `orientation` (iPad and desktop use landscape).
- **`src/sw.ts`:** `precacheAndRoute(self.__WB_MANIFEST)`, `cleanupOutdatedCaches()`, a `NavigationRoute` to the precached `index.html` (Koa uses hash tabs, so every navigation is `/`), the `SKIP_WAITING` message handler, and **no** `skipWaiting()`/`clientsClaim()` on install. (`notificationclick` comes in Step 7.)
- **TypeScript:** the worker needs the `webworker` lib, which conflicts with the DOM lib in `tsconfig.app.json`. Add `tsconfig.sw.json` (referenced from `tsconfig.json`, so `tsc -b` checks it) and exclude `src/sw.ts` from the app config. ESLint gets service worker globals for that file.
- **Registration:** `src/features/pwa/` with `PwaEnv` wrapping `virtual:pwa-register` (`registerSW`), registered from `connect.ts` after first render. No UI yet: a new version just waits until all Koa windows are closed.
- `index.html`: the plugin injects the manifest link; add `apple-touch-icon`.
- The build check (Step 1) now also verifies: `sw.js` exists, the precache list contains the 4 character frames, the fonts, the JS and CSS, and contains no splash images, manifest icons or `reference/` files.

**Files:** `package.json`, `pnpm-lock.yaml`, `vite.config.ts`, `src/sw.ts` (new), `tsconfig.json`, `tsconfig.sw.json` (new), `tsconfig.app.json`, `eslint.config.js`, `src/vite-env.d.ts` (virtual module types), `src/features/pwa/*` (new), `src/app/connect.ts`, `index.html`, `scripts/check-build.mjs`, docs.

**Dependencies (dev, decision D5):** `vite-plugin-pwa`, and the Workbox modules the worker imports (`workbox-precaching`, `workbox-routing`, `workbox-core`). They're bundled into `sw.js` at build time; nothing is added to the app bundle except the small registration helper (`workbox-window`, pulled in by the plugin).

**Tests:** `PwaEnv` mocked: registration happens once, failures are caught and never affect the app (status `unsupported`/`failed`), nothing registers in dev or without `serviceWorker` support.

**Browser checks** (Chromium via Playwright on `pnpm preview`, fresh context per check):
- First online load: the worker installs and the precache holds exactly the expected files (inspect `caches`).
- `context.setOffline(true)` and reload at 390×844: Home, Shop, Stats and Settings render with fonts and Koa's frames; no failed requests in the console.
- Offline: start a focus session, complete one in real time (seeded `koa:v1` timer, per `CLAUDE.md`), coins are paid, reload: everything persists. Reset progress and Export work offline.
- DevTools Application → Manifest: no installability errors.
- `pnpm dev`: no service worker registered.

**Acceptance:** installable in Chromium; offline reloads work on all tabs; timer, rewards, sounds and reset behave exactly as before; the build check passes.

**Risks:**
- Vite 8 (Rolldown) compatibility of the plugin's `injectManifest` build. Verified first; fallback in D5.
- TS 7 `tsc -b` with a second project for the worker. Verified in the step.
- A worker that's broken in production is sticky. Mitigation: the documented kill switch in Step 4.

#### As built (2026-11-03, approved)

- **Compatibility, verified before installing:**
  - `vite-plugin-pwa@2.0.0` (latest, 2026-10-03) declares `vite: ^3.1.0 || … || ^8.0.0` as a peer. Vite 8 was added in 1.3.0 (2026-05-05, "Add vite 8 peer dependency support").
  - On Vite 8 (Rolldown), the `injectManifest` worker build works. It prints one deprecation warning, `inlineDynamicImports option is deprecated, please use codeSplitting: false`, because the plugin still sets the Rollup option. Upstream PR #958 (open) tested this on Vite 8.2 / Rolldown 1.2: the output `sw.js` is byte-identical with and without the fix. Koa's worker has no dynamic imports, so the option changes nothing here.
  - Confirmed in practice on Vite 8.3.5 / Rolldown 1.2.16: the worker is built as an ES module, the manifest is injected and `tsc -b` (TS 7) checks the second project. The warning is expected and harmless until the plugin ships #958.
- **Dependencies (dev):**
  - `vite-plugin-pwa` ^2.0.0, `workbox-core`, `workbox-precaching`, `workbox-routing` ^7.4.1 (D5).
  - **Plus `workbox-window` ^7.4.1 as a direct entry.** The plan expected it to come in through the plugin, and it does (it's a plugin dependency, same version). But `virtual:pwa-register` imports it from the project root, and pnpm doesn't expose a dependency's dependencies there, so the app build failed with `Rolldown failed to resolve import "workbox-window"`. Listing it directly is the plugin maintainer's documented fix. It adds no new code beyond what the plan counted.
- **`vite.config.ts`:** `VitePWA` with:
  - `strategies: 'injectManifest'`, `srcDir: 'src'`, `filename: 'sw.ts'`
  - `registerType: 'prompt'`, `injectRegister: false`
  - `includeManifestIcons: false` (manifest icons aren't precached)
  - the manifest exactly as planned (cream comes from a `CREAM` constant commented as `--cream-100`; the config can't read CSS tokens)
  - `injectManifest.globPatterns: ['index.html', 'favicon.svg', 'assets/*.{js,css,woff2}', 'characters/*.webp']`, `globIgnores: ['**/reference/**', 'icons/**', 'splash/**', '**/*.map']`
  - `devOptions: { enabled: false }`

  The plugin adds `manifest.webmanifest` to the precache itself and injects `<link rel="manifest">` into `index.html`.
- **`src/sw.ts`:**
  - `setCacheNameDetails({ prefix: 'koa' })` (the `injectManifest` equivalent of `cacheId`; caches are `koa-precache-v2-<scope>`)
  - `precacheAndRoute(self.__WB_MANIFEST)`, `cleanupOutdatedCaches()`
  - `NavigationRoute(createHandlerBoundToURL('index.html'))`
  - a `message` handler that calls `skipWaiting()` only for `{ type: 'SKIP_WAITING' }`. No `skipWaiting()` or `clientsClaim()` on install, so the very first load isn't controlled; the next load is.

  Built `sw.js`: 16.4 kB (5.5 kB gzip).
- **TypeScript and ESLint:**
  - `tsconfig.sw.json` (lib `ES2023` + `WebWorker`, no DOM, `types: []`) is referenced from `tsconfig.json`, so `tsc -b` checks it. `tsconfig.app.json` excludes `src/sw.ts`.
  - Verified: a planted `document` reference in the worker fails `tsc -b` ("Cannot find name 'document'").
  - `src/vite-env.d.ts` (new) references `vite-plugin-pwa/vanillajs` (only the `virtual:pwa-register` types; `client` would also pull in Vue, Svelte and other framework typings).
  - `eslint.config.js` adds `globals.serviceworker` for `src/sw.ts`.
- **Registration (`src/features/pwa/`):**
  - `registration.ts`: `createPwaRegistration({ env })` with an injected `PwaEnv` (`supported`, `afterLoad`, `register`). Statuses: `unsupported` / `idle` / `waiting` / `registering` / `registered` / `failed`. It registers once, after the page's `load` event (so after the first render). Every throw or reported error becomes `failed` and is never rethrown; listener errors are caught.
  - `browserPwaEnv.ts`: the only file importing `virtual:pwa-register` (kept apart so tests never need the virtual module). `supported` requires `import.meta.env.PROD`, a secure context and `navigator.serviceWorker`, so dev never even tries. Calls `registerSW({ immediate: true, onRegisteredSW, onRegisterError })`.
  - `store.ts`: the app instance `pwa`. `connect.ts` calls `pwa.register()` last. There's no update UI and nothing calls `updateSW`: a new version waits until every Koa window is closed (Step 4 adds the prompt).
- **Bundle:** the plugin's `registerSW` loads `workbox-window` with a dynamic import. That's now a second JS chunk, `assets/workbox-window.prod.es5-*.js` (5.7 kB, 2.2 kB gzip). It's precached, and every tab loads it right after `load`, so it doesn't weaken the Step 4 note about old tabs. The entry bundle is 464.1 kB (149.1 kB gzip by Vite, was 147.7).
- **`index.html`:** `<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png">`.
- **Build check (`scripts/check-build.mjs`):**
  - Fails if `sw.js` is missing or has no injected precache list (`precacheUrls`).
  - `checkPrecache(urls, files)` requires `PRECACHE_FIXED` (`index.html`, `favicon.svg`, `manifest.webmanifest`, the 4 Koa frames) and every `assets/*.{js,css,woff2}` file in `dist/`, with at least one of each type.
  - It rejects (with a reason) anything under `icons/`, `splash/` or `reference/`, source maps, `sw.js` and `_headers`. It also rejects any other unexpected entry, entries not in the build, and duplicates.
  - It reports the precache count and size.
  - 10 new tests (2 for `precacheUrls`, 8 for `checkPrecache`). A planted icon and splash entry, plus a removed frame in a scratch copy of `dist/`, failed with 3 errors and exit code 1.
- **Precache contents (18 entries, 946.9 kB):**
  - `index.html`, `favicon.svg`, `manifest.webmanifest`
  - `assets/index-*.js`, `assets/workbox-window.prod.es5-*.js`, `assets/index-*.css`
  - 8 fonts: Fredoka latin, latin-ext and hebrew; Nunito Sans latin, latin-ext, cyrillic, cyrillic-ext and vietnamese
  - `characters/koa_idle_neutral.webp`, `-512.webp`, `koa_idle_blink.webp` and `-512.webp`

  No icons, splash screens, reference files or source maps. Within the Step 9 budget (≤ 1.2 MB). `dist/` is 24 files, 1626 kB, most of it the icons, which aren't precached.
- **Tests:** 12 for the registration: idle vs unsupported, never registers when unsupported, waits for load, registers immediately if already loaded, once only, `registered` with the registration, a reported error → `failed`, a throwing `registerSW` → `failed`, a throwing load hook → `failed`, no flip back after failure, a throwing listener, unsubscribe.
- **Browser checks** (Chromium via Playwright on `pnpm preview`, a fresh `browser.newContext()` per check):
  - **First online load:** the worker is `activated`, one cache `koa-precache-v2-http://localhost:4173/` with exactly the 18 entries above. Not controlling the first page, as designed.
  - **Offline reload** (`context.setOffline(true)`, 390×844): Home, Shop, Stats and Settings render controlled by the worker, with Fredoka and Nunito Sans loaded and Koa's frames decoded. No horizontal scroll, no console errors or warnings, no failed requests. An offline navigation to `/?from=homescreen` also gets the app.
  - **Offline timer:** tapping Start offline saves a running focus session, which survives an offline reload (24:58 left). A seeded `koa:v1` session ending 3 s after load completed in real time offline: `focus:<id>` paid 25 coins, the pill showed 25, the timer moved to the short break, and all of it survived an offline reload.
  - **Offline Export:** downloaded `koa-data-2026-11-03.json` (`koa-export`, `exportVersion` 1, `storageKey` `koa:v1`), with the offline-earned ledger entry and a setting changed offline (focus 45).
  - **Offline Reset:** the two-step reset wrote `koa:backup:reset`, left `{ version: 1, settings }` with focus 45 kept, and set the pill to 0. Still controlled after an offline reload.
  - **Installability:** DevTools Protocol `Page.getInstallabilityErrors` returns no errors, and `Page.getAppManifest` reports no manifest errors (in Playwright's persistent context; off-the-record contexts only report `in-incognito`). All manifest icons and the touch icon are served as `image/png`. That shared context was unregistered and cleared afterwards.
  - **`pnpm dev`:** no registration, no caches, no manifest link; the app renders. The first dev start after the lockfile change re-optimizes dependencies once (Vite's normal "Outdated Optimize Dep" reload).
- **Interim behavior until Step 7:** the notifier already prefers a service worker registration, so desktop notifications now go through the worker. Until Step 7 adds `notificationclick`, clicking one doesn't focus Koa (it did with `new Notification`). Showing, tags, the 5-minute rule and the permission flow are unchanged.
- **Unchanged:** no LocalStorage or schema change; timer, rewards, shop, Koa, sounds, wake lock, notifications rules, export and reset code untouched; no update UI; no `notificationclick`; icons not regenerated.
- **Results:** `pnpm test` 475 tests in 27 files, `pnpm lint` and `pnpm build` pass (`check-build: OK`, precache 18 entries, 946.9 kB).

---

### Step 4 — Update flow and recovery

**Goal:** deploying a new version is safe: nobody loses a session, nobody runs a half-old app, and a broken release can be undone.

**Scope:**
- Pure rule `src/core/pwa/update.ts`: `shouldOfferUpdate(timer)` returns false while a focus session is **running** (focus is sacred); true otherwise, including paused sessions and breaks (decision D3).
- `src/features/pwa/updateStore.ts`: states `none` / `ready` / `updating`. `onNeedRefresh` → `ready`. `update()` posts `SKIP_WAITING` and reloads once the new worker controls the page.
- `<UpdatePrompt>`: a small card above the bottom nav in Koa's style (Card + Button, tokens only, transform/opacity motion, reduced-motion fade): "A new version of Koa is ready" · **Update** · **Later**. "Later" hides it until the next launch. Hidden while `shouldOfferUpdate` is false; it appears when the focus session ends.
- Update checks: `registration.update()` on launch and on `visibilitychange` to visible, at most once an hour, skipped while offline.
- A visible app version (approved D6): `__APP_VERSION__` (package version + short commit hash, via Vite `define`) as a caption at the bottom of Settings, so it's possible to tell on an iPhone which version is running. On Cloudflare Pages the hash comes from the `CF_PAGES_COMMIT_SHA` build variable; locally from `git rev-parse --short HEAD`; if neither is available the caption shows the package version alone (the build never fails because of it).
- **Kill switch, documented:** if a release ships a broken worker, deploy with `selfDestroying: true` (the plugin's option): the new worker unregisters itself and deletes Koa's caches on the next visit; the app then loads from the network. Never touches LocalStorage.

**Files:** `src/core/pwa/update.ts` (+ test), `src/features/pwa/*`, `src/app/App.tsx`, a new `UpdatePrompt.tsx` + `update-prompt.css`, `src/app/screens/SettingsScreen.tsx` (version caption), `vite.config.ts` (`define`), docs.

**Dependencies:** none new.

**Tests:** `shouldOfferUpdate` for every mode and status; the store: `ready` only after `onNeedRefresh`, `update()` posts once and reloads once, a failing `update()` returns to `ready`, the hourly throttle and the offline skip (injected clock and env).

**Browser checks** (Chromium, `pnpm preview`, two builds with different versions):
- Build A loaded; deploy build B (rebuild + restart preview); return to the tab: the prompt appears; Update reloads into B; the timer, coins and outfit are unchanged.
- With a focus session running when B arrives: no prompt; it appears after the session completes (real-time seeded timer).
- "Later": no prompt until the next launch; closing all tabs and reopening runs B.
- Two tabs on A, update from one: the other tab keeps working, its data stays correct (it may reload; see risks).
- Old precache entries are gone after B activates (inspect `caches`).
- Kill switch: build with `selfDestroying`, load: no worker, no Koa caches, `koa:v1` intact.
- 390×844 and 1440×900 screenshots of the prompt.

**Acceptance:** no automatic reload ever; no prompt during a running focus session; the update applies cleanly with all data kept; old caches are removed; the kill switch works.

**Risks and limitations:**
- When one tab activates the new worker, other open Koa tabs are controlled by it too. Koa has a single JS bundle and no lazy chunks, so an old tab already has everything it needs, but it can't fetch an old asset again (for example a font it hadn't used yet). If the registration helper reloads the other tabs, that's safe for data (state is persisted). Both behaviors are checked and documented.
- **Future schema versions:** a long-lived old tab or installed app reading a save from a *newer* `koa:v` version would back it up to `koa:backup` and start fresh, then could save over it (`loadState` + `saveSlice`). Phase 9 doesn't change the schema, so this isn't triggered now, but PWAs keep old versions alive longer. Recorded as a known risk for any future migration; no storage change in Phase 9 (decision D9).
- On iOS the update is found only when Koa checks (launch or becoming visible), so an installed app can run the old version for one session.

#### As built (2026-11-03, approved)

- **Pure rules (`src/core/pwa/update.ts`):**
  - `shouldOfferUpdate(timer)` is false only for a **running focus session**. It's true for a paused focus session, running or idle breaks and an idle focus session (D3).
  - `isUpdateCheckDue({ lastCheckAt, now, online, intervalMs })`: never offline; otherwise the first check, then at most once per interval. A clock that moved backwards allows a check, so Koa can't get stuck.
  - Tuning in `src/config/pwa.ts`: check interval 1 hour, hand-over timeout 10 s.
- **Update store (`src/features/pwa/updateStore.ts`):** `createUpdateStore({ env })` with an injected `UpdateEnv` (`isOnline`, `check`, `activate`, `reload`). Snapshot: `{ state: 'none' | 'ready' | 'updating', dismissed }`.
  - `ready()` (from `onNeedRefresh`, which can fire more than once): `none` → `ready`.
  - `update()`: only from `ready`. Goes to `updating`, calls `activate()` (with the 10 s timeout), then `reload()` **once**. A failed, throwing or timed-out hand-over returns to `ready` without reloading, and a retry works.
  - `later()`: sets `dismissed`, in memory only, so the prompt is back on the next launch (a reload or a new window). A repeated `ready()` doesn't undo it.
  - `check()` is skipped while offline (not counted), within the hour, while a check is in flight, and while an update is already waiting. Failed checks are caught and count toward the hour.
  - Listener errors are caught, like in the other stores.
- **Registration (`registration.ts`):** `PwaRegisterHandlers` gains `onNeedRefresh`, and the store exposes `onUpdateReady(listener)` (listener errors caught).
- **Browser side (`browserPwaEnv.ts`):**
  - `registerSW` gets `onNeedRefresh` and **`onNeedReload: () => {}`**. Without it, the plugin reloads every page when a new worker takes control, including *other* tabs when one tab updates (it sets that reload up in every tab where the update was announced). D3 forbids automatic reloads.
  - `browserUpdateEnv(getRegistration)`:
    - `check` calls `registration.update()`.
    - `activate` posts `{ type: 'SKIP_WAITING' }` to `registration.waiting`. It resolves on `controllerchange` or when the worker reaches `activated` (a page the old worker never controlled, such as the very first visit, gets no `controllerchange`), and rejects if the worker becomes `redundant`. If **nothing is waiting** (another tab already applied the update), it resolves at once, so Update in that tab is just the reload it needs.
    - `reload` calls `location.reload()`.
- **Wiring (`connect.ts`):** `pwa.onUpdateReady → updates.ready()`. One check once the registration is `registered` (launch), and one on every `visibilitychange` to visible, both through the throttle.
- **`<UpdatePrompt>`** (`src/features/pwa/UpdatePrompt.tsx` + `update-prompt.css`), rendered in `App.tsx` **between the top bar and the screen, in the page flow**:
  - Copy: "Koa has an update" · "Koa reloads to update. Your progress stays." · **Later** (ghost) · **Update** (primary). While updating, the button says "Updating…" and both are disabled.
  - Shown when `state !== 'none'`, not dismissed, and `shouldOfferUpdate(timer)`. It hides as soon as a focus session starts or resumes, and comes back when the session ends or is paused.
  - **Placement changed from the plan** ("above the bottom nav"). A floating card there covered Home's Start/Resume button on 390×844 and 375×667 (measured overlap; Playwright couldn't click Resume). In the page flow it covers nothing.
    - It's one compact row (about 87 px on a phone), so on 390×844 Start still ends above the nav (Start bottom 758, nav top 764). The leaf mark appears from 560 px.
    - The plan's longer title ("A new version of Koa is ready") wrapped to three lines on phones, so it was shortened.
  - Tokens only, with the card surface and shadow. Motion animates opacity and `y`; with reduced motion, `MotionConfig reducedMotion="user"` keeps only the fade.
  - Accessibility: a section labelled by its title, inside an always-present `aria-live="polite"` wrapper. It never takes focus.
  - Screenshots: `art/review-phase9/step4-*.png` (gitignored).
- **App version (D6):**
  - `vite.config.ts` defines `__APP_VERSION__` from `scripts/app-version.ts` (pure, tested) as `"<package version> (<7-character commit>)"`. It prefers `CF_PAGES_COMMIT_SHA`, then `git rev-parse --short HEAD`, then the package version alone.
  - Values that aren't 7–40 hex characters are ignored, and git failures are caught, so the build never fails because of the version.
  - The caption sits at the bottom of Settings: "Koa 0.0.0 (dbd45fb)". `scripts/app-version.ts` is type-checked by `tsconfig.node.json`.
  - A local build of uncommitted changes shows the last commit.
- **Kill switch:** `selfDestroying: process.env.KOA_SW_KILL_SWITCH === '1'` in `vite.config.ts`. The build check handles both modes (`checkWorker`, `isSelfDestroyingWorker`). Procedure: "Kill switch (emergency recovery)" below.
- **Tests:** 48 new (523 in 30 files):
  - `update.test.ts`, 15: every mode × status, throttle boundaries, offline, clock going back.
  - `updateStore.test.ts`, 21: ready only after a report; one hand-over and one reload on a double tap; no reload before the take-over; rejection; synchronous throw; timeout at 5000 ms; retry; reload throwing; Later; throttle; offline not counted; failed check counted; no parallel checks; no check while waiting; listeners.
  - `registration.test.ts` +2, `app-version.test.ts` 5, `check-build.test.ts` +5 (kill switch modes).

**Browser checks** (Chromium via Playwright, a fresh `browser.newContext()` per check):
- Builds: two production builds with different versions, made with `CF_PAGES_COMMIT_SHA` set to `aaaa…` (A, caption "0.0.0 (aaaaaaa)") and `bbbb…` (B), plus a kill-switch build.
- Server: a throwaway static server on `localhost:4180` (scratchpad, not committed). It switches builds on request and sends the section 9 headers, so a "deploy" is instant and the page stays open. `pnpm preview` serves the same files; it was replaced only because each deploy would mean restarting it.

| Check | Result |
|---|---|
| Setup: A loaded and controlled; a 120-min session completed (120 + 50 goal coins), beanie bought and worn; B deployed | — |
| Becoming visible within the hour | No check (no waiting worker, no prompt) |
| An hour later (fake clock), offline | Skipped: no check, no prompt |
| Online again, becoming visible | B found, prompt shown |
| Update | One reload into B. Wallet (ledger, spending, balance 50) and wardrobe identical to before; no waiting worker |
| Launch with B deployed and a paused focus session | The launch check finds B and the prompt shows (paused is allowed). After Update the timer slice is byte-identical (paused, 24:58); caption "Koa 0.0.0 (bbbbbbb)" |
| Running focus session when B arrives | Worker waiting, **no prompt**. The session completed in real time (25 coins), then the prompt appeared |
| Later | Hidden; becoming visible doesn't bring it back; a reload (next launch) shows it again, still on A |
| All windows closed, then reopened | Runs B, no prompt |
| Cache cleanup | After B activates: one cache `koa-precache-v2-…` with 18 entries, only B's `index-*.js` (A's is gone) |
| Prompt layout | 390×844, 375×667, 430×932, 820×1180, 1440×900: no horizontal scroll, Start clickable with the prompt visible, the prompt disappears when Start is tapped |

**Two tabs on A:**
- The timer is shared through the save. With tab 2's focus session paused, tab 1 also showed the prompt. With it running, tab 1 restored it as running and showed **no** prompt either, so "focus is sacred" holds across tabs.
- Tab 2 resumed its focus session (its prompt hid), then tab 1 tapped Update and reloaded into B. **Tab 2 did not reload** (no navigation). It kept running A's code under B's worker, its session kept counting, and Shop, Stats and Home still rendered. No console errors and no failed requests in either tab.
- Tab 2 paused, and its prompt appeared. Update there found nothing waiting and simply reloaded into B; its paused timer was byte-identical.
- Limitation, as expected in the plan: an old tab under the new worker can't fetch an *old* asset it hadn't loaded yet. Between A and B only the entry JS and CSS changed (fonts and frames are identical), so nothing was missing here. Koa loads all its JS up front, so this can only affect a font subset the tab hasn't used yet; the browser then uses the next font in the stack until that tab updates.

**Kill switch:** A loaded and controlled, 25 coins, a running short break. The kill-switch build was deployed and the page reloaded:
- The navigation found the self-destroying `sw.js`. It installed, activated, unregistered itself, deleted the cache and **reloaded the open page once** (`client.navigate`, part of the plugin's fixed worker).
- Afterwards: no registration, no controller, no caches, and the app loaded from the network with Koa's frames. A later visit registers the self-destroying worker again, which unregisters itself at once (the page is uncontrolled, so there are no more reloads).
- `koa:v1` was byte-identical before and after (the running short break, 25 coins).
- Recovery: deploying a normal build (B) again registered a worker and filled the precache (18 entries); the next load was controlled. `koa:v1` was still identical.

**Unchanged:** no LocalStorage or schema change, no notification click handling (Step 7), icons untouched, no splash screens or install help, no new dependency.

**Results:** `pnpm test` 523 tests in 30 files, `pnpm lint` and `pnpm build` pass (`check-build: OK`, precache 18 entries, 951.6 kB). Entry JS 467.5 kB raw, 148.5 kB gzip (Step 3: 464.1 kB raw).

**Known for Step 9 (fixed there):** on 375×667 (iPhone SE), Home's Start button already sits partly under the bottom nav **without** the update card (Start 550–610, nav 587–655, measured before this step). The page scrolls, so it's reachable; it belongs in Step 9's mobile review. The card makes that overlap larger.

#### Kill switch (emergency recovery)

Use this only if a release ships a service worker that breaks Koa (for example, it serves broken files or people can't reach the update prompt).

1. In Cloudflare Pages → Settings → Environment variables (production), add `KOA_SW_KILL_SWITCH` = `1`, then redeploy the last good commit (Deployments → Retry deployment, or push). No code change is needed. Locally: `KOA_SW_KILL_SWITCH=1 pnpm build` (PowerShell: `$env:KOA_SW_KILL_SWITCH='1'; pnpm build`).
2. The build prints `check-build: KILL SWITCH build …` and passes only if `sw.js` is the plugin's self-destroying worker. A normal build fails if it ever produces that worker.
3. On each client's next visit (or update check), the new worker unregisters itself, deletes Koa's caches and reloads open Koa pages once. Koa then runs from the network like a normal website. **LocalStorage (`koa:v1` and the backups) is never touched**, so timer, coins, purchases and settings are kept.
4. While the switch is on, there's no offline support. Once the problem is fixed, remove the variable and deploy normally: the next visit registers the fixed worker again.

That one automatic reload comes from the plugin and is the deliberate exception to D3, for this emergency only. The timestamp-based timer survives it.

---

### Step 5 — iOS splash screens

**Goal:** launching the installed app on iPhone and iPad shows a calm Koa screen instead of a blank one.

**Scope (decision D7):**
- `scripts/art/make_splash.py` composes startup images from **existing approved art**: the idle frame centered on the cream background, roughly 40% of the screen width, no text, no new drawing.
- Portrait images for current iPhone sizes, and portrait + landscape for iPad sizes (iPads often launch in landscape). Each needs its own `<link rel="apple-touch-startup-image" media="(device-width: …) and (device-height: …) and (-webkit-device-pixel-ratio: …) and (orientation: …)">` in `index.html`. The size table lives in the script and the doc.
- Optimized PNGs (or JPEG if smaller and visually identical; iOS accepts both; **JPEG was chosen**, see the implementation details), in `public/splash/`, committed (the Cloudflare build doesn't run Python), and **excluded from the precache** (iOS fetches them at install time). Per-file and total splash size limits are set in the build check once the real files exist (D12).
- No dark variant (Koa has no dark theme).

**Files:** `scripts/art/make_splash.py` (new), `public/splash/*` (new, generated), `index.html`, `scripts/check-build.mjs` (splash images not precached, total splash size reported), docs.

**Dependencies:** none.

**Tests:** the script asserts each output's size against the table and that each has a matching `<link>` in `index.html`.

**Checks:** visual review of a phone and a tablet image; a real-device launch in Step 10. Playwright can't show iOS splash screens.

**Acceptance:** you approve the composition; the build check confirms splash images exist and aren't precached.

**Risks:** Apple adds device sizes every year; an unlisted device shows the plain screen (harmless). iOS caches splash images at install, so a changed splash needs a reinstall. Matching is fragile *(verify on a device)*.

#### Implementation details (Step 5, approved 2026-11-03)

**Composition** (`scripts/art/make_splash.py`, Pillow + NumPy, no new dependency):
- Source: `art/master/koa_idle_neutral.normalized.png` (the approved Master on the house grid, same pixels as the shipped idle frame), read only. The Master and the shipped frames are unchanged.
- Koa's artwork box (ear tip to ear tip, tuft to feet, 814×843 source px) is scaled to **40% of the screen's shorter side** and centered both ways on cream (`--cream-100`, read from `tokens.css`, `#f9eee1`, the same as `theme-color` and the manifest's `background_color`). Using the shorter side keeps Koa the same physical size in iPad portrait and landscape. Scale 0.37× (iPhone SE) to 1.01× (13-inch iPad Pro). No text, no shadow, no dark variant.
- **Format: JPEG**, quality 92, 4:4:4 (no chroma subsampling), baseline. Lossless PNGs were 0.6–0.9 MB per iPad image (about 16 MB in total); JPEG is 4.3 MB in total with PSNR 47.2–48.3 dB against the lossless composition and the cream within 1/255. Reviewed at 1:1: no blocking or halos on the fur edges, blush and highlights intact.
- Names: `public/splash/koa-splash-<w>x<h>.jpg` (pixel size, which is unique per entry). Committed; the Cloudflare build doesn't run Python.
- The script reads every output back and asserts: pixel size, baseline RGB JPEG, edges within 2/255 of cream, PSNR ≥ 44 dB against the lossless composition, Koa centered within 3 px and 36–42% of the shorter side wide. It also asserts that `index.html` has exactly one `<link>` per image with the exact media query, and no other startup links, and it deletes stale files in `public/splash/`. `--links` prints the tags; `--check` checks without regenerating.

**Device table** (in the script; CSS `device-width` × `device-height` are portrait values in both orientations, `orientation` tells them apart):

| Devices | CSS size @ ratio | Images |
|---|---|---|
| iPhone 16 Pro Max, 17 Pro Max | 440×956 @3 | 1320×2868 |
| iPhone Air | 420×912 @3 | 1260×2736 |
| iPhone 16 Pro, 17, 17 Pro | 402×874 @3 | 1206×2622 |
| iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus | 430×932 @3 | 1290×2796 |
| iPhone 14 Pro, 15, 15 Pro, 16 | 393×852 @3 | 1179×2556 |
| iPhone 12 Pro Max, 13 Pro Max, 14 Plus | 428×926 @3 | 1284×2778 |
| iPhone 12, 12 Pro, 13, 13 Pro, 14, 16e | 390×844 @3 | 1170×2532 |
| iPhone X, XS, 11 Pro, 12 mini, 13 mini | 375×812 @3 | 1125×2436 |
| iPhone XS Max, 11 Pro Max | 414×896 @3 | 1242×2688 |
| iPhone XR, 11 | 414×896 @2 | 828×1792 |
| iPhone 8 Plus | 414×736 @3 | 1242×2208 |
| iPhone SE (2nd, 3rd gen), 8 | 375×667 @2 | 750×1334 |
| iPad Pro 13-inch (M4, M5) | 1032×1376 @2 | 2064×2752, 2752×2064 |
| iPad Pro 12.9-inch, iPad Air 13-inch | 1024×1366 @2 | 2048×2732, 2732×2048 |
| iPad Pro 11-inch (M4, M5) | 834×1210 @2 | 1668×2420, 2420×1668 |
| iPad Pro 11-inch (1st–4th gen) | 834×1194 @2 | 1668×2388, 2388×1668 |
| iPad Air 10.5-inch, iPad Pro 10.5-inch | 834×1112 @2 | 1668×2224, 2224×1668 |
| iPad Air (4th gen+), iPad Air 11-inch, iPad (10th gen+) | 820×1180 @2 | 1640×2360, 2360×1640 |
| iPad 10.2-inch (7th–9th gen) | 810×1080 @2 | 1620×2160, 2160×1620 |
| iPad mini (6th gen+) | 744×1133 @2 | 1488×2266, 2266×1488 |
| iPad mini (5th gen), iPad 9.7-inch | 768×1024 @2 | 1536×2048, 2048×1536 |

30 images: 12 iPhone (38.5–121.6 kB, 1.14 MB together) and 18 iPad (135.6–241.8 kB, 3.13 MB together), **4269.2 kB** in total. Not covered: iPhone landscape (Koa's phone layout is portrait), iPhone SE 1st gen and older devices that can't run current iOS; they show the plain launch screen.

**`index.html`:** the 30 `<link rel="apple-touch-startup-image" media="(device-width: …px) and (device-height: …px) and (-webkit-device-pixel-ratio: …) and (orientation: …)" href="/splash/…">` tags, after the touch icon, generated by `make_splash.py --links`. No other change. `dist/index.html` grew by about 6 kB, so the precache total is now 957.9 kB (18 entries, unchanged list).

**Precache:** unchanged. `globPatterns` never matched `splash/`, and `globIgnores` already lists `splash/**`. `checkPrecache` rejects any `splash/` entry, and the new `checkSplash` independently rejects any precached URL that is a linked or built splash image. The built `sw.js` contains no splash URL.

**Build check** (`scripts/check-build.mjs`, `checkSplash` with `imageSize`, `splashLinks`, `parseStartupMedia`; D12 limits set from the real files with about 30% headroom):
- `index.html` exists and has at least one startup link; every link has `href` and `media`, points into `/splash/`, isn't linked twice and has a unique, recognized media query.
- Every linked file is in the build, is a readable JPEG or PNG (size read from the header, no decoding), and its pixel size matches its media query (portrait w×dpr by h×dpr, landscape swapped).
- Every file in `splash/` is linked (no stale images).
- Per-file limits: **160 kB** for an iPhone image (largest 121.6 kB), **320 kB** for an iPad image (shorter side ≥ 1400 px; largest 241.8 kB); **5.5 MB** in total (4269.2 kB). The build output reports `splash 30 startup images, 4269.2 kB (not precached)`.
- 13 new unit tests (41 in `check-build.test.ts`). In a scratch copy of `dist/`, a removed image, a stale extra image and a splash URL planted in the precache failed the build (exit 1); a correctly named JPEG of the wrong size failed with "image is 1170x2532, its media query needs 1179x2556".

**Visual review** (Playwright, `pnpm preview`, fresh contexts with each device's viewport and `deviceScaleFactor`, so each screenshot is the image at exactly its intended pixel size). In `art/review-phase9/` (gitignored):
- `step5-splash-*.png` and `step5-home-*.png`, combined in `step5-pair-*.png`: iPhone 440×956, 390×844 and SE 375×667; iPad 820×1180 portrait, 1180×820 landscape, 1376×1032 landscape, mini 744×1133 portrait. Each image displayed at exactly its natural size.
- `step5-contact-sheet.png`: all 30 images. `step5-actual-pixels.png`: 1:1 crops of the 1320×2868 and 2752×2064 images.
- Result: Koa is centered, whole and unchanged on every image; the cream is seamless with the app's background, so launch → Home reads as Koa settling into place. Koa is deliberately smaller on the splash (about 40% of the width) than on Home (about 60% on iPhone), a calm loading screen rather than a copy of Home's layout.

**Limitations:** Playwright can't show a real iOS launch, so matching and display are checked on a device in Step 10. iOS caches startup images at install, so a changed image needs a reinstall. New Apple devices need a new table row (until then they show the plain screen). On iPad, Split View and Stage Manager windows don't match a full-screen media query and show the plain screen.

**Unchanged:** no app code, UI, behavior, storage, notifications or update flow; no change to the Master or the shipped frames; no new dependency.

---

### Step 6 — Standalone polish and install help

**Goal:** the installed app feels native, and people can find out how to install it.

**Scope:**
- `src/features/pwa/displayMode.ts`: `isStandalone()` (`display-mode: standalone` media query, or `navigator.standalone` on iOS), injected for tests.
- **Install help (decision D8):** an "Install Koa" row in Settings, hidden when already running standalone:
  - Chromium with a captured `beforeinstallprompt`: an **Install** button (calls `prompt()` from the tap).
  - iPhone/iPad Safari: short steps ("Tap Share, then Add to Home Screen"), plus a note that the installed app starts with its own fresh data (see D10).
  - Elsewhere: the row says the browser's menu can install it, or is hidden where install isn't possible.
  - No banners, no nagging, never shown on Home.
- The Notifications row on iPhone Safari already says it needs the Home Screen app; it gains a link to the install row.
- `index.html`: keep `apple-mobile-web-app-capable` (older iOS needs it) and `mobile-web-app-capable`; keep status bar style `default` (content below the status bar, dark text on cream). Verify `theme-color` in standalone.
- **Standalone review**, fixing only what's actually wrong:
  - safe areas in portrait and **landscape** iPhone (notch on the side), the bottom nav above the home indicator;
  - no rubber-band overscroll of the whole app, no text selection on chrome when long-pressing (Koa already blocks it), no callout on long-pressing Koa's image (`-webkit-touch-callout: none` on the frame only);
  - the hash tabs work without a back button (they already do; check the system back gesture on Android);
  - links, if any, open outside the app.
- **Pinch zoom stays allowed** (accessibility).

**Files:** `src/features/pwa/*`, `src/app/screens/SettingsScreen.tsx` (+ a small `InstallCard.tsx` if it doesn't fit an existing card), `index.html`, possibly `src/features/koala/koala.css` and `src/app/app.css`, docs.

**Dependencies:** none.

**Tests:** `isStandalone` and the install-help state (`prompt-available` / `ios-steps` / `menu` / `installed` / `hidden`) for each env; `prompt()` only from a tap, and the captured event is used once.

**Browser checks:** Playwright at 390×844, 844×390 (iPhone landscape), 820×1180, 1440×900, with `display-mode: standalone` emulated where possible; Chromium's install prompt via the row. Real devices in Step 10.

**Acceptance:** nothing clipped by notch or home indicator in either orientation; the install row is right on each platform and gone when installed.

**Risks:** `beforeinstallprompt` is Chromium-only and its timing isn't guaranteed; iOS has no programmatic install. The row must make sense without it.

#### Implementation details (Step 6, approved 2026-11-03)

**Code:**
- `src/core/pwa/install.ts` (pure): `installHelp(input)` returns `installed` (running standalone; the card is hidden), `accepted` (installed from this tab; "Koa is installed"), `prompt-available` (an unused `beforeinstallprompt` is held; Install button), `ios-steps`, `menu` or `hidden`. `detectInstallBrowser` maps the user agent, touch points and `'onbeforeinstallprompt' in window` to `apple-mobile` (any browser on iPhone/iPad, including iPad desktop mode), `safari-mac`, `chromium-desktop`, `chromium-android`, `firefox-android` or `other` (`hidden`, e.g. Firefox on desktop). `supported` is the service worker's own condition (production build, secure context), so `pnpm dev` shows no card. Standalone always wins, even over `supported`.
- `src/features/pwa/displayMode.ts`: `isStandalone(env)` is true for `display-mode` `standalone`, `fullscreen` or `window-controls-overlay`, or iOS `navigator.standalone`. `DisplayModeEnv` is injected; a throwing `matchMedia` counts as a browser tab.
- `src/features/pwa/installStore.ts`: `createInstallStore({ env })` with an injected `InstallEnv` (`supported`, `browser`, `isStandalone`, and listeners for `beforeinstallprompt`, `appinstalled` and display-mode changes). The real env calls `preventDefault()` on `beforeinstallprompt`, so Chromium shows no mini-infobar (D8: no banners). `install()` is called only from the Install button's tap; it drops the captured event **before** calling `prompt()`, so the event is used once whatever happens. A second tap, or a tap without an event, does nothing. Dismissed or a failed `prompt()` falls back to the menu wording; accepted (or `appinstalled`, e.g. from the address bar) shows "Koa is installed". A later new event shows the button again. While the prompt is open the button stays, disabled.
- `src/features/pwa/store.ts` creates the `install` singleton; `connect.ts` calls `install.start()` before render, because the event can fire early. Nothing is shown or prompted on launch.
- `src/app/screens/InstallCard.tsx`: an "Install Koa" card between "While you focus" and "Your data", never on Home. Copy:
  - iPhone/iPad: "Add Koa to your Home Screen", steps "Tap Share in the toolbar (on iOS 26, tap ••• first)" and "Choose Add to Home Screen, then Add", then "Koa then opens full screen and works offline. The Home Screen app keeps its own coins and progress, separate from Safari's, so it may start fresh." (D10).
  - Chromium with a prompt: "Koa opens in its own window and works offline." and an Install button.
  - Menu: the same sentence plus the browser's own command (address bar install icon or menu on desktop Chromium, "Add to Home screen or Install app" on Android, Firefox's menu on Android, File → Add to Dock in Safari on macOS Sonoma or later).
- Notifications row: when notifications are unsupported on iPhone/iPad and the install steps are showing, the existing explanation gains a "How to add Koa" text button. It scrolls the install card into view (instantly with reduced motion) and moves focus to its heading. It doesn't change the hash, and notification behavior is unchanged.

**Standalone review fixes (only what was actually wrong):**
- `src/ui/bottom-nav.css`: the tabs are `<a href="#/…">` links, so a long press on iOS would open a link preview and select the label. `-webkit-touch-callout: none` and `user-select: none` on `.nav__item`.
- `src/features/koala/koala.css`: `-webkit-touch-callout: none` on `.koala__figure` (the frame only). The images already had `pointer-events: none` and `-webkit-user-drag: none`.

**Checked and unchanged:**
- `index.html` keeps `apple-mobile-web-app-capable`, `mobile-web-app-capable`, status bar style `default` and `theme-color` `#f9eee1`. The viewport has no `maximum-scale` or `user-scalable`, so **pinch zoom stays allowed**.
- `body` already has `overscroll-behavior-y: none`. Koa has **no external links** (the only links are the hash tabs), so nothing needs to open outside the app.
- Hash navigation: Home → Shop → Stats → Settings, then three back steps (`history.back`, what Android's back gesture does) went Stats → Shop → Home, with the right tab marked each time, at every size.

**Browser checks** (Playwright, `pnpm preview`, fresh contexts; screenshots in `art/review-phase9/step6-*`):
- Safe areas simulated by overriding the `--safe-*` tokens with device insets: 390×844 (47 top, 34 bottom), 844×390 (47 left and right, 21 bottom), 375×667 (20 top), 820×1180 (24 top, 20 bottom), 1440×900 (none). On all four tabs at each size: the top bar and nav stay outside the insets, no button, link, switch or heading starts inside them, and there's no horizontal scroll.
- Standalone: iPhone contexts with `navigator.standalone`, iPad and desktop with `(display-mode: standalone)` mocked through `matchMedia`, because Chromium's CDP can't emulate `display-mode`. The install card is hidden in every standalone run and shown in the browser.
- Install row: desktop Chromium shows the menu wording until a `beforeinstallprompt` arrives. A dispatched event was `defaultPrevented` and `prompt()` wasn't called until the tap. Install opened it once; dismissed → menu wording; a new event plus accept → "Koa is installed". iPhone user agent without the Notification API (like iOS Safari): the steps, and "How to add Koa" focuses the card heading with the hash still `#/settings`.
- **Not fixed here (fixed in Step 9, see there):** on 375×667, Start sits partly under the nav (known since Step 4). In 844×390 landscape, Home is tall and the floating nav covers part of Koa until you scroll. Start is reachable and tappable when scrolled, and nothing sits under the notch or home indicator.

**Tests:** 28 new (`install.test.ts` 12, `displayMode.test.ts` 4, `installStore.test.ts` 12): every install state per platform, browser detection from real user agents, every standalone display mode, the prompt never called without a tap, used once, a second tap ignored, dismissal, a stale event, `appinstalled`, becoming standalone, unsupported envs and a broken listener. `pnpm test` 564 tests in 33 files; lint and build pass.

**Unchanged:** notification delivery, timer, rewards, storage and the save schema; icons and splash images; no new dependency.

**Limitations:** a real iOS long press, the status bar, `navigator.standalone` and the Android back gesture are verified on devices in Step 10. Chromium's `beforeinstallprompt` timing isn't guaranteed, so the card can show the menu wording first and switch to the button later. In-app browsers (for example Instagram's) usually can't install; on iPhone they still get the Share steps.

---

### Step 7 — Notifications through the service worker

**Goal:** session notifications work on Android Chrome and in installed apps, and tapping one opens Koa.

**Scope:**
- `browserNotificationEnv().show()`: use the **active** registration (`navigator.serviceWorker.ready`, with a short timeout) instead of `getRegistration()`, which can return a registration whose worker isn't active yet. Fall back to `new Notification` only where the constructor is allowed (desktop), never on Android.
- Notification options: `icon` (`/icons/icon-192.png`), `badge` (`/icons/badge-96.png`, Android), `tag` = session id (unchanged), `lang: 'en'`, and `data: { url: '/' }`.
- `src/sw.ts`: `notificationclick` closes the notification and focuses an existing Koa window, or opens `/` if there isn't one. The choice of window is a pure function (`pickClient`) with tests.
- Copy: the iPhone explanation is unchanged (installed app only, nothing while suspended). Android: nothing new to say.
- **Unchanged:** permission only from the Settings tap, off by default, quiet while looking, 5-minute staleness, one notification per session id, every failure caught.

**Files:** `src/features/notifications/notifications.ts` (+ tests), `src/sw.ts`, a pure helper for `pickClient` (+ test), `src/config/notifications.ts` (icon paths), docs.

**Dependencies:** Step 3 (worker), Step 2 (icons).

**Tests:** `show()` uses `ready` when available, times out cleanly, falls back only where allowed, rejects (→ status `failed`) when nothing works; `pickClient` prefers a focused Koa window, then any Koa window, then `null` (open new).

**Browser checks:** Chromium on `pnpm preview` with permission granted: a real-time completion while the window is unfocused shows exactly one notification **through the worker** (`registration.getNotifications()`), with icon and tag; clicking it focuses Koa. Two tabs: still one notification. Android Chrome on a device in Step 10 (the main reason for this step).

**Acceptance:** the notifier never uses the constructor when a worker is active; Android shows the notification; clicking opens Koa; all Phase 8 notification tests still pass.

**Risks and limitations (no new promises):**
- Still no push: nothing arrives while the page is frozen or closed, on any platform. iPhone: nothing while suspended or locked.
- Android may freeze a backgrounded Chrome page within minutes; then the completion is noticed only on return and, if more than 5 minutes late, isn't announced (approved behavior).

#### Implementation details (Step 7, approved 2026-11-04)

- **Delivery** (`src/features/notifications/showNotification.ts`, injected deps, used by `browserNotificationEnv().show()`):
  1. `navigator.serviceWorker.getRegistration()`: if there is no registration (`pnpm dev`, or registration failed), Koa doesn't wait, because `ready` would never settle.
  2. Otherwise it waits for `navigator.serviceWorker.ready` (the **active** registration), up to `notificationWorkerTimeoutMs` (3 s, `src/config/notifications.ts`), then calls `registration.showNotification`. The timeout is always cleared.
  3. Without an active worker, `new Notification` is used **only on desktop**. It's never used on Android (Chrome throws "Illegal constructor") or iPhone/iPad (the API exists only in the Home Screen app, which always has the worker). There the promise rejects and the notifier reports `failed`, as before.
  4. A registration that refuses to show rejects too; there's no constructor fallback once a worker is active.
- **Options** (`notificationOptions`): `body`, `tag` = session id (unchanged), `lang: 'en'`, `icon: '/icons/icon-192.png'`, `badge: '/icons/badge-96.png'` (the leaf mark, Android status bar) and `data: { url: '/' }`. The paths are in `notificationAssets` (`src/config/notifications.ts`). The icons aren't precached, so offline the browser may show the notification without them.
- **Click** (`src/sw.ts` + `src/core/pwa/notificationClick.ts`): `notificationclick` closes the notification, then inside `event.waitUntil` runs `focusOrOpenKoa(self.clients, self.registration.scope, data)`:
  - `clients.matchAll({ type: 'window', includeUncontrolled: true })`, so a tab the worker doesn't control yet (first visit, just after an update) still counts.
  - `pickClient`: only Koa windows (same origin, inside the scope, any hash tab); a focused one first, then the first in the browser's order (most recently focused). Other sites are never picked.
  - **Koa already open:** that window is focused. No navigation and no reload, so the timer, the tab and anything on screen stay as they are. With two Koa tabs only one is focused; nothing is opened.
  - **Koa not open:** `clients.openWindow` opens `notificationTargetUrl(data)`: `data.url` resolved against the scope if it stays inside it, else the scope (`/`). A notification can never open another site.
  - If focusing is refused, Koa is opened instead, so a tap never does nothing.
  - The helper uses only structural types, so it compiles in both the app and the worker tsconfig.
- **Unchanged:** permission only from the Settings tap, off by default, quiet while looking, the 5-minute rule, one notification per session id (tag), every failure caught, the Settings copy (iPhone: installed app only, nothing while suspended; Android: nothing new). No timer, rewards, storage or schema change; no new dependency. The kill-switch worker (`selfDestroying`) has no click handler, as before.

**Browser checks** (Playwright Chromium, `pnpm preview`, fresh contexts, 390x844, notification permission granted, `document.hasFocus` mocked to false):
- A seeded focus session completing in real time, with two Koa tabs open (both controlled): exactly **one** notification in `registration.getNotifications()`, title "Focus session done", tag = the session id, icon `/icons/icon-192.png`, badge `/icons/badge-96.png`, `data` `{ url: '/' }`, `lang` `en`. The wrapped `Notification` constructor was called **0** times in both tabs. The timer moved on to the short break as before.
- In the worker (`serviceWorker.evaluate`): `clients.matchAll` lists both Koa tabs (`#/shop`, `#/settings`). A synthetic `notificationclick` ran the handler and closed the notification, and no extra window appeared.
- **Not verifiable here:** a real tap. Playwright can't click a system notification, and `focus()`/`openWindow()` are only allowed for a genuine tap, so the focus and open paths are covered by unit tests and wait for the Android Chrome device check in Step 10.

**Tests:** 25 new (`notificationClick.test.ts` 12: Koa-window matching, `pickClient` order and foreign windows, target URL validation, focus vs open, two tabs, focus refused; `showNotification.test.ts` 13: options, `ready` used, waiting for an activating worker, a clean timeout, the constructor only where allowed, no wait without a registration, failing `getRegistration`, a refusing registration, a throwing constructor, and `failed` then `granted` through the real notifier). The existing Phase 8 notification tests are unchanged and pass. `pnpm test` 589 tests in 35 files; lint and build pass (precache still 18 entries; entry JS 159.3 kB gzip, +0.5 kB over Step 6, still under the 160 kB budget of Step 9).

**Limitations:** no push, so nothing while the page is frozen or closed (Android may freeze a background tab within minutes; a completion noticed more than 5 minutes late isn't announced). A real Android device check is in Step 10. If the worker is still installing on a page's very first visit, a notification can wait up to 3 s.


---

### Step 8 — Export through the share sheet in installed apps

**Goal:** Export works in an installed iOS app, where a download link is unreliable.

**Scope (decision D11):**
- Inject a `share` function next to `download` in `createProgressData`. The rule `exportMethod({ standalone, canShareFiles })`: use the share sheet when running standalone **and** `navigator.canShare({ files: [file] })` is true; otherwise the existing download.
- `navigator.share({ files: [new File([text], fileName, { type: 'application/json' })], title: 'Koa data' })` called directly from the Export tap (share requires a user gesture; the file is built synchronously, as today).
- The user cancelling the sheet (`AbortError`) isn't an error: the status goes back to idle, no failure message. Other errors fall back to the download, then to the existing failure message.
- Filename, envelope and content are unchanged. No import.

**Files:** `src/features/data/progressData.ts` (+ tests), `src/features/data/store.ts`, a small pure `exportMethod` (+ test), `DataCard.tsx` copy if the button label should say "Share" in that mode (decision during the step; default: keep "Export"), docs.

**Dependencies:** Step 6 (`isStandalone`).

**Tests:** method selection for every env; share success, cancel and failure; the fallback to download; the export text is identical in both paths.

**Browser checks:** Chromium (download path unchanged, real download as in Phase 8); share path with a mocked `navigator.share` in Playwright. Real iPhone in Step 10: the share sheet offers Save to Files and the saved JSON is complete.

**Acceptance:** downloads behave exactly as in Phase 8 everywhere except standalone apps with file sharing, which use the sheet; cancelling is quiet.

**Risks:** file sharing support varies (iOS 15+, Android Chrome; desktop Safari supports it, desktop Chrome partly). The rule only uses it in standalone mode to keep desktop behavior unchanged.

#### Implementation details (Step 8, approved 2026-11-04)

- **Rule** (`src/core/data/exportMethod.ts`, pure): `exportMethod({ standalone, canShareFiles })` is `'share'` only when both are true, else `'download'`. `isShareCancelled(error)` is true only for a rejection named `AbortError`.
- **Injected capability** (`FileShare` in `progressData.ts`: `isStandalone()`, `canShare(data)`, `share(data)`), passed to `createProgressData` as the optional `share` next to `download`. Without it, Export always downloads. The browser version (`browserFileShare`, wired in `features/data/store.ts`) uses `isStandalone(browserDisplayModeEnv())` from Step 6; its `canShare` is false when `navigator.share` or `navigator.canShare` is missing.
- **Export tap** (`exportData()`), in order, all synchronous up to `share()`:
  1. Build the export text exactly as in Phase 8 (same envelope, same `koa-data-YYYY-MM-DD.json` name). If it can't be built: `failed`, as before.
  2. Build `new File([text], fileName, { type: 'application/json' })` and `ShareData = { files: [file], title: 'Koa data' }`.
  3. Check `isStandalone()` and `canShare(data)` for **that exact data**, at tap time. A check that throws counts as "no".
  4. `download`: the Phase 8 download, unchanged (returns `true`/`false` synchronously, status `exported`/`failed`).
  5. `share`: `navigator.share(data)` is called right away (no await before it, so the tap's user activation still counts). Status `sharing` ("Choose where to save or send ..."); further Export taps are ignored until the sheet closes, because a second `share()` would reject.
- **Outcomes** (the returned promise resolves, never rejects):
  - Shared: status `shared` ("Done. ... is on its way.").
  - `AbortError` (the user closed the sheet): back to `idle`, no message, no download.
  - Any other rejection, or `share()` throwing synchronously: the Phase 8 download as a fallback, then its existing failure message if that fails too. In an installed iOS app this fallback may itself not save anything (the reason for this step); it's a best effort.
  - A sheet that closes after the user left Settings (`dismiss()`) sets no message.
- **Copy:** the button stays "Export" (the plan's default) and the idle hint is unchanged. Two new hint lines for `sharing` and `shared` in `DataCard.tsx`.
- **Unchanged:** the export envelope, filename and content; the download path everywhere outside installed apps (desktop and mobile browser tabs, even where file sharing works); reset, storage and the save schema; timer, rewards, notifications and the service worker. No new dependency.

**Browser checks** (Playwright Chromium, `pnpm preview`, fresh contexts, 390x844):
- Browser tab with a mocked `navigator.share`/`canShare` that would succeed: a real download `koa-data-2026-11-04.json` (`format: "koa-export"`, `data` with `version`, `timer`, `wallet`, `wardrobe`, `settings`), `share()` called 0 times, the Phase 8 message.
- Installed iPhone app (`navigator.standalone = true`) with a mocked Web Share API: the mock received one file `koa-data-2026-11-04.json`, `application/json`, title "Koa data", valid export JSON, with `navigator.userActivation.isActive` true inside `share()`; no download. The hint showed "Choose where to save or send ..." while the sheet was open, then:
  - success: "Done. ... is on its way.";
  - `AbortError`: back to the idle hint, no download;
  - `DataError`: one fallback download and the download message;
  - `canShare` false: a direct download, `share()` not called.
- **Not verifiable here:** a real share sheet. The iPhone check (the sheet offers Save to Files and the saved JSON is complete) is in Step 10.

**Tests:** 21 new (`exportMethod.test.ts` 5: the rule for every env, cancel vs real errors; `progressData.share.test.ts` 16: the sheet used in a sharing installed app, the file's name, MIME type and text identical to the download, `canShare` asked about the exact file shared, `share()` called synchronously in the tap, nothing shared or downloaded without a tap, a second tap ignored while open, download in an installed app without file sharing, in a browser tab, without the capability and when the checks throw, cancel quiet, real failures and a throwing `share()` falling back to the download, both failing gives `failed`, no message after leaving the screen, the save never changed). The Phase 8 export and reset tests are unchanged and pass. `pnpm test` 610 tests in 37 files; lint and build pass (precache still 18 entries; entry JS 159.6 kB gzip, +0.3 kB over Step 7, still under the 160 kB budget of Step 9 but with little room left).

**Limitations:** installed desktop apps (Chrome/Edge) that support file sharing also get the sheet, since the rule is "standalone and can share", not iOS only; that matches D11. The fallback download after a failed share runs after the tap's gesture, so a browser may block it (the failure message then shows only if the download throws). A download blocked silently still can't be detected (as in Phase 8). Real devices in Step 10.

---

### Step 9 — Mobile optimization and the performance budget

**Goal:** Koa is fast on a mid-range phone and stays that way.

**Proposed budget** (decision D12; baseline 2026-11-03 in brackets):

| Metric | Budget | Baseline |
|---|---|---|
| Entry JS, gzip | ≤ 160 KB | 146 KB |
| CSS, gzip | ≤ 12 KB | 7.3 KB |
| Precache total (raw) | ≤ 1.2 MB | ~0.95 MB expected |
| Any character frame in `dist/characters/` | ≤ 150 KB | 112 KB |
| App icons and splash screens | own per-file limits, set in Steps 2 and 5 from the real files (not precached): icons per file (`ICON_LIMITS`); splash 160 kB per iPhone image, 320 kB per iPad image, 5.5 MB in total | — |
| Reference sheet in `dist/` | never | 2.0 MB today |
| Lighthouse mobile (preview build): Performance | ≥ 90 | not measured (Step 10) |
| Lighthouse: Accessibility, Best Practices | ≥ 95 | not measured (Step 10) |
| LCP / CLS (Lighthouse mobile) | ≤ 2.5 s / ≤ 0.05 | not measured by Lighthouse (Step 10); Playwright approximation in Step 9 |

**Scope:**
- `scripts/check-build.mjs` enforces the size rows (fails the build).
- Measure with Lighthouse (run with `npx lighthouse` against `pnpm preview`; not added as a dependency), mobile preset. Record the numbers here.
- Fix only what the measurements show. Candidates, in order of likely value: `fetchpriority="high"` on the first Koa frame (the preload exists), `decoding="async"` on non-critical images, Motion's smaller `LazyMotion`/`m` API if JS is over budget, avoiding layout shift when fonts load.
- Mobile review: iPhone SE (375×667), 390×844, 430×932, landscape 844×390, iPad 820×1180, desktop 1440×900; larger text (iOS Dynamic Type has no effect on web pages, but browser zoom 200% must not break layouts); 44 px tap targets; the Settings number input doesn't zoom on focus (already 2rem).

**Files:** `scripts/check-build.mjs`, `index.html`, possibly component files for measured fixes, docs.

**Dependencies:** Steps 1–8 (measure the final build).

**Tests:** existing tests unchanged; budget check output recorded.

**Acceptance:** every budget row met, or a deviation explained and approved.

**Risks:** Lighthouse scores vary between runs and machines (Windows, simulated throttling); take the median of 3 runs.

#### Implementation details (Step 9, approved 2026-11-04; Lighthouse outstanding)

**Budget results** (`pnpm build`, this script's zlib gzip figures):

| Metric | Budget | Result | Enforced by |
|---|---|---|---|
| Entry JS, gzip | ≤ 160 kB | **151.2 kB** | `checkBudget` (new) |
| CSS, gzip | ≤ 12 kB | **7.8 kB** | `checkBudget` (new) |
| Precache total (raw) | ≤ 1.2 MB | **967.8 kB**, 18 entries | `checkBudget` (new); the exact list as before |
| Character frame | ≤ 150 kB | largest 111.8 kB | `checkFiles` (Step 1) |
| Icons / splash | own limits | unchanged, all within | `checkFiles` / `checkSplash` (Steps 2, 5) |
| Reference sheet in `dist/` | never | none | `checkFiles` (Step 1) |
| LCP / CLS | ≤ 2.5 s / ≤ 0.05 | Step 9: ~2.09 s / 0.0002 (Playwright approximation). **Lighthouse (Step 10): LCP 3.1 s ✗ (target not met; accepted deviation 2026-11-04) / CLS 0.0002 ✓** (median of 3; rationale in Step 10) | measured, not a build rule |
| Lighthouse Performance / Accessibility / Best Practices | ≥ 90 / ≥ 95 / ≥ 95 | **92 / 96 / 100** (median of 3, Lighthouse 13.6.0, measured in Step 10; Accessibility 100 in three runs after the coin pill fix) | measured, not a build rule |

**What "entry JS" means.** The build used to print one "JS gzip" figure, the sum of **every** `.js` file in `dist/`: 159.6 kB after Step 8. That sum is the entry bundle (151.2 kB) plus the `workbox-window` chunk that `virtual:pwa-register` loads after launch (2.2 kB) plus `sw.js`, which runs in the worker's own thread (6.2 kB). The budget row is the entry JS, as in D12 (the 146 kB baseline was the only bundle at the time). The check now prints all three, and their total, on every build, so the 159.6 kB total stays visible:

```
check-build: 54 files, 5916.6 kB total
  JS  gzip 159.6 kB in all:
    entry 151.2 kB (budget 160.0 kB), loaded later 2.2 kB, sw.js 6.2 kB
  CSS gzip 7.8 kB (budget 12.0 kB)
  precache 18 entries, 967.8 kB (budget 1200.0 kB)
```

No JS was added or removed in this step; the entry bundle is byte-for-byte the size it was after Step 8. Motion's `LazyMotion`/`m` was a candidate only "if JS is over budget", so it wasn't done.

**Build check** (`scripts/check-build.mjs`):
- `BUDGET = { entryJsGzipBytes: 160_000, cssGzipBytes: 12_000, precacheBytes: 1_200_000 }`.
- `entryScripts(html)`: the module `<script src>` and `<link rel="modulepreload">` files of `dist/index.html` (external URLs ignored). If none is found the build fails, so the JS budget can't be skipped by accident; an entry script missing from `dist/` fails too.
- `checkBudget({ entryJs, entryJsGzip, cssGzip, precacheBytes })`: one error per row over budget (limits inclusive). The precache row is skipped in a kill switch build, which has no precache.
- Planted check: 12 kB of random data appended to the entry bundle in a scratch copy of `dist/` → `budget: entry JS is 164.2 kB gzip, limit 160.0 kB`, exit 1. `KOA_SW_KILL_SWITCH=1 pnpm build` still passes.

**Loading measurements** (Playwright, Chromium, `pnpm preview`, fresh contexts with no worker or cache = a first visit, Lighthouse's mobile settings emulated: 412×823 at DPR 1.75, 4× CPU slowdown, 150 ms RTT, 1.6 Mbps down; 3 runs): FCP = LCP = 2088 / 2076 / 2140 ms (median **2088 ms**), the LCP element is Koa's idle frame (`koa_idle_neutral.webp`, from the preload, fetched once). CLS **0.0002** in every run (one text shift when the web fonts swap in). Resource timing: the frame (0.20–1.47 s) and the entry JS (0.20–1.68 s) download in parallel; first paint waits for the JS.
- **`fetchpriority="high"` on the preload: not added.** The frame already arrives before the JS, and the two share the bandwidth, so a higher priority for the frame would delay the JS, which is what the first paint waits for.
- `decoding="async"` is already on every Koa frame. Font loading shifts nothing measurable (0.0002), so no font change.
- So no performance code changed: the measurements show nothing to fix.
- **Lighthouse itself was not run.** `npx lighthouse` (downloading the package, as the plan says, not adding it as a dependency) was blocked by this session's permission settings. The numbers above approximate LCP and CLS but aren't Lighthouse scores. To record the Lighthouse rows, start `pnpm preview` and run three times (mobile is the CLI's default form factor), then take the median: `npx lighthouse http://localhost:4173/ --only-categories=performance,accessibility,best-practices --output=json --output-path=./lh-1.json --chrome-flags="--headless=new"`. The Lighthouse rows stay open and are measured in Step 10 (D1). Step 9 was approved with this item outstanding; no score is estimated or recorded until a real run.

**Mobile layout fixes** (CSS only):
- **Start under the nav at 375×667 (known since Step 4): fixed.** `home.css`: the stage is `clamp(200px, min(86vw, 44dvh, 100dvh − 440px − safe-top − safe-bottom), 380px)`. The new third term only bites on short portrait screens. 375×667: stage 293 → 227 px, Start 558–610 → 487–547, **40 px clear of the nav** (it overlapped by 23 px); with the standalone 20 px status bar, still 40 px. On 390×844, 430×932 and iPad the stage is unchanged in a browser tab (335, 370, 500 px). In standalone with iPhone safe areas (47/34 and 59/34) the stage is 323 px on 390×844 (was 335) and 370 px on 430×932 (unchanged), and Start sits 28 px and 53 px clear of the nav.
- **Phone landscape (known since Step 6): fixed.** With `(orientation: landscape) and (max-height: 500px)`:
  - `bottom-nav.css`: the nav becomes a compact rail on the left (80 px wide, 56 px items, `safe-left + 12px`), like the desktop rail, instead of a bar taking a fifth of the height and covering Koa.
  - `app.css`: padding for the rail on the left, none reserved below.
  - `home.css`: the two-column layout (stage left; modes, timer and controls right), rows 12 px apart, stage `clamp(180px, min(100dvh − 140px − safe areas, 100vw − 460px), 300px)`, timer at its normal size.
  - `shop.css`: the purchase toast sits low like on desktop (no bar to clear).
  - Result: Home doesn't scroll at all in 844×390 (with and without the 47/21/47 insets), 932×430 and 667×375; Start is 76–96 px above the bottom. Shop, Stats and Settings scroll as before, with more room.
- **Skip confirmation under the nav: fixed.** Found during the review: the inline "Skip this session?" buttons replace the controls and are taller than Start. On 375×667 they were 7 px under the nav, on 390×844 with safe areas 18 px. `app.css`: `html { scroll-padding-bottom: safe-bottom + nav-height + 24px }` (0 where the nav is a rail). The confirmation's Keep button gets focus when it opens, so the browser now scrolls it clear: **12 px above the nav** on 375×667, 390×844 and 430×932 with and without safe areas. The same rule keeps keyboard focus clear of the nav on every tab. Keep returns to the controls with Start 58 px clear.
- **Tap targets: one fix.** An audit of every button, link, input and switch on all four tabs at 320, 390, 844 and 1440 px found only the segmented control under 44 px (40 px: Home's mode chips and Shop's category tabs). `segmented.css`: `min-height: 44px`. Everything else, including every Settings control and the nav, was already ≥ 44 px.
- **Narrow viewports (page zoom): fixed for 320 px.** At 320 px wide (WCAG's reflow width, e.g. iPhone page zoom) Home scrolled sideways: the mode chips (294 px) and the controls row (~322 px) didn't fit between 20 px gutters. Below 360 px only: `--gutter: 12px` (`tokens.css`), an 8 px gap in the controls row (`timer.css`), and `white-space: nowrap` on segmented options (labels wrapped to two lines). Nothing changes at 375 px and up. Start needs a short scroll at 320×568 (it's 47 px under the nav before scrolling, clear after).

**Viewport checks** (Playwright, `pnpm preview`, a fresh context per size, all four tabs, safe areas simulated with `--safe-*`; screenshots in `art/review-phase9/step9-*`, not committed):

| Viewport (safe areas t/r/b/l) | Home: Start vs nav | Home scrolls | Horizontal scroll | Controls in safe areas |
|---|---|---|---|---|
| 375×667 (0) / (20/0/0/0) | 40 / 40 px clear | 44 px (the skip confirmation's reserved height) | none | none |
| 390×844 (0) / (47/0/34/0) | 90 / 28 px clear | 0 / 56 px | none | none |
| 430×932 (0) / (59/0/34/0) | 115 / 53 px clear | 0 / 31 px | none | none |
| 844×390 (0) / (0/47/21/47) | 87 / 76 px above the bottom | 0 | none | none |
| 932×430 (0/59/21/59), 667×375 | 96 / 79 px | 0 | none | none |
| 820×1180 (0) / (24/0/20/0), 1180×820 | 154 / 132 / 227 px | 0 | none | none |
| 1440×900 | 289 px | 0 | none | none |
| 720×450 (1440×900 at 200% zoom) | 117 px (rail layout) | 0 | none | none |
| 320×568 (≈ 120% page zoom on a phone) | after a short scroll | 116 px | none | none (Shop's tab row scrolls sideways by design) |

On every tab, after scrolling to the end, the last control is at least 32 px above a bottom nav. **Not supported: 195 px wide** (a 390 px phone at 200% page zoom): the mode chips, the controls and the Settings rows don't fit, and the page scrolls sideways. Fixing that would need a different narrow layout; recorded for the Phase 10 accessibility pass. Desktop browser zoom at 200% works (720×450 above).

**Other checks:** the Settings number inputs are still 2rem (no iOS focus zoom). After the changes, the production build works offline on all four tabs in a fresh context (worker ready, offline reload, fonts and Koa from the precache) with no console errors or warnings. Running focus, skip and keep were checked on Home at 375×667, 390×844, 430×932 and in landscape.

**Tests:** 11 new in `scripts/check-build.test.ts` (`entryScripts` 3: module scripts and modulepreloads, classic/external scripts ignored and duplicates removed, none found; `checkBudget` 8: the approved numbers, the current build, each limit inclusive, entry JS, CSS and precache over budget, no precache row in a kill switch build, no entry script found, several rows at once). Existing tests unchanged. `pnpm test` 621 tests in 37 files; `pnpm lint` and `pnpm build` pass.

**Unchanged:** all JS (no component or store edits), the timer, rewards, coins, storage and the save schema, the export format, Step 7 notifications and Step 8 sharing, icons, splash screens and character art; no new dependency.

**Limitations / for Step 10:**
- The Lighthouse rows (Performance, Accessibility, Best Practices, and Lighthouse's own LCP/CLS) are still to be measured, as above (Step 10).
- 195 px wide (a phone at 200% page zoom) still scrolls sideways (Phase 10 accessibility pass).
- iPhone SE in a **Safari tab** (not installed) has about 550 px of visible height with the toolbars. Home then needs a short scroll before Start clears the nav, as in Phase 8; the stage stops shrinking at 200 px. The installed app (full 667 px) doesn't scroll.
- The landscape rail and safe areas are checked with simulated insets only; real notch and home-indicator placement in landscape is part of the Step 10 iPhone checklist (item 2).

---

### Step 10 — Device verification and documentation

**Goal:** the completion criteria are proven on real devices, and every doc matches what was built.

**Scope:**
- Connect and deploy Cloudflare Pages following section 9 (only at this point; nothing is connected or deployed earlier). Verify the response headers on the `*.pages.dev` URL before testing devices.
- **iPhone checklist** (you run it on your device; I provide the list and record the results):
  1. Safari: open Koa, Share → Add to Home Screen. Correct icon and name.
  2. Launch: splash screen, then Koa, no Safari UI, status bar readable, nothing under the notch or home indicator, portrait and landscape.
  3. The installed app starts with fresh data (expected per D10). Note whether Safari's data was carried over.
  4. Airplane mode, close the app fully, reopen: everything works, fonts and Koa visible. Complete a short focus session offline: coins paid, survives relaunch.
  5. Turn on Notifications (permission prompt), start a 1-minute session, switch to another app: whether a notification appears depends on iOS keeping Koa alive (documented as not guaranteed). Lock the phone: nothing expected.
  6. Keep screen on (iOS 18.4+), Sounds (tap to unlock).
  7. Export: share sheet → Save to Files; the JSON opens and is complete.
  8. Deploy a new version: reopen the app, the update card appears (not during a running focus session), Update applies it, data intact.
- **Android Chrome checklist:** install via the prompt or menu, offline launch, a notification through the worker with the badge, tapping it opens Koa, update flow.
- **Desktop:** Chrome/Edge install and offline; Safari "Add to Dock" smoke check.
- **Carried over from Step 9:** Lighthouse mobile Performance (≥ 90), Accessibility and Best Practices (≥ 95), median of 3 runs against `pnpm preview` (command in Step 9), plus the installability checklist per D1. Record the real numbers in Step 9's budget table; never estimate them.
- **Also still unverified:** landscape safe areas and notch placement on a real iPhone (checklist item 2), real iOS file sharing (item 7), a real notification tap on Android (and Android in general), and the short scroll before Start in a Safari tab on iPhone SE (expected; note whether it's acceptable).
- Docs: README (features, limitations, install instructions, a short deployment section pointing to section 9), `CLAUDE.md` (status, architecture, Phase 9 section, Playwright notes about service workers), `docs/architecture.md` (`src/sw.ts`, `src/features/pwa/`, `src/core/pwa/`, dependencies table), `docs/roadmap.md` (status, decisions log), this plan (implementation details, results).

**Acceptance:** the three completion criteria met (with D1's definition), checklists recorded, `pnpm test`, `pnpm lint`, `pnpm build` pass.

**Risks:** I can't operate a real iPhone or Android device; those checks depend on you running them. Simulators and Playwright's WebKit don't reproduce Home Screen behavior.

#### Implementation details (Step 10, part 1: local verification, 2026-11-04; reviewed, with the coin pill fix)

**Status:** everything that can be checked on this machine is done and recorded below. Reviewed 2026-11-04: the LCP deviation is accepted, the coin pill fix was approved and made, and the Cloudflare configuration (section 9) is approved. **Not done:** connecting Cloudflare Pages and the first deployment (the configuration is approved, but connecting and deploying wait for an explicit go-ahead), the live `curl -I` header check, and every real-device check. Phase 9 is **not** complete.

**Files added or changed** (the three planned in section 9; the only app change is the coin pill fix below):
- `.node-version`: `24`.
- `public/_headers`: exactly the section 9 rules. Vite copies it to `dist/_headers`; it isn't in the precache (`sw.js` doesn't mention it, and `checkPrecache` rejects it).
- `package.json`: `"packageManager": "pnpm@12.14.0"`.
- `pnpm-lock.yaml`: pnpm 12 records the `packageManager` pin as a separate first YAML document (`packageManagerDependencies: pnpm 12.14.0`, plus the platform binaries' integrity hashes). This is pnpm's own reaction to the field: 158 lines added, none of the dependency entries changed. `pnpm install --frozen-lockfile` (what CI runs) passes: "Lockfile is up to date".
- `src/ui/CoinPill.tsx` and the new `src/ui/CoinPill.test.tsx` (the accessibility fix). No other application code, styles or build check changed.

**Cloudflare docs re-checked (Context7, 2026-11-04):** the plan's assumptions hold. Build image v3 defaults to Node 22.16.0 and v2 to Node 18, so pinning is needed either way. `.node-version` or `NODE_VERSION` sets Node. `PNPM_VERSION` sets pnpm, and **v3 doesn't detect pnpm from `pnpm-lock.yaml`**, so `PNPM_VERSION` is required. `_headers` "override what Cloudflare ordinarily sends". Without a `404.html`, Pages serves `/` for unknown paths (SPA mode).

**Lighthouse** (D1 (c)): Lighthouse **13.6.0** via `npx` (not a dependency), headless Chrome 157, mobile preset with simulated throttling, against `pnpm preview` (`http://localhost:4173/`), the plan's command run three times in a row (reports kept outside the repo):

| Run | Performance | Accessibility | Best Practices | FCP | LCP | TBT | CLS | Speed Index |
|---|---|---|---|---|---|---|---|---|
| 1 | 76 | 96 | 100 | 0.8 s | 3.4 s | 630 ms | 0.0002 | 2.0 s |
| 2 | 92 | 96 | 100 | 0.8 s | 3.1 s | 160 ms | 0.0002 | 1.0 s |
| 3 | 93 | 96 | 100 | 0.8 s | 3.1 s | 140 ms | 0.0002 | 1.0 s |
| **Median** | **92** (≥ 90 ✓) | **96** (≥ 95 ✓) | **100** (≥ 95 ✓) | 0.8 s | **3.1 s** (budget ≤ 2.5 s ✗) | 160 ms | 0.0002 (≤ 0.05 ✓) | 1.0 s |

Run 1's long TBT is the usual first-run outlier (the median rule absorbs it).

- **The one failing accessibility audit:** `aria-prohibited-attr`. The coin pill (`src/ui/CoinPill.tsx`) was a `<div aria-label="N coins">` with no role, and its visible number is `aria-hidden`. Screen readers may ignore a label on a role-less `div`, so the balance might not be announced at all. **Fixed (approved 2026-11-04), see "Coin pill accessibility fix" below.**
- **LCP misses the Step 9 budget row (3.1 s vs ≤ 2.5 s, "Lighthouse mobile").** The D1 criterion (the three scores) is met; the D12 LCP row isn't. Investigation (each variant 3 Lighthouse runs, on scratch copies of `dist/` outside the repo):

  | Variant | Performance | LCP | Conclusion |
  |---|---|---|---|
  | As built | 92 | 3.1 s | — |
  | `fetchpriority="high"` on the frame preload (Lighthouse's own suggestion) | 87–88 | **3.4 s** | Worse: the frame then competes with the entry JS, which the first paint waits for (Step 9's reasoning confirmed). Rejected |
  | Blink frame blocked (upper bound of loading it later) | 92 | 3.0–3.1 s | No effect. Rejected |
  | Both 1024 px frames replaced by the 512 px files (upper bound of a smaller LCP image, 156 kB less) | 93 | 2.8 s | Still over 2.5 s, and visibly softer art on phones. Not proposed |

  **Cause:** in the unthrottled trace, the LCP (Koa's frame) paints at 669 ms, at the same moment as the first contentful paint. Lighthouse's simulation (Lantern) replays every request and main-thread task before that moment at 4× CPU on a 1.6 Mbps link. Most of that time is Koa being rendered by JavaScript (the 151 kB gzip entry bundle must download and run before anything is drawn), plus a cold-start pause in a freshly launched Chrome. A direct test showed it: the same page painted at 244 ms in a warm browser and ~600 ms later in a just-launched one. Lighthouse launches a new Chrome for every run. No small, safe change brings it under 2.5 s. Reaching it would take structural work outside Phase 9's scope, for example pre-rendering the Home shell into `index.html` or a much smaller entry bundle.

  **Decision (2026-11-04): accepted as a documented deviation.** The target stays **≤ 2.5 s** and is **not met**: the measured median is **3.1 s** (runs 3.4 / 3.1 / 3.1 s). Structural optimization is deferred, not attempted in this release, because:
  - the D1 completion criteria (Performance ≥ 90, Accessibility and Best Practices ≥ 95) pass;
  - the real first paint is fast (669 ms unthrottled, ~2.09 s under Step 9's Playwright throttling), and the gap to 3.1 s comes mostly from Lighthouse's simulation of a JavaScript-rendered first paint in a cold browser;
  - the only fixes that would reach 2.5 s (a pre-rendered Home shell, or a much smaller entry bundle) are architectural changes with real risk to the timer, Koa and the update flow, out of scope for a release-verification step.

  Revisit if the app grows, or as a Phase 10+ performance item. The budget and the build check are unchanged.

**Coin pill accessibility fix** (approved 2026-11-04, the only code change in Step 10):
- `src/ui/CoinPill.tsx`: the `aria-label` on the role-less `div` was removed. Inside the pill, after the visible number, there's now `<span className="visually-hidden">{N} coins</span>` (the existing `.visually-hidden` utility from `base.css`). It shows the **actual** balance (`coins`), as the label did, not the count-up number, so screen readers never hear intermediate values. The visible number and the coin glyph stay `aria-hidden`. `data-coin-target`, the count-up/down and the bump animation are unchanged. No CSS, coin calculation, reward, persistence or other component changed.
- **Tests:** `src/ui/CoinPill.test.tsx` (new, 4 tests, rendered with `react-dom/server`, already a dependency, so no DOM test library was added): no `aria-label`; the hidden text is "N coins" with the formatted balance; with the `aria-hidden` parts removed, "N coins" is the only exposed text (the glyph and the animated number are hidden); "0 coins" and "25 coins"; `data-coin-target` and the visible number are intact. Against the old markup, the first two would fail (an `aria-label`, and no exposed text). `pnpm test`: 625 tests in 38 files.
- **Verified in the production build** (`pnpm preview`, fresh contexts):
  - Lighthouse 13.6.0 accessibility, three runs: **100 / 100 / 100**, `aria-prohibited-attr` passes, no failing audits. These are accessibility-only runs after the fix; the full three-category medians above (92 / 96 / 100) are the earlier record.
  - Chrome's accessibility tree for the pill: a single text node, "0 coins".
  - Pixel diff at 390×844 @3 against the screenshot taken before the change: **0 differing pixels** in the pill and in the whole top bar (pill box 62×40 px either way).

**Cloudflare behavior, emulated locally** (`npx wrangler@4 pages dev dist`, wrangler 4.157.0, the official local Pages emulator, not a dependency; "Parsed 5 valid header rules"):

| Path | Status | `Cache-Control` |
|---|---|---|
| `/` | 200 | `no-cache` |
| `/sw.js` | 200 `application/javascript` | `no-cache` |
| `/manifest.webmanifest` | 200 `application/manifest+json` | `no-cache` |
| `/assets/index-*.js`, `/assets/*.woff2` | 200 | `public, max-age=31536000, immutable` |
| `/characters/*.webp`, `/icons/*.png`, `/splash/*.jpg`, `/favicon.svg` | 200 | Cloudflare's default `public, max-age=0, must-revalidate` (as planned: revalidate with ETag) |
| `/index.html` | **308 → `/`** | `no-cache` |
| `/_headers` | 200 = the app's `index.html` (the file itself is never served) | default |
| `/unknown/path`, the old `/characters/reference/koala-design-sheet.png` | 200 = the app's `index.html` (SPA fallback) | default |

- **New finding, not a blocker:** Pages redirects `/index.html` to `/` (its "pretty URL" rule), so the `/index.html` rule in `_headers` only ever applies to that 308. The page itself is served as `/`, which has `no-cache`. The rule is kept as planned (harmless, and correct if the redirect ever changes). Workbox precaches `index.html?__WB_REVISION__=…`, which is redirected to `/?__WB_REVISION__=…`; Workbox follows the redirect and stores a clean copy. Verified below: the worker activates, the precache has the page, and offline launches work behind the redirect.
- The live check with `curl -I` on the `*.pages.dev` URL is still required after deployment (section 9 step 5).

**D1 installability checklist** (Chromium via `puppeteer-core` from the Lighthouse npx cache, against the wrangler emulator; a non-incognito profile, because off-the-record contexts only report `in-incognito`):

| Item | Result |
|---|---|
| (a) DevTools installability, Chrome 157 | `Page.getInstallabilityErrors` **[]**, `Page.getAppManifest` errors **[]** |
| (a) the same in Edge 156 | **[]** and **[]** |
| Manifest fields | `id` `/`, `name`/`short_name` "Koa", `start_url` `/`, `scope` `/`, `display` `standalone`, `theme_color` and `background_color` `#f9eee1`, `lang` `en` |
| Icons, including maskable | 192 (`any`), 512 (`any`), 512 (`maskable`): each 200, `image/png`, exact pixel size. Badge 96×96 |
| `apple-touch-icon` | `/icons/apple-touch-icon-180.png`, 200, 180×180 |
| Theme color, viewport | `theme-color` `#f9eee1`; `width=device-width, initial-scale=1.0, viewport-fit=cover` (pinch zoom allowed) |
| iOS meta | `apple-mobile-web-app-capable` yes, status bar `default`, 30 startup images linked |
| Service worker | scope `/`, `/sw.js` **activated**; the first visit isn't controlled (by design), the reload is |
| Precache | one cache `koa-precache-v2-…`, exactly **18 entries**; no icons, splash, `reference/`, source maps, `sw.js` or `_headers` |
| Works offline / the worker controls `start_url` | offline `/` → 200 **from the service worker**, fonts loaded, both Koa frames decoded |
| Reference sheet | not in `dist/` (build check), not precached, and its old URL returns the app page |

**Offline** (fresh incognito context, 390×844 @3, emulator):
- The first load installs the worker (uncontrolled). Offline, Home, Shop, Stats and Settings all load **from the service worker** with Fredoka and Nunito Sans and Koa's frames (Settings has none), with no horizontal scroll. Offline `/some/deep/link?from=homescreen` gets the app.
- Real-time completion offline: a seeded running focus session ending 4 s after load completed, paid `focus:step10-seed` = 25 coins (pill "25 coins"), moved to the short break, and survived an offline reload.
- **0 console errors or warnings and 0 failed requests.**

**Update flow** (two production builds that differ only in the version caption, A `aaaaaaa` and B `bbbbbbb`, `check-build: OK` for both; a throwaway static server on `localhost:4180` that switches builds and mimics what wrangler showed: the `_headers` rules, the 308s and the SPA fallback):

| Check | Result |
|---|---|
| A loaded and controlled | caption "Koa 0.0.0 (aaaaaaa)" |
| Focus session running, B deployed, relaunch | B's worker **waiting**, **no prompt** (D3) |
| Pause | prompt "Koa has an update" shown |
| Later | hidden; shown again on the next launch |
| Update | one reload into B: caption "Koa 0.0.0 (bbbbbbb)", no prompt, `koa:v1` **byte-identical** (the paused session) |
| Cache invalidation | one precache, 18 entries, only B's `index-*.js`; A's is gone |
| Console | 0 errors or warnings, 0 failed requests |

The deferral, two tabs and the kill switch were covered in Step 4 and nothing touching them changed, so they weren't repeated.

**Viewports** (fresh contexts, emulator, all four tabs): 390×844, 820×1180 and 1440×900 have no horizontal scroll, fonts loaded and Koa's frames decoded, with 0 console problems. Start sits 90 px and 154 px clear of the bottom nav (as in Step 9). At 1440 the nav is the left rail.

**Console caveat:** while offline, Chrome and Edge themselves log `Error while trying to use the following icon from the Manifest: …/icons/icon-192.png` (plus the failed request). The browser re-fetches the manifest icon, and icons are deliberately not precached (Step 3; the OS stores them at install). It isn't from Koa's code, and it doesn't appear online or in the app's own checks. Recorded as known; no change to the approved precache list.

**Tooling note:** the Playwright MCP browser was locked by another process during this step, so the browser checks used `puppeteer-core` (already in the npx cache from Lighthouse) with the installed Chrome and Edge. Same engine and the same checks; nothing was added to the project.

**Known limitations, retained:**
- iPhone SE in a Safari **tab** may need a short scroll before Start (installed app: no scroll). Confirm on a device (checklist).
- 195 px wide (a phone at 200% page zoom) scrolls sideways (Phase 10 accessibility pass).
- Only simulated so far: iPhone landscape safe areas and the notch, real notification taps and Android in general, real iOS file sharing.

#### Device checklists (to run after deployment; results recorded here)

Use the production `*.pages.dev` URL (HTTPS). "Fresh" means Koa has never been opened in that browser or app. Record ✓ / ✗ and notes, and the device model and OS version.

**Before any device:** `curl -I` on the live URL for `/`, `/sw.js`, `/manifest.webmanifest`, one `/assets/*.js` and `/index.html` (expect the table above), and the build log shows Node 24.x, pnpm 12.14.0 and `check-build: OK`.

**iPhone (Safari, iOS 16.4+); repeat items 1–4 on iPad if available**

| # | Do | Expect | Result |
|---|---|---|---|
| 1 | Open the URL in Safari. Settings → "Install Koa" shows the Share steps. Share (on iOS 26 tap ••• first) → Add to Home Screen → Add | The Home Screen icon is Koa's head on cream, named "Koa" | |
| 2 | Launch from the Home Screen | Koa's splash on cream, then Home; no Safari UI; dark status bar text readable on cream | |
| 3 | Portrait and landscape on every tab | Nothing under the notch/Dynamic Island or the home indicator; in landscape the nav is a left rail clear of the notch; Start reachable without scrolling | |
| 4 | Look at coins and Stats in the installed app vs Safari | The installed app starts fresh (D10); note whether Safari's data was carried over | |
| 5 | Launch once online, then Airplane Mode, swipe the app away, relaunch | Works: fonts and Koa visible, all tabs | |
| 6 | Offline: Settings → focus 1 min, Start, wait for it to finish in the app | Coins paid; still there after a relaunch | |
| 7 | Settings → Session notifications on (permission prompt) → 1-min session → switch to another app | A notification may appear if iOS keeps Koa running (not guaranteed). Locked phone: nothing expected. If one appears, tap it: Koa opens | |
| 8 | Keep screen on (iOS 18.4+ in the app), Sounds on (tap needed) | Switch works or explains; the chime plays | |
| 9 | Settings → Export | The share sheet opens; Save to Files; the `koa-data-YYYY-MM-DD.json` file opens and contains the data | |
| 10 | After a second deployment: reopen the app (not during a running focus session) | "Koa has an update" → Update → new version caption in Settings; data intact. During a running focus session: no card | |
| 11 | iPhone SE (or a small iPhone) in a **Safari tab** | Note whether the short scroll before Start is acceptable | |

**Android (Chrome)**

| # | Do | Expect | Result |
|---|---|---|---|
| 1 | Open the URL. Settings → "Install Koa" (button, or the menu wording) → Install | Installed as an app with Koa's icon (maskable, nothing clipped) | |
| 2 | Launch, then Airplane Mode, close it, relaunch | Works offline on all tabs | |
| 3 | Session notifications on → 1-min session → switch to another app before it ends | One notification "Focus session done", with the leaf badge in the status bar | |
| 4 | Tap it (Koa still open in the background) | Koa comes to the front, same tab, no reload | |
| 5 | Close Koa fully, trigger another notification (if one is still showing, tap it) | Tapping opens Koa | |
| 6 | System back gesture between tabs | Goes back through the visited tabs | |
| 7 | After a second deployment | The update card, then Update applies it, data intact | |

**Desktop**

| # | Do | Expect | Result |
|---|---|---|---|
| 1 | Chrome or Edge: Settings → Install (or the address bar icon) | Opens in its own window; "Install Koa" card hidden there | |
| 2 | Offline (disconnect), relaunch the installed app | Works on all tabs | |
| 3 | After a second deployment | The update card, then Update applies it, data intact | |
| 4 | Safari on macOS (optional): File → Add to Dock | Opens as a web app | |

## 5. Testing and acceptance summary

| Step | Unit tests | Browser checks | Done when |
|---|---|---|---|
| 1 Reference sheet + build check | build check rules | smoke 390×844 | sheet not in `dist/`; build fails if it returns |
| 2 Icons | script assertions | visual review | icons approved |
| 3 Manifest + worker | `PwaEnv` registration | offline reload of all tabs, offline session + payout, no worker in dev, installability | installable, offline, nothing else changed |
| 4 Updates | `shouldOfferUpdate`, update store | A→B update, focus deferral, two tabs, cache cleanup, kill switch | safe updates, old caches gone |
| 5 Splash | script assertions | visual review | images approved, not precached |
| 6 Standalone + install help | display mode, install state | 4 viewports + landscape | no clipping; install row correct |
| 7 Notifications via worker | `show()` paths, `pickClient` | worker notification, click focuses Koa | Android-ready, Phase 8 rules intact |
| 8 Share export | `exportMethod`, share outcomes | download unchanged; mocked share | share in standalone, quiet cancel |
| 9 Budget | — | Lighthouse ×3, 6 viewports | budget met |
| 10 Devices + docs | full suite | iPhone, Android, desktop checklists | completion criteria met |

**Rules for every step:**
- `pnpm test`, `pnpm lint`, `pnpm build` pass.
- Playwright checks of the service worker run in a **fresh browser context**, on `pnpm preview`, never `pnpm dev`.
- Caches and the worker are cleared between checks (new context), so one check never sees another's cache.
- The existing timer, rewards, shop, sounds, notifications, wake lock, export and reset behavior is re-checked wherever a step touches shared code.

## 6. Known risks and limitations

- **First launch needs the network.** On every platform. On iPhone, the installed app needs its own first online launch, even if Safari already had Koa cached *(verify)*.
- **iPhone: installed app and Safari have separate data** *(verify)*. Someone who studied in Safari starts over in the installed app. Export works, but there's no import (out of scope; decision D10).
- **No push server**, so no notifications while Koa is suspended, frozen or closed, on any platform. This plan doesn't change that and promises nothing more.
- **iOS has no install prompt.** Install help can only explain the steps.
- **Splash screens** need one image per device size; new devices fall back to a plain screen until the table is updated.
- **A broken service worker is sticky** until the next successful update check. The kill switch (Step 4, `KOA_SW_KILL_SWITCH=1`) is the recovery path; it reloads open Koa pages once.
- **Old versions live longer** in PWAs. Any future save-schema bump has to handle an older open app (Step 4 risk note).
- **Plugin compatibility with Vite 8:** verified in Step 3 (`vite-plugin-pwa` 2.0.0 supports Vite 8; one harmless Rolldown deprecation warning until upstream PR #958 ships).
- **Lighthouse no longer has a PWA category** (D1).
- **Hosting decides cache headers.** `sw.js` and `index.html` must be revalidated on every request; hashed assets can be cached for a year. Handled by the `_headers` file for Cloudflare Pages (section 9). The base path stays `/`.
- **Preview deployments** on Cloudflare Pages get their own `*.pages.dev` subdomains, so their service workers, caches and saved data are separate from production. Fine for testing, but data never moves between them.
- **I can't test on physical devices.** Device results depend on your checks.

## 7. Out of scope

- Web Push and a push server, background sync, periodic background sync.
- Notifications while Koa is suspended or closed.
- The Badging API (app icon badge), app shortcuts, share target, file handling, manifest screenshots / richer install UI.
- Data import, accounts, sync between Safari and the installed app or between devices.
- Any change to the `koa:v1` schema or storage architecture.
- New character artwork or accessory art. Icons and splash images are compositions of existing approved art only, and only if approved (D4, D7).
- A dark or evening theme (and dark splash screens).
- Native wrappers or app store distribution.
- Phase 10 work: the committed Playwright suite, the accessibility pass, the copy pass.

## 8. Decisions (approved 2026-11-03)

| # | Question | Decision |
|---|---|---|
| **D1** | What replaces "Lighthouse PWA checks pass" (Lighthouse 12 removed the PWA category)? | **Approved as proposed.** (a) Chrome DevTools reports the manifest installable with no errors; (b) a written checklist of the former PWA audits (manifest fields, icons incl. maskable, `apple-touch-icon`, theme color, viewport, works offline, service worker controls `start_url`); (c) Lighthouse mobile Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95 (median of 3 runs) |
| **D2** | Hosting | **Cloudflare Pages (Free plan)** with GitHub integration: private repository `szerep/koa`, production branch `main`, the free `*.pages.dev` subdomain, base path `/`, build command `pnpm build`, output directory `dist`. Caching headers per section 9. **Not connected or deployed until Phase 9 is ready for device testing (Step 10)** |
| **D3** | Update behavior | **Prompted updates only.** Never reload automatically, never interrupt a running focus session. "Later" hides the prompt until the next launch; otherwise the new version activates when all Koa windows are closed |
| **D4** | App icon source | **The approved Master's head-and-shoulders crop** for the app icons. **The existing leaf mark** for the Android notification badge |
| **D5** | Dependencies | **Approved:** dev `vite-plugin-pwa`, `workbox-precaching`, `workbox-routing`, `workbox-core`, **conditional on verified Vite 8 compatibility.** If incompatible: stop and report |
| **D6** | App version in Settings | **Yes,** a small caption |
| **D7** | iOS splash screens | **Yes,** generated from approved artwork (the idle frame centered on cream), iPhone portrait + iPad portrait/landscape, not precached |
| **D8** | Install help | **Approved:** a quiet "Install Koa" row in Settings, hidden once installed. No banners |
| **D9** | Storage changes | **None.** The future-schema risk stays recorded |
| **D10** | Separate data in the installed iPhone app | **Accepted.** Explained in the install help and README. No import in Phase 9 |
| **D11** | Export in installed apps | **Web Share API** for file exports in supported standalone apps; **download fallback** everywhere else |
| **D12** | Performance budget | **Approved** (Step 9 table). App icons and splash screens are **reviewed separately** with their own per-file limits, so the build check never rejects legitimate icons because of the character-art limit |
| **D13** | `MASTER_PROMPT.md` reference-sheet path | **Approved:** updated in Step 1 |

## 9. Deployment (Cloudflare Pages)

**Configuration approved (2026-11-04); not connected or deployed yet.** Verified locally in Step 10: the files exist, the build passes, and the headers behave as intended in `wrangler pages dev`. Approved values: Free plan, `szerep/koa`, production branch `main`, root directory `/`, build command `pnpm build`, output directory `dist`, Node 24, `PNPM_VERSION=12.14.0`. Connecting the repository and the first deployment still wait for an explicit go-ahead (and the push to `main`).

### Project settings

| Setting | Value |
|---|---|
| Plan | Free |
| Source | GitHub integration, private repository `szerep/koa` (the Cloudflare GitHub app needs access to this repository only) |
| Production branch | `main` (every push to `main` deploys production) |
| Production URL | the project's `*.pages.dev` subdomain |
| Framework preset | None (or Vite; the values below are what matters) |
| Build command | `pnpm build` (type check, Vite build, build check) |
| Build output directory | `dist` |
| Root directory | repository root |
| Vite base path | `/` (unchanged) |

### Node and pnpm versions

Cloudflare Pages' default Node and pnpm versions depend on the project's build system version: V2 currently defaults to Node 18 and pnpm 8, V3 to Node 22 and pnpm 10. Neither matches Koa, so both are pinned explicitly, whichever build system the project uses. Local versions today: Node 24.21.0, pnpm 12.14.0.

- **Node:** a `.node-version` file at the repository root containing `24` (Cloudflare reads `.node-version` or `.nvmrc`; the `NODE_VERSION` environment variable overrides it). Matches the README's "Node.js 24+".
- **pnpm:** the `PNPM_VERSION` environment variable in the Pages project (Settings → Environment variables, production and preview) set to the local major/minor, `12.14.0`, so the lockfile format matches. pnpm is detected from `pnpm-lock.yaml`. Also add `"packageManager": "pnpm@12.14.0"` to `package.json` so local and CI agree.
- Verify both in the first deployment's build log. If Cloudflare's current build image handles versions differently by then, follow its docs and update this section.
- The build needs no Python: icons and splash screens are generated locally and committed.

These files (`.node-version`, `public/_headers`, the `packageManager` field) were **added in Step 10** (2026-11-04), before the deployment. With the field, pnpm 12 also records the pin at the top of `pnpm-lock.yaml`; `pnpm install --frozen-lockfile` passes. Cloudflare's docs were re-checked then: v3 doesn't detect pnpm from the lockfile, so `PNPM_VERSION` is required.

### Caching headers (`public/_headers`)

Vite copies `public/_headers` to `dist/_headers`, which Cloudflare Pages applies. It's never precached (the build check confirms).

```
/sw.js
  Cache-Control: no-cache

/
  Cache-Control: no-cache

/index.html
  Cache-Control: no-cache

/manifest.webmanifest
  Cache-Control: no-cache

/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

- **`sw.js`, `/`, `index.html`, the manifest:** always revalidated (`no-cache` still allows a 304), so a deploy is picked up on the next update check. Browsers also ignore HTTP caching for the service worker script by default when checking for updates, but the header keeps every client and proxy consistent.
- **`/assets/*`:** Vite's content-hashed JS, CSS and fonts. A changed file gets a new name, so a year with `immutable` is safe.
- **Everything else** (character frames, icons, splash images, `favicon.svg`): not hashed, so they keep Cloudflare's default (revalidate with ETag). The service worker precache handles them through Workbox revisions, so offline use doesn't depend on HTTP caching.
- **`/index.html` is redirected (308) to `/` by Pages** (found with `wrangler pages dev` in Step 10), so in practice that rule only covers the redirect; the page is served as `/` with `no-cache`. The worker's precache follows the redirect correctly (verified).
- Verified locally with `wrangler pages dev` in Step 10. Verify on the live URL with `curl -I` for each rule before device testing.

### Routing

Koa has one page and hash-based tabs (`/#/shop`), so it needs no redirects. Without a `404.html` in `dist`, Cloudflare Pages serves `index.html` for unknown paths, which is fine.

### Deploying, step by step (Step 10)

1. Commit and push the Phase 9 work to `main` (only when you ask).
2. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → authorize the GitHub app for `szerep/koa` only.
3. Enter the project settings above; add `PNPM_VERSION` (and `NODE_VERSION` only if not using `.node-version`).
4. Save and deploy; check the build log for the Node and pnpm versions and the build check output.
5. Check headers with `curl -I`, then run the device checklists in Step 10.
6. Optionally restrict preview deployments to non-production branches you choose (Settings → Builds → Branch control); previews use their own subdomains and have separate data.

**Rollback:** Cloudflare Pages can roll back to an earlier deployment from the dashboard. Clients with the service worker pick it up through the normal update prompt; a broken worker is handled by the kill switch in Step 4 (set `KOA_SW_KILL_SWITCH=1` and redeploy; see "Kill switch (emergency recovery)").

## 10. Implementation sequence

Steps 1–6 approved and committed (2026-11-03); Steps 7–9 approved and committed (2026-11-04; Step 9's Lighthouse scores move to Step 10); Step 10 in progress: local verification done (2026-11-04), deployment and device checks pending. One step at a time, each verified, documented and approved before the next.

1. Reference sheet out of the build + build check (approved 2026-11-03)
2. App icons (approved provisionally 2026-11-03)
3. `vite-plugin-pwa`, manifest, offline service worker (approved 2026-11-03)
4. Update flow, app version, kill switch (approved 2026-11-03)
5. iOS splash screens (approved 2026-11-03)
6. Standalone polish and install help (approved 2026-11-03)
7. Notifications through the service worker (approved 2026-11-04)
8. Export through the share sheet (approved 2026-11-04)
9. Mobile optimization and performance budget (approved 2026-11-04; Lighthouse scores measured in Step 10)
10. Cloudflare Pages deployment, device verification, documentation (in progress: local verification done and reviewed 2026-11-04, LCP deviation accepted, coin pill fix made; configuration approved, not connected or deployed; device checks pending)
