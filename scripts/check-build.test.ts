import { describe, expect, it } from 'vitest'
import {
  BUDGET,
  ICON_LIMITS,
  LIMITS,
  PRECACHE_FIXED,
  SPLASH_LIMITS,
  checkBudget,
  checkFiles,
  checkNotFoundPage,
  checkPrecache,
  checkSplash,
  checkWorker,
  entryScripts,
  imageSize,
  isSelfDestroyingWorker,
  parseStartupMedia,
  precacheUrls,
  splashLinks,
} from './check-build.mjs'

const file = (path: string, bytes = 1_000) => ({ path, bytes })

describe('checkFiles', () => {
  it('accepts the current shipped files', () => {
    const { errors } = checkFiles([
      file('index.html'),
      file('favicon.svg'),
      file('assets/index-abc123.js', 460_000),
      file('assets/index-abc123.css', 32_000),
      file('assets/fredoka-latin-wght-normal-abc.woff2', 40_000),
      file('characters/koa_idle_neutral.webp', 111_502),
      file('characters/koa_idle_neutral-512.webp', 34_250),
      file('characters/koa_idle_blink.webp', 111_848),
      file('characters/koa_idle_blink-512.webp', 34_620),
    ])
    expect(errors).toEqual([])
  })

  it('rejects the design sheet in its old place', () => {
    const { errors } = checkFiles([file('characters/reference/koala-design-sheet.png', 2_092_884)])
    expect(errors.some((e) => e.includes('reference files must not ship'))).toBe(true)
  })

  it('rejects anything under a reference directory, at any depth', () => {
    expect(checkFiles([file('reference/notes.txt')]).errors).toHaveLength(1)
    expect(checkFiles([file('a/b/Reference/x.webp')]).errors).toHaveLength(1)
  })

  it('rejects the design sheet by name anywhere, in any format', () => {
    expect(checkFiles([file('koala-design-sheet.png', 10)]).errors).toHaveLength(1)
    expect(checkFiles([file('assets/Koala-Design-Sheet.webp', 10)]).errors).toHaveLength(1)
  })

  it('does not reject names that merely contain "reference"', () => {
    expect(checkFiles([file('references.json'), file('assets/reference-abc.js')]).errors).toEqual([])
  })

  it('limits character frames to 150 kB', () => {
    const at = checkFiles([file('characters/koa.webp', LIMITS.characterFrameBytes)])
    const over = checkFiles([file('characters/koa.webp', LIMITS.characterFrameBytes + 1)])
    expect(at.errors).toEqual([])
    expect(over.errors[0]).toContain('character frame')
  })

  it('does not apply the character limit outside characters/', () => {
    expect(checkFiles([file('icons/icon-512.png', 200_000)]).errors).toEqual([])
  })

  it('accepts the generated app icons at their sizes', () => {
    const { errors } = checkFiles([
      file('icons/apple-touch-icon-180.png', 43_800),
      file('icons/icon-192.png', 49_400),
      file('icons/icon-512.png', 350_700),
      file('icons/icon-maskable-512.png', 215_000),
      file('icons/badge-96.png', 2_400),
    ])
    expect(errors).toEqual([])
  })

  it('limits each app icon by its own limit, instead of the PNG limit', () => {
    for (const [name, limit] of Object.entries(ICON_LIMITS)) {
      expect(checkFiles([file(`icons/${name}`, limit)]).errors).toEqual([])
      expect(checkFiles([file(`icons/${name}`, limit + 1)]).errors[0]).toContain('icon is')
    }
  })

  it('rejects an icon without a limit, and still limits PNGs in nested or other folders', () => {
    expect(checkFiles([file('icons/new-icon.png', 10)]).errors[0]).toContain('no size limit')
    expect(checkFiles([file('icons/toString', 10)]).errors[0]).toContain('no size limit')
    expect(checkFiles([file('icons/old/icon-512.png', 350_700)]).errors[0]).toContain('PNG is')
    expect(checkFiles([file('splash/icon-512.png', 350_700)]).errors[0]).toContain('PNG is')
  })

  it('rejects any PNG over 300 kB', () => {
    expect(checkFiles([file('splash/a.png', LIMITS.pngBytes)]).errors).toEqual([])
    expect(checkFiles([file('splash/a.png', LIMITS.pngBytes + 1)]).errors[0]).toContain('PNG is')
    expect(checkFiles([file('photo.PNG', 400_000)]).errors).toHaveLength(1)
  })

  it('does not apply the PNG limit to other file types', () => {
    expect(checkFiles([file('assets/index.js', 400_000)]).errors).toEqual([])
  })

  it('lists images for the report', () => {
    const { images } = checkFiles([file('index.html'), file('favicon.svg', 500), file('characters/a.webp')])
    expect(images.map((i) => i.path)).toEqual(['favicon.svg', 'characters/a.webp'])
  })
})

