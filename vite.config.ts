import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { appVersion } from './scripts/app-version.ts'

/** `--cream-100` in src/styles/tokens.css, also the `theme-color` meta in index.html. */
const CREAM = '#f9eee1'

/** Local commit hash for the version caption; undefined when git isn't available. */
function gitShortSha(): string | undefined {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return undefined
  }
}

const packageVersion = (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version?: string })
  .version

/**
 * Emergency kill switch (Phase 9 Step 4, docs/phase-9/pwa-plan.md "Kill switch"). Building with
 * KOA_SW_KILL_SWITCH=1 ships a worker that unregisters itself and deletes Koa's caches on the
 * next visit, so the app loads from the network again. LocalStorage is never touched.
 */
const killSwitch = process.env.KOA_SW_KILL_SWITCH === '1'

// https://vite.dev/config/
export default defineConfig({
  define: {
    // Shown in Settings (decision D6): Cloudflare's commit, else local git, else the package version.
    __APP_VERSION__: JSON.stringify(
      appVersion({
        packageVersion: packageVersion ?? '0.0.0',
        cloudflareSha: process.env.CF_PAGES_COMMIT_SHA,
        gitSha: process.env.CF_PAGES_COMMIT_SHA ? undefined : gitShortSha(),
      }),
    ),
  },
  plugins: [
    react(),
    // Phase 9 Step 3: manifest + offline service worker (docs/phase-9/pwa-plan.md).
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // Updates wait for the user (decision D3): src/features/pwa/UpdatePrompt.tsx.
      registerType: 'prompt',
      // The kill switch (see above). Off for every normal build.
      selfDestroying: killSwitch,
      // Registered by src/features/pwa/ (virtual:pwa-register), not by an injected script.
      injectRegister: false,
      // The manifest icons are stored by the OS at install; they're not precached.
      includeManifestIcons: false,
      manifest: {
        id: '/',
        name: 'Koa',
        short_name: 'Koa',
        description: 'Koa — a cozy study timer with a koala who keeps you company.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: CREAM,
        theme_color: CREAM,
        lang: 'en',
        categories: ['education', 'productivity'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        // The app shell, JS, CSS, fonts, favicon and the Koa frames. The manifest is added by
        // the plugin. scripts/check-build.mjs verifies the resulting list on every build.
        globPatterns: ['index.html', 'favicon.svg', 'assets/*.{js,css,woff2}', 'characters/*.webp'],
        globIgnores: ['**/reference/**', 'icons/**', 'splash/**', '**/*.map'],
      },
      // Never a service worker in `pnpm dev`: it would cache dev files.
      devOptions: { enabled: false },
    }),
  ],
})
