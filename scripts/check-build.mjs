// Post-build check for the shipped bundle (Phase 9, Steps 1-5).
// Runs after `vite build` (see the "build" script in package.json) and fails the build when
// `dist/` contains something that must never ship, the service worker's precache isn't
// exactly what Koa needs offline, or the iOS startup images don't match index.html. Plain Node,
// no dependencies.
//
//   node scripts/check-build.mjs [distDir]     (distDir defaults to ./dist)
//
// With KOA_SW_KILL_SWITCH=1 (the emergency kill switch build, Step 4) sw.js must instead be the
// plugin's self-destroying worker, and the check says so loudly.
//
// The rules live in `checkFiles`, `checkPrecache` and `checkSplash`, pure functions tested in
// check-build.test.ts.
// Sizes use decimal units (1 kB = 1000 bytes), like Vite's build output.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

export const LIMITS = {
  /** A character frame in dist/characters/ (precached app art). */
  characterFrameBytes: 150_000,
  /** Any PNG anywhere in dist/ (app icons excepted: they have their own limits below). */
  pngBytes: 300_000,
}

/**
 * Per-file limits for the app icons in dist/icons/ (Phase 9 Step 2, decision D12), set from the
 * generated files with about 30% headroom. Icons aren't precached. The soft plush art is kept
 * lossless (palette quantization visibly dithered the blush and highlights), so icon-512.png is
 * larger than the general PNG limit. A file in icons/ without an entry here fails the build.
 */
export const ICON_LIMITS = {
  'apple-touch-icon-180.png': 60_000, // 43.8 kB generated
  'icon-192.png': 65_000, // 49.4 kB
  'icon-512.png': 450_000, // 350.7 kB
  'icon-maskable-512.png': 280_000, // 215.0 kB
  'badge-96.png': 8_000, // 2.4 kB
}

/**
 * iOS startup images in dist/splash/ (Phase 9 Step 5, decisions D7 and D12): JPEGs made by
 * scripts/art/make_splash.py, one per <link rel="apple-touch-startup-image"> in index.html. Limits
 * set from the generated files with about 30% headroom. Never precached (iOS fetches the matching
 * image itself when Koa is added to the Home Screen).
 */
export const SPLASH_LIMITS = {
  /** An iPhone image (shorter side below tabletShortSide). Largest generated: 121.6 kB. */
  phoneBytes: 160_000,
  /** An iPad image. Largest generated: 241.8 kB. */
  tabletBytes: 320_000,
  /** In pixels: images whose shorter side is at least this are iPad images. */
  tabletShortSide: 1400,
  /** All splash images together. Generated: 30 files, 4269.2 kB. */
  totalBytes: 5_500_000,
}

/**
 * The service worker's precache (Phase 9 Step 3): exactly the app shell, every hashed JS, CSS
 * and font file in assets/, the favicon, the manifest and the four Koa frames. Never icons,
 * splash screens, reference files, source maps, hosting files or the worker itself.
 */
export const PRECACHE_FIXED = [
  'index.html',
  'favicon.svg',
  'manifest.webmanifest',
  'characters/koa_idle_neutral.webp',
  'characters/koa_idle_neutral-512.webp',
  'characters/koa_idle_blink.webp',
  'characters/koa_idle_blink-512.webp',
]

/** Files in assets/ that must all be precached (JS, CSS, fonts). */
const PRECACHE_ASSET = /^assets\/[^/]+\.(js|css|woff2)$/

