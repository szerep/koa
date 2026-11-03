/// <reference lib="webworker" />
/**
 * Koa's service worker (Phase 9, Step 3). Built by vite-plugin-pwa (`injectManifest`) into
 * `dist/sw.js`; never active in `pnpm dev`.
 *
 * - Precaches the app shell, JS, CSS, fonts and the four Koa frames (the list is injected at
 *   build time as `self.__WB_MANIFEST`, see `vite.config.ts`), so Koa opens offline after one
 *   online visit.
 * - Every navigation gets the precached `index.html` (Koa has one page and hash tabs).
 * - A new version waits: no `skipWaiting()` or `clientsClaim()` on install. It activates once
 *   every Koa window is closed, or when the page posts `SKIP_WAITING` (the update prompt, Step 4).
 * - Never touches app data: no LocalStorage (not available here), no IndexedDB.
 *
 * - Tapping a session notification (Step 7) closes it and focuses an open Koa window, or opens
 *   Koa if none is open (`src/core/pwa/notificationClick.ts`).
 */
import { setCacheNameDetails } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute, type PrecacheEntry } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { focusOrOpenKoa } from './core/pwa/notificationClick'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (PrecacheEntry | string)[] }

// Cache names start with "koa" (e.g. koa-precache-v2-<scope>). Must run before precaching.
setCacheNameDetails({ prefix: 'koa' })

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

self.addEventListener('message', (event) => {
  const data: unknown = event.data
  if (typeof data === 'object' && data !== null && (data as { type?: unknown }).type === 'SKIP_WAITING') {
    void self.skipWaiting()
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  // waitUntil keeps the worker alive and lets the browser allow focus()/openWindow() for this tap.
  event.waitUntil(focusOrOpenKoa(self.clients, self.registration.scope, event.notification.data))
})