describe('precacheUrls', () => {
  it('reads the list workbox-build injects into sw.js', () => {
    const sw =
      'let a=1;W([{"revision":"4cc10e3e","url":"index.html"},{"revision":null,"url":"assets/index-abc.js"}]);' +
      'self.addEventListener(`message`,()=>{})'
    expect(precacheUrls(sw)).toEqual(['index.html', 'assets/index-abc.js'])
  })

  it('returns null when there is no list (the placeholder was not replaced)', () => {
    expect(precacheUrls('precacheAndRoute(self.__WB_MANIFEST)')).toBeNull()
    expect(precacheUrls('')).toBeNull()
  })
})

describe('checkNotFoundPage', () => {
  it('accepts a build with the top-level 404.html', () => {
    expect(checkNotFoundPage([file('index.html'), file('404.html')])).toEqual([])
  })

  it('fails without it, including when it only exists in a subfolder', () => {
    for (const files of [[file('index.html')], [file('index.html'), file('assets/404.html')]]) {
      const errors = checkNotFoundPage(files)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toContain('404.html: missing')
    }
  })
})

describe('checkPrecache', () => {
  /** A build like today's: shell, hashed assets, the 4 frames, plus files that are never precached. */
  const build = [
    ...PRECACHE_FIXED.map((p) => file(p, 10_000)),
    file('assets/index-abc.js', 460_000),
    file('assets/workbox-window.prod.es5-abc.js', 5_000),
    file('assets/index-abc.css', 32_000),
    file('assets/fredoka-latin-wght-normal-abc.woff2', 30_000),
    file('assets/nunito-sans-latin-wght-normal-abc.woff2', 31_000),
    file('icons/icon-192.png', 49_000),
    file('icons/icon-512.png', 350_000),
    file('sw.js', 16_000),
  ]
  const good = [
    ...PRECACHE_FIXED,
    'assets/index-abc.js',
    'assets/workbox-window.prod.es5-abc.js',
    'assets/index-abc.css',
    'assets/fredoka-latin-wght-normal-abc.woff2',
    'assets/nunito-sans-latin-wght-normal-abc.woff2',
  ]

  it('accepts exactly the expected entries and sums their size', () => {
    const { errors, bytes } = checkPrecache(good, build)
    expect(errors).toEqual([])
    expect(bytes).toBe(7 * 10_000 + 460_000 + 5_000 + 32_000 + 30_000 + 31_000)
  })

  it('fails without a precache list', () => {
    expect(checkPrecache(null, build).errors[0]).toContain('no precache list')
    expect(checkPrecache([], build).errors[0]).toContain('no precache list')
  })

  it('requires the shell, the manifest, the favicon and every Koa frame', () => {
    for (const fixed of PRECACHE_FIXED) {
      const { errors } = checkPrecache(
        good.filter((u) => u !== fixed),
        build,
      )
      expect(errors).toEqual([`precache: ${fixed} is missing (needed offline)`])
    }
  })

  it('requires every JS, CSS and font file in assets/', () => {
    const { errors } = checkPrecache(
      good.filter((u) => u !== 'assets/nunito-sans-latin-wght-normal-abc.woff2'),
      build,
    )
    expect(errors).toEqual(['precache: assets/nunito-sans-latin-wght-normal-abc.woff2 is missing (needed offline)'])
  })

  it('fails when there is no JS, CSS or font at all', () => {
    const shellOnly = build.filter((f) => !f.path.startsWith('assets/'))
    const { errors } = checkPrecache([...PRECACHE_FIXED], shellOnly)
    expect(errors).toEqual([
      'precache: no .js file from assets/',
      'precache: no .css file from assets/',
      'precache: no .woff2 file from assets/',
    ])
  })

  it('rejects icons, splash screens, reference files, source maps, the worker and _headers', () => {
    const extra = [
      'icons/icon-512.png',
      'splash/iphone-1179x2556.png',
      'characters/reference/koala-design-sheet.png',
      'assets/index-abc.js.map',
      'sw.js',
      '_headers',
    ]
    const files = [...build, ...extra.map((p) => file(p))]
    const { errors } = checkPrecache([...good, ...extra], files)
    expect(errors).toHaveLength(extra.length)
    for (const [i, url] of extra.entries()) expect(errors[i]).toContain(`${url} must not be precached`)
  })

  it('rejects anything else that is not expected', () => {
    const files = [...build, file('robots.txt'), file('characters/koa_new_pose.webp'), file('404.html')]
    const { errors } = checkPrecache([...good, 'robots.txt', 'characters/koa_new_pose.webp', '404.html'], files)
    expect(errors).toEqual([
      'precache: robots.txt is not an expected entry',
      'precache: characters/koa_new_pose.webp is not an expected entry',
      'precache: 404.html is not an expected entry',
    ])
  })

  it('rejects entries that are not in the build and duplicates', () => {
    expect(checkPrecache([...good, 'assets/gone-old.js'], build).errors).toEqual([
      'precache: assets/gone-old.js is not an expected entry',
      'precache: assets/gone-old.js is not in the build',
    ])
    expect(checkPrecache([...good, 'index.html'], build).errors).toEqual(['precache: index.html is listed twice'])
  })
})

