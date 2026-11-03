import { describe, expect, it, vi } from 'vitest'
import type { InstallBrowser } from '../../core/pwa/install'
import { createInstallStore, type DeferredInstallPrompt, type InstallEnv } from './installStore'

/** A mock browser that can fire install events and change display mode. */
function setup({ supported = true, browser = 'chromium-desktop' as InstallBrowser, standalone = false } = {}) {
  const page = { standalone }
  let firePrompt: ((e: DeferredInstallPrompt) => void) | undefined
  let fireInstalled: (() => void) | undefined
  let fireDisplay: (() => void) | undefined
  const env: InstallEnv = {
    supported,
    browser,
    isStandalone: () => page.standalone,
    onBeforeInstallPrompt: (cb) => {
      firePrompt = cb
      return () => (firePrompt = undefined)
    },
    onAppInstalled: (cb) => {
      fireInstalled = cb
      return () => (fireInstalled = undefined)
    },
    onDisplayModeChange: (cb) => {
      fireDisplay = cb
      return () => (fireDisplay = undefined)
    },
  }
  const store = createInstallStore({ env })
  return {
    store,
    page,
    firePrompt: (e: DeferredInstallPrompt) => firePrompt?.(e),
    fireInstalled: () => fireInstalled?.(),
    fireDisplay: () => fireDisplay?.(),
    listening: () => firePrompt !== undefined,
  }
}

/** A captured `beforeinstallprompt` whose user choice we control. */
function promptEvent(outcome: 'accepted' | 'dismissed' = 'accepted') {
  let choose: (o: { outcome: 'accepted' | 'dismissed' }) => void = () => {}
  const userChoice = new Promise<{ outcome: 'accepted' | 'dismissed' }>((resolve) => {
    choose = resolve
  })
  const event = {
    prompt: vi.fn(() => {
      choose({ outcome })
      return Promise.resolve()
    }),
    userChoice,
  }
  return event
}

describe('install store', () => {
  it('shows the menu steps in Chromium until a prompt is captured, then the Install button', () => {
    const t = setup()
    t.store.start()
    expect(t.store.getState()).toEqual({ help: 'menu', prompting: false })
    const listener = vi.fn()
    t.store.subscribe(listener)
    t.firePrompt(promptEvent())
    expect(t.store.getState().help).toBe('prompt-available')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('never opens the prompt on its own: capturing the event does not call prompt()', () => {
    const t = setup()
    t.store.start()
    const event = promptEvent()
    t.firePrompt(event)
    t.fireDisplay()
    expect(event.prompt).not.toHaveBeenCalled()
  })

  it('install() opens the captured prompt once and says installed when accepted', async () => {
    const t = setup()
    t.store.start()
    const event = promptEvent('accepted')
    t.firePrompt(event)
    const done = t.store.install()
    expect(t.store.getState()).toEqual({ help: 'prompt-available', prompting: true })
    await done
    expect(event.prompt).toHaveBeenCalledTimes(1)
    expect(t.store.getState()).toEqual({ help: 'accepted', prompting: false })
  })

  it('uses the event only once: a second tap does nothing, and a dismissal falls back to the menu', async () => {
    const t = setup()
    t.store.start()
    const event = promptEvent('dismissed')
    t.firePrompt(event)
    await Promise.all([t.store.install(), t.store.install()])
    await t.store.install()
    expect(event.prompt).toHaveBeenCalledTimes(1)
    expect(t.store.getState()).toEqual({ help: 'menu', prompting: false })
  })

  it('offers a new prompt if the browser hands over another event later', async () => {
    const t = setup()
    t.store.start()
    t.firePrompt(promptEvent('dismissed'))
    await t.store.install()
    const second = promptEvent('accepted')
    t.firePrompt(second)
    expect(t.store.getState().help).toBe('prompt-available')
    await t.store.install()
    expect(second.prompt).toHaveBeenCalledTimes(1)
  })

  it('survives a prompt() that throws (stale event)', async () => {
    const t = setup()
    t.store.start()
    const event = { prompt: vi.fn(() => Promise.reject(new Error('InvalidStateError'))), userChoice: new Promise<never>(() => {}) }
    t.firePrompt(event)
    await t.store.install()
    expect(t.store.getState()).toEqual({ help: 'menu', prompting: false })
  })

  it('without a captured event, install() does nothing', async () => {
    const t = setup()
    t.store.start()
    await t.store.install()
    expect(t.store.getState()).toEqual({ help: 'menu', prompting: false })
  })

  it('appinstalled (e.g. from the address bar) drops the event and says installed', () => {
    const t = setup()
    t.store.start()
    const event = promptEvent()
    t.firePrompt(event)
    t.fireInstalled()
    expect(t.store.getState().help).toBe('accepted')
    void t.store.install()
    expect(event.prompt).not.toHaveBeenCalled()
  })

  it('hides the row when the page is (or becomes) the installed app', () => {
    expect(setup({ standalone: true }).store.getState().help).toBe('installed')
    const t = setup()
    t.store.start()
    t.page.standalone = true
    t.fireDisplay()
    expect(t.store.getState().help).toBe('installed')
  })

  it('shows the iPhone steps on apple-mobile, and stays hidden where unsupported', () => {
    expect(setup({ browser: 'apple-mobile' }).store.getState().help).toBe('ios-steps')
    const unsupported = setup({ supported: false })
    unsupported.store.start()
    expect(unsupported.listening()).toBe(false)
    expect(unsupported.store.getState().help).toBe('hidden')
  })

  it('starts listening once, and stop() detaches', () => {
    const t = setup()
    t.store.start()
    t.store.start()
    expect(t.listening()).toBe(true)
    t.store.stop()
    expect(t.listening()).toBe(false)
  })

  it('a broken listener does not stop the store', () => {
    const t = setup()
    t.store.start()
    t.store.subscribe(() => {
      throw new Error('boom')
    })
    t.firePrompt(promptEvent())
    expect(t.store.getState().help).toBe('prompt-available')
  })
})
