import { describe, expect, it } from 'vitest'
import { detectInstallBrowser, installHelp, isAppleMobileAgent, type InstallInput } from './install'

const base: InstallInput = {
  supported: true,
  standalone: false,
  browser: 'chromium-desktop',
  promptAvailable: false,
  accepted: false,
}

describe('installHelp', () => {
  it('hides the row in the installed app, whatever else is true', () => {
    expect(installHelp({ ...base, standalone: true, promptAvailable: true, accepted: true })).toBe('installed')
    expect(installHelp({ ...base, standalone: true, supported: false })).toBe('installed')
    expect(installHelp({ ...base, standalone: true, browser: 'apple-mobile' })).toBe('installed')
  })

  it('hides the row where Koa cannot be installed (dev build, insecure context)', () => {
    expect(installHelp({ ...base, supported: false, promptAvailable: true })).toBe('hidden')
    expect(installHelp({ ...base, supported: false, browser: 'apple-mobile' })).toBe('hidden')
  })

  it('offers the Install button while a captured prompt is held', () => {
    expect(installHelp({ ...base, promptAvailable: true })).toBe('prompt-available')
    expect(installHelp({ ...base, browser: 'chromium-android', promptAvailable: true })).toBe('prompt-available')
  })

  it('says it is installed after the user accepted, even if a new prompt arrives', () => {
    expect(installHelp({ ...base, accepted: true })).toBe('accepted')
    expect(installHelp({ ...base, accepted: true, promptAvailable: true })).toBe('accepted')
  })

  it('shows Share → Add to Home Screen on iPhone and iPad', () => {
    expect(installHelp({ ...base, browser: 'apple-mobile' })).toBe('ios-steps')
  })

  it('names the menu in browsers that install from it', () => {
    for (const browser of ['chromium-desktop', 'chromium-android', 'firefox-android', 'safari-mac'] as const) {
      expect(installHelp({ ...base, browser })).toBe('menu')
    }
  })

  it('hides the row in other browsers (e.g. Firefox on desktop)', () => {
    expect(installHelp({ ...base, browser: 'other' })).toBe('hidden')
  })
})

const UA = {
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.0.0 Mobile/15E148 Safari/604.1',
  ipadDesktopMode:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
  macChrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
  androidFirefox: 'Mozilla/5.0 (Android 14; Mobile; rv:140.0) Gecko/140.0 Firefox/140.0',
  windowsFirefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0',
  windowsEdge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0',
}

describe('detectInstallBrowser', () => {
  const detect = (userAgent: string, maxTouchPoints = 0, hasBeforeInstallPrompt = false) =>
    detectInstallBrowser({ userAgent, maxTouchPoints, hasBeforeInstallPrompt })

  it('treats every browser on iPhone and iPad as apple-mobile (including iPad desktop mode)', () => {
    expect(detect(UA.iphone, 5)).toBe('apple-mobile')
    expect(detect(UA.iphoneChrome, 5)).toBe('apple-mobile')
    expect(detect(UA.ipadDesktopMode, 5)).toBe('apple-mobile')
  })

  it('recognizes Chromium by its beforeinstallprompt support, on desktop and Android', () => {
    expect(detect(UA.macChrome, 0, true)).toBe('chromium-desktop')
    expect(detect(UA.windowsEdge, 0, true)).toBe('chromium-desktop')
    expect(detect(UA.androidChrome, 5, true)).toBe('chromium-android')
  })

  it('recognizes Safari on a Mac (no touch) and Firefox on Android', () => {
    expect(detect(UA.macSafari, 0)).toBe('safari-mac')
    expect(detect(UA.androidFirefox, 5)).toBe('firefox-android')
  })

  it('falls back to other (Firefox on desktop, a Chrome UA without the event)', () => {
    expect(detect(UA.windowsFirefox)).toBe('other')
    expect(detect(UA.macChrome, 0, false)).toBe('other')
  })

  it('isAppleMobileAgent matches the notifications rule', () => {
    expect(isAppleMobileAgent(UA.iphone, 5)).toBe(true)
    expect(isAppleMobileAgent(UA.macSafari, 0)).toBe(false)
    expect(isAppleMobileAgent(UA.macSafari, 5)).toBe(true)
  })
})