describe('kill switch worker', () => {
  /** The plugin's self-destroying worker, as vite-plugin-pwa 2.0 writes it (abridged). */
  const selfDestroying = `
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  self.registration.unregister()
    .then(() => self.clients.matchAll())
    .then(() => { self.caches.keys().then((names) => Promise.all(names.map((n) => self.caches.delete(n)))) })
});`
  const normal = 'W([{"revision":"4cc10e3e","url":"index.html"}]);self.addEventListener(`message`,()=>{})'

  it('recognizes the self-destroying worker', () => {
    expect(isSelfDestroyingWorker(selfDestroying)).toBe(true)
    expect(isSelfDestroyingWorker(normal)).toBe(false)
    expect(isSelfDestroyingWorker(normal + 'self.registration.unregister();caches.delete(x)')).toBe(false)
  })

  it('a kill switch build passes only with the self-destroying worker', () => {
    expect(checkWorker({ swSource: selfDestroying, killSwitch: true, files: [] }).errors).toEqual([])
    expect(checkWorker({ swSource: normal, killSwitch: true, files: [] }).errors[0]).toContain('not the self-destroying')
  })

  it('a normal build fails with the self-destroying worker', () => {
    expect(checkWorker({ swSource: selfDestroying, killSwitch: false, files: [] }).errors[0]).toContain(
      'without KOA_SW_KILL_SWITCH=1',
    )
  })

  it('a missing worker fails either way', () => {
    expect(checkWorker({ swSource: null, killSwitch: false, files: [] }).errors[0]).toContain('missing')
    expect(checkWorker({ swSource: null, killSwitch: true, files: [] }).errors[0]).toContain('missing')
  })

  it('a normal build checks the precache list', () => {
    const { errors, urls } = checkWorker({ swSource: normal, killSwitch: false, files: [] })
    expect(urls).toEqual(['index.html'])
    expect(errors.length).toBeGreaterThan(0)
  })
})