/** Never precached, whatever the glob patterns say. */
const NEVER_PRECACHED = [
  [/^icons\//, 'manifest icons are stored by the OS at install'],
  [/^splash\//, 'iOS fetches splash screens itself at install'],
  [/(^|\/)reference\//i, 'reference files must not ship'],
  [/\.map$/, 'source maps are not part of the app'],
  [/^sw\.js$/, 'the worker itself is never precached'],
  [/^_headers$/, 'hosting configuration'],
]

const IMAGE_EXT = /\.(png|webp|jpe?g|avif|gif|svg)$/i

/**
 * Classifies the files of a build against the rules.
 * @param {{ path: string, bytes: number }[]} files paths relative to dist/, with "/" separators
 * @returns {{ errors: string[], images: { path: string, bytes: number }[] }}
 */
export function checkFiles(files) {
  const errors = []
  const images = []
  for (const { path, bytes } of files) {
    const segments = path.toLowerCase().split('/')
    const name = segments[segments.length - 1]

    if (segments.slice(0, -1).includes('reference')) {
      errors.push(`${path}: reference files must not ship (keep them in art/reference/)`)
    } else if (name.startsWith('koala-design-sheet.')) {
      errors.push(`${path}: the design sheet must not ship (keep it in art/reference/)`)
    }

    if (segments[0] === 'characters' && IMAGE_EXT.test(name) && bytes > LIMITS.characterFrameBytes) {
      errors.push(`${path}: character frame is ${kB(bytes)}, limit ${kB(LIMITS.characterFrameBytes)}`)
    }

    const isIcon = segments.length === 2 && segments[0] === 'icons'
    if (isIcon) {
      const limit = Object.hasOwn(ICON_LIMITS, name) ? ICON_LIMITS[name] : undefined
      if (limit === undefined) {
        errors.push(`${path}: no size limit set for this icon (add it to ICON_LIMITS)`)
      } else if (bytes > limit) {
        errors.push(`${path}: icon is ${kB(bytes)}, limit ${kB(limit)}`)
      }
    } else if (name.endsWith('.png') && bytes > LIMITS.pngBytes) {
      errors.push(`${path}: PNG is ${kB(bytes)}, limit ${kB(LIMITS.pngBytes)}`)
    }

    if (IMAGE_EXT.test(name)) images.push({ path, bytes })
  }
  return { errors, images }
}

/**
 * Reads the precache list that workbox-build injected into the built worker, as JSON objects
 * like {"revision":"…","url":"index.html"} (revision is null for hashed files).
 * @param {string} swSource the contents of dist/sw.js
 * @returns {string[] | null} the precached URLs, or null when no list is found
 */
export function precacheUrls(swSource) {
  const entry = /\{"revision":(?:"[^"]*"|null),"url":"([^"]+)"\}/g
  const urls = [...swSource.matchAll(entry)].map((m) => m[1])
  return urls.length > 0 ? urls : null
}

/**
 * Checks the precache list against the build: everything Koa needs offline, nothing else.
 * @param {string[] | null} urls from `precacheUrls` (relative to dist/, no leading "/")
 * @param {{ path: string, bytes: number }[]} files every file in dist/
 * @returns {{ errors: string[], bytes: number }} the errors and the precache's total size
 */
export function checkPrecache(urls, files) {
  if (urls === null || urls.length === 0) {
    return { errors: ['sw.js: no precache list found (did injectManifest run?)'], bytes: 0 }
  }
  const errors = []
  const sizes = new Map(files.map((f) => [f.path, f.bytes]))
  const expected = new Set([...PRECACHE_FIXED, ...files.map((f) => f.path).filter((p) => PRECACHE_ASSET.test(p))])
  const seen = new Set()
  let bytes = 0

  for (const url of urls) {
    if (seen.has(url)) {
      errors.push(`precache: ${url} is listed twice`)
      continue
    }
    seen.add(url)
    const never = NEVER_PRECACHED.find(([pattern]) => pattern.test(url))
    if (never) errors.push(`precache: ${url} must not be precached (${never[1]})`)
    else if (!expected.has(url)) errors.push(`precache: ${url} is not an expected entry`)
    if (sizes.has(url)) bytes += sizes.get(url)
    else errors.push(`precache: ${url} is not in the build`)
  }
  for (const url of expected) {
    if (!seen.has(url)) errors.push(`precache: ${url} is missing (needed offline)`)
  }
  for (const ext of ['js', 'css', 'woff2']) {
    if (![...seen].some((u) => PRECACHE_ASSET.test(u) && u.endsWith(`.${ext}`))) {
      errors.push(`precache: no .${ext} file from assets/`)
    }
  }
  return { errors, bytes }
}

/**
 * Whether sw.js is vite-plugin-pwa's self-destroying worker (the kill switch, `selfDestroying`):
 * it unregisters itself and deletes the caches, and precaches nothing.
 * @param {string} swSource the contents of dist/sw.js
 */
export function isSelfDestroyingWorker(swSource) {
  return (
    swSource.includes('self.registration.unregister()') &&
    swSource.includes('caches.delete') &&
    precacheUrls(swSource) === null
  )
}

/**
 * Checks the worker for the kind of build: a normal build needs the precache (checkPrecache), a
 * kill-switch build needs the self-destroying worker.
 * @param {{ swSource: string | null, killSwitch: boolean, files: { path: string, bytes: number }[] }} input
 * @returns {{ errors: string[], bytes: number, urls: string[] | null }}
 */
export function checkWorker({ swSource, killSwitch, files }) {
  if (swSource === null) return { errors: ['sw.js: missing (the service worker was not built)'], bytes: 0, urls: null }
  if (killSwitch) {
    return isSelfDestroyingWorker(swSource)
      ? { errors: [], bytes: 0, urls: null }
      : { errors: ['sw.js: KOA_SW_KILL_SWITCH=1 but sw.js is not the self-destroying worker'], bytes: 0, urls: null }
  }
  if (isSelfDestroyingWorker(swSource)) {
    return { errors: ['sw.js: the self-destroying kill switch worker was built without KOA_SW_KILL_SWITCH=1'], bytes: 0, urls: null }
  }
  const urls = precacheUrls(swSource)
  return { ...checkPrecache(urls, files), urls }
}

/**
 * Reads the pixel size of a PNG or JPEG from its header (no decoding).
 * @param {Uint8Array} buf the file's bytes
 * @returns {{ format: 'png' | 'jpeg', width: number, height: number } | null} null when unreadable
 */
export function imageSize(buf) {
  const u16 = (i) => (buf[i] << 8) | buf[i + 1]
  const u32 = (i) => buf[i] * 0x1000000 + (buf[i + 1] << 16) + (buf[i + 2] << 8) + buf[i + 3]
  const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (buf.length >= 24 && PNG_SIGNATURE.every((b, i) => buf[i] === b)) {
    return { format: 'png', width: u32(16), height: u32(20) }
  }
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null
  let i = 2
  while (i + 3 < buf.length) {
    if (buf[i] !== 0xff) return null
    const marker = buf[i + 1]
    if (marker === 0xff) {
      i += 1 // fill byte
      continue
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      i += 2 // markers without a length
      continue
    }
    // Start of frame (every SOFn; C4 = DHT, C8 = JPG and CC = DAC are not frames).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (i + 9 > buf.length) return null
      return { format: 'jpeg', width: u16(i + 7), height: u16(i + 5) }
    }
    if (marker === 0xd9 || marker === 0xda) return null // end of image, or a scan before any frame
    i += 2 + u16(i + 2)
  }
  return null
}

/**
 * The startup image links in an HTML page.
 * @param {string} html
 * @returns {{ href: string | null, media: string | null }[]}
 */
export function splashLinks(html) {
  const tags = html.match(/<link\b[^>]*\brel=["']apple-touch-startup-image["'][^>]*>/gi) ?? []
  const attr = (tag, name) => tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'))?.[1] ?? null
  return tags.map((tag) => ({ href: attr(tag, 'href'), media: attr(tag, 'media') }))
}

/**
 * Parses a startup image media query in the form make_splash.py writes.
 * @param {string} media
 * @returns {{ deviceWidth: number, deviceHeight: number, dpr: number, orientation: string } | null}
 */
export function parseStartupMedia(media) {
  const m = media.match(
    /^\(device-width: (\d+)px\) and \(device-height: (\d+)px\) and \(-webkit-device-pixel-ratio: (\d+)\) and \(orientation: (portrait|landscape)\)$/,
  )
  if (!m) return null
  return { deviceWidth: Number(m[1]), deviceHeight: Number(m[2]), dpr: Number(m[3]), orientation: m[4] }
}

/**
 * Checks the iOS startup images: every link in index.html points to an existing JPEG or PNG in
 * splash/ whose pixel size matches its media query, every file in splash/ is linked, each file and
 * the total are within SPLASH_LIMITS, and none of them is precached.
 * @param {{
 *   html: string | null,
 *   splash: { path: string, bytes: number, format?: string, width?: number, height?: number }[],
 *   precached: string[] | null,
 * }} input html = dist/index.html; splash = the files in dist/splash/ with their header sizes
 * @returns {{ errors: string[], bytes: number, count: number }}
 */
export function checkSplash({ html, splash, precached }) {
  if (html === null) return { errors: ['index.html: missing'], bytes: 0, count: 0 }
  const errors = []
  const files = new Map(splash.map((f) => [f.path, f]))
  const linked = new Set()
  const medias = new Set()
  const links = splashLinks(html)
  if (links.length === 0) errors.push('index.html: no apple-touch-startup-image links')

  for (const { href, media } of links) {
    if (!href || !media) {
      errors.push(`index.html: startup image link without href or media (${href ?? media})`)
      continue
    }
    const path = href.replace(/^\//, '')
    if (!href.startsWith('/splash/')) errors.push(`${href}: startup images must be in /splash/`)
    if (linked.has(path)) errors.push(`${href}: linked twice`)
    linked.add(path)
    if (medias.has(media)) errors.push(`${href}: another startup image has the same media query`)
    medias.add(media)

    const query = parseStartupMedia(media)
    if (!query) {
      errors.push(`${href}: media query not recognized: ${media}`)
      continue
    }
    const f = files.get(path)
    if (!f) {
      errors.push(`${href}: linked from index.html but missing from the build`)
      continue
    }
    if (f.format !== 'jpeg' && f.format !== 'png') {
      errors.push(`${href}: not a readable JPEG or PNG`)
      continue
    }
    const { deviceWidth: w, deviceHeight: h, dpr, orientation } = query
    const [ew, eh] = orientation === 'portrait' ? [w * dpr, h * dpr] : [h * dpr, w * dpr]
    if (f.width !== ew || f.height !== eh) {
      errors.push(`${href}: image is ${f.width}x${f.height}, its media query needs ${ew}x${eh}`)
    }
  }

  let bytes = 0
  for (const f of splash) {
    bytes += f.bytes
    if (!linked.has(f.path)) errors.push(`${f.path}: not linked from index.html (stale splash image?)`)
    const tablet = Math.min(f.width ?? 0, f.height ?? 0) >= SPLASH_LIMITS.tabletShortSide
    const limit = tablet ? SPLASH_LIMITS.tabletBytes : SPLASH_LIMITS.phoneBytes
    if (f.bytes > limit) errors.push(`${f.path}: splash image is ${kB(f.bytes)}, limit ${kB(limit)}`)
  }
  if (bytes > SPLASH_LIMITS.totalBytes) {
    errors.push(`splash/: ${kB(bytes)} in total, limit ${kB(SPLASH_LIMITS.totalBytes)}`)
  }

  for (const url of precached ?? []) {
    const path = url.replace(/^\//, '')
    if (linked.has(path) || files.has(path)) {
      errors.push(`precache: ${path} is a splash image and must not be precached`)
    }
  }
  return { errors, bytes, count: splash.length }
}

export function kB(bytes) {
  return `${(bytes / 1000).toFixed(1)} kB`
}

function listFiles(root) {
  const out = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.isFile()) {
        out.push({ path: relative(root, full).split(sep).join('/'), bytes: statSync(full).size, full })
      }
    }
  }
  walk(root)
  return out.sort((a, b) => a.path.localeCompare(b.path))
}

function main(argv) {
  const root = resolve(argv[2] ?? 'dist')
  let files
  try {
    if (!statSync(root).isDirectory()) throw new Error('not a directory')
    files = listFiles(root)
  } catch {
    console.error(`check-build: ${root} not found. Run vite build first.`)
    return 1
  }

  const { errors, images } = checkFiles(files)

  const killSwitch = process.env.KOA_SW_KILL_SWITCH === '1'
  const sw = files.find((f) => f.path === 'sw.js')
  const precache = checkWorker({ swSource: sw ? readFileSync(sw.full, 'utf8') : null, killSwitch, files })
  const { urls } = precache
  errors.push(...precache.errors)

  const indexFile = files.find((f) => f.path === 'index.html')
  const splashFiles = files
    .filter((f) => f.path.startsWith('splash/'))
    .map((f) => ({ ...f, ...(imageSize(readFileSync(f.full)) ?? {}) }))
  const splash = checkSplash({
    html: indexFile ? readFileSync(indexFile.full, 'utf8') : null,
    splash: splashFiles,
    precached: urls,
  })
  errors.push(...splash.errors)

  const total = files.reduce((sum, f) => sum + f.bytes, 0)
  const gz = (ext) =>
    files
      .filter((f) => f.path.endsWith(ext))
      .reduce((sum, f) => sum + gzipSync(readFileSync(f.full)).length, 0)

  console.log(`check-build: ${files.length} files, ${kB(total)} total`)
  console.log(`  JS  gzip ${kB(gz('.js'))}`)
  console.log(`  CSS gzip ${kB(gz('.css'))}`)
  if (killSwitch) {
    console.warn('check-build: KILL SWITCH build. sw.js unregisters itself and deletes all Koa caches (no offline support).')
  } else {
    console.log(`  precache ${urls?.length ?? 0} entries, ${kB(precache.bytes)}`)
  }
  console.log(`  splash ${splash.count} startup images, ${kB(splash.bytes)} (not precached)`)
  for (const img of images.filter((i) => !i.path.startsWith('splash/'))) {
    console.log(`  image ${img.path} ${kB(img.bytes)}`)
  }

  if (errors.length > 0) {
    console.error(`check-build: FAILED (${errors.length})`)
    for (const e of errors) console.error(`  - ${e}`)
    return 1
  }
  console.log('check-build: OK')
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv)
}