describe('imageSize', () => {
  const png = (w: number, h: number) => {
    const b = new Uint8Array(33)
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])
    const view = new DataView(b.buffer)
    view.setUint32(16, w)
    view.setUint32(20, h)
    return b
  }
  /** SOI, an APP0 segment, a fill byte, then a frame header (SOF0 or SOF2) with the size. */
  const jpeg = (w: number, h: number, sof = 0xc0) =>
    new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x06, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xff, sof, 0x00, 0x11, 0x08, h >> 8,
      h & 0xff, w >> 8, w & 0xff, 0x03,
    ])

  it('reads PNG and JPEG (baseline and progressive) headers', () => {
    expect(imageSize(png(1179, 2556))).toEqual({ format: 'png', width: 1179, height: 2556 })
    expect(imageSize(jpeg(2752, 2064))).toEqual({ format: 'jpeg', width: 2752, height: 2064 })
    expect(imageSize(jpeg(750, 1334, 0xc2))).toEqual({ format: 'jpeg', width: 750, height: 1334 })
  })

  it('returns null for anything else', () => {
    expect(imageSize(new TextEncoder().encode('<svg></svg>'))).toBeNull()
    expect(imageSize(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toBeNull()
    expect(imageSize(jpeg(10, 10).slice(0, 14))).toBeNull()
    expect(imageSize(new Uint8Array())).toBeNull()
  })
})

describe('startup image links', () => {
  const media =
    '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)'

  it('finds the links with their href and media, in any attribute order', () => {
    const html = `<link rel="apple-touch-icon" href="/icons/a.png" />
      <link rel="apple-touch-startup-image" media="${media}" href="/splash/a.jpg" />
      <link href="/splash/b.jpg" rel="apple-touch-startup-image">`
    expect(splashLinks(html)).toEqual([
      { href: '/splash/a.jpg', media },
      { href: '/splash/b.jpg', media: null },
    ])
  })

  it('parses the media query make_splash.py writes', () => {
    expect(parseStartupMedia(media)).toEqual({ deviceWidth: 390, deviceHeight: 844, dpr: 3, orientation: 'portrait' })
    expect(parseStartupMedia(media.replace('portrait', 'landscape'))?.orientation).toBe('landscape')
    expect(parseStartupMedia('(device-width: 390px)')).toBeNull()
  })
})

describe('checkSplash', () => {
  const q = (w: number, h: number, dpr: number, o: string) =>
    `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: ${o})`
  const link = (href: string, media: string) =>
    `<link rel="apple-touch-startup-image" media="${media}" href="${href}" />`
  const html = [
    link('/splash/koa-splash-1170x2532.jpg', q(390, 844, 3, 'portrait')),
    link('/splash/koa-splash-1640x2360.jpg', q(820, 1180, 2, 'portrait')),
    link('/splash/koa-splash-2360x1640.jpg', q(820, 1180, 2, 'landscape')),
  ].join('\n')
  const img = (path: string, width: number, height: number, bytes = 100_000) => ({
    path,
    bytes,
    format: 'jpeg',
    width,
    height,
  })
  const splash = [
    img('splash/koa-splash-1170x2532.jpg', 1170, 2532, 95_500),
    img('splash/koa-splash-1640x2360.jpg', 1640, 2360, 161_100),
    img('splash/koa-splash-2360x1640.jpg', 2360, 1640, 161_100),
  ]
  const precached = [...PRECACHE_FIXED]

  it('accepts linked images of the right size, and sums them', () => {
    expect(checkSplash({ html, splash, precached })).toEqual({ errors: [], bytes: 417_700, count: 3 })
  })

  it('fails without index.html or without links', () => {
    expect(checkSplash({ html: null, splash, precached }).errors).toEqual(['index.html: missing'])
    expect(checkSplash({ html: '<title>Koa</title>', splash: [], precached }).errors).toEqual([
      'index.html: no apple-touch-startup-image links',
    ])
  })

  it('fails when a linked image is missing from the build', () => {
    expect(checkSplash({ html, splash: splash.slice(1), precached }).errors).toEqual([
      '/splash/koa-splash-1170x2532.jpg: linked from index.html but missing from the build',
    ])
  })

  it('fails when an image does not match its media query (size or orientation)', () => {
    const swapped = [splash[0], img('splash/koa-splash-1640x2360.jpg', 2360, 1640), splash[2]]
    expect(checkSplash({ html, splash: swapped, precached }).errors).toEqual([
      '/splash/koa-splash-1640x2360.jpg: image is 2360x1640, its media query needs 1640x2360',
    ])
  })

  it('fails for an unreadable image, an unknown media query, a link outside /splash/ and duplicates', () => {
    const unreadable = [{ path: 'splash/koa-splash-1170x2532.jpg', bytes: 10 }, ...splash.slice(1)]
    expect(checkSplash({ html, splash: unreadable, precached }).errors).toEqual([
      '/splash/koa-splash-1170x2532.jpg: not a readable JPEG or PNG',
    ])
    const odd = html + link('/splash/x.jpg', '(min-width: 1px)') + link('/icons/y.jpg', q(1, 1, 1, 'portrait'))
    expect(checkSplash({ html: odd, splash, precached }).errors).toEqual([
      '/splash/x.jpg: media query not recognized: (min-width: 1px)',
      '/icons/y.jpg: startup images must be in /splash/',
      '/icons/y.jpg: linked from index.html but missing from the build',
    ])
    const twice = html + link('/splash/koa-splash-1170x2532.jpg', q(1, 1, 1, 'landscape'))
    expect(checkSplash({ html: twice, splash, precached }).errors[0]).toContain('linked twice')
    const sameMedia = html + link('/splash/z.jpg', q(390, 844, 3, 'portrait'))
    expect(checkSplash({ html: sameMedia, splash, precached }).errors[0]).toContain('same media query')
  })

  it('fails for a stale image that is not linked', () => {
    const stale = [...splash, img('splash/koa-splash-1080x1920.jpg', 1080, 1920)]
    expect(checkSplash({ html, splash: stale, precached }).errors).toEqual([
      'splash/koa-splash-1080x1920.jpg: not linked from index.html (stale splash image?)',
    ])
  })

  it('limits phone and tablet images by their own limits, and the total', () => {
    const phone = (bytes: number) => [img('splash/koa-splash-1170x2532.jpg', 1170, 2532, bytes), ...splash.slice(1)]
    expect(checkSplash({ html, splash: phone(SPLASH_LIMITS.phoneBytes), precached }).errors).toEqual([])
    expect(checkSplash({ html, splash: phone(SPLASH_LIMITS.phoneBytes + 1), precached }).errors).toEqual([
      'splash/koa-splash-1170x2532.jpg: splash image is 160.0 kB, limit 160.0 kB',
    ])
    const tablet = (bytes: number) => [splash[0], img('splash/koa-splash-1640x2360.jpg', 1640, 2360, bytes), splash[2]]
    expect(checkSplash({ html, splash: tablet(SPLASH_LIMITS.tabletBytes), precached }).errors).toEqual([])
    expect(checkSplash({ html, splash: tablet(SPLASH_LIMITS.tabletBytes + 1), precached }).errors).toHaveLength(1)
    const big = splash.map((f) => ({ ...f, bytes: SPLASH_LIMITS.totalBytes / 2 }))
    expect(checkSplash({ html, splash: big, precached }).errors.at(-1)).toContain('in total')
  })

  it('fails when a splash image is precached', () => {
    const { errors } = checkSplash({ html, splash, precached: [...precached, 'splash/koa-splash-2360x1640.jpg'] })
    expect(errors).toEqual(['precache: splash/koa-splash-2360x1640.jpg is a splash image and must not be precached'])
  })

  it('accepts a kill switch build (no precache list)', () => {
    expect(checkSplash({ html, splash, precached: null }).errors).toEqual([])
  })
})

describe('entryScripts', () => {
  it('finds the module script Vite writes, and modulepreloads', () => {
    const html = [
      '<script type="module" crossorigin src="/assets/index-abc.js"></script>',
      '<link rel="modulepreload" crossorigin href="/assets/vendor-def.js">',
      '<link rel="stylesheet" crossorigin href="/assets/index-abc.css">',
      '<link rel="preload" as="image" href="/characters/koa_idle_neutral.webp">',
    ].join('\n')
    expect(entryScripts(html)).toEqual(['assets/index-abc.js', 'assets/vendor-def.js'])
  })

  it('ignores classic and external scripts, and lists a file once', () => {
    const html = [
      '<script src="/legacy.js"></script>',
      '<script type="module" src="https://example.com/x.js"></script>',
      '<script type="module" src="//cdn.example.com/y.js"></script>',
      '<script type="module" src="/assets/index-abc.js"></script>',
      '<link rel="modulepreload" href="/assets/index-abc.js">',
    ].join('\n')
    expect(entryScripts(html)).toEqual(['assets/index-abc.js'])
  })

  it('returns nothing for a page without module scripts', () => {
    expect(entryScripts('<html><body></body></html>')).toEqual([])
  })
})

describe('checkBudget', () => {
  const ok = { entryJs: ['assets/index-abc.js'], entryJsGzip: 151_206, cssGzip: 7_800, precacheBytes: 966_300 }

  it('uses the approved budget (D12)', () => {
    expect(BUDGET).toEqual({ entryJsGzipBytes: 160_000, cssGzipBytes: 12_000, precacheBytes: 1_200_000 })
  })

  it('accepts the current build', () => {
    expect(checkBudget(ok)).toEqual([])
  })

  it('accepts each size exactly at its limit', () => {
    expect(
      checkBudget({ ...ok, entryJsGzip: BUDGET.entryJsGzipBytes, cssGzip: BUDGET.cssGzipBytes, precacheBytes: BUDGET.precacheBytes }),
    ).toEqual([])
  })

  it('fails when the entry JS is over budget', () => {
    expect(checkBudget({ ...ok, entryJsGzip: BUDGET.entryJsGzipBytes + 1 })).toEqual([
      'budget: entry JS is 160.0 kB gzip, limit 160.0 kB',
    ])
  })

  it('fails when the CSS is over budget', () => {
    expect(checkBudget({ ...ok, cssGzip: 12_400 })).toEqual(['budget: CSS is 12.4 kB gzip, limit 12.0 kB'])
  })

  it('fails when the precache is over budget, but not in a kill switch build (no precache)', () => {
    expect(checkBudget({ ...ok, precacheBytes: 1_250_000 })).toEqual(['budget: precache is 1250.0 kB, limit 1200.0 kB'])
    expect(checkBudget({ ...ok, precacheBytes: null })).toEqual([])
  })

  it('fails when no entry script was found, so the JS budget cannot be skipped by accident', () => {
    expect(checkBudget({ ...ok, entryJs: [], entryJsGzip: 0 })).toEqual([
      'index.html: no module script found (entry JS budget)',
    ])
  })

  it('reports every row that is over budget', () => {
    expect(checkBudget({ entryJs: ['a.js'], entryJsGzip: 200_000, cssGzip: 20_000, precacheBytes: 2_000_000 })).toHaveLength(3)
  })
})
