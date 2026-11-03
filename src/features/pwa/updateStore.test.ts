import { afterEach, describe, expect, it, vi } from 'vitest'
import { createUpdateStore, type UpdateEnv } from './updateStore'

const HOUR = 60 * 60 * 1000

/** A mock browser with a controllable clock, connectivity and worker hand-over. */
function setup({ activate = () => Promise.resolve() }: { activate?: () => Promise<void> } = {}) {
  const page = { online: true, checks: 0, activations: 0, reloads: 0, clock: 1_000_000 }
  let rejectCheck = false
  const env: UpdateEnv = {
    isOnline: () => page.online,
    check: () => {
      page.checks += 1
      return rejectCheck ? Promise.reject(new TypeError('Failed to fetch')) : Promise.resolve()
    },
    activate: () => {
      page.activations += 1
      return activate()
    },
    reload: () => {
      page.reloads += 1
    },
  }
  const store = createUpdateStore({ env, now: () => page.clock, checkIntervalMs: HOUR, activateTimeoutMs: 5000 })
  return {
    store,
    page,
    env,
    failChecks: (on: boolean) => {
      rejectCheck = on
    },
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('update store: state', () => {
  it('starts with no update', () => {
    expect(setup().store.getState()).toEqual({ state: 'none', dismissed: false })
  })

  it('becomes ready only when a new version is reported', () => {
    const { store } = setup()
    store.ready()
    expect(store.getState().state).toBe('ready')
  })

  it('ignores repeated reports', () => {
    const { store } = setup()
    const seen: string[] = []
    store.subscribe(() => seen.push(store.getState().state))
    store.ready()
    store.ready()
    expect(seen).toEqual(['ready'])
  })

  it('update() does nothing until an update is ready', async () => {
    const { store, page } = setup()
    await store.update()
    expect(page.activations).toBe(0)
    expect(page.reloads).toBe(0)
    expect(store.getState().state).toBe('none')
  })
})

describe('update store: applying', () => {
  it('hands over to the new worker once and reloads once', async () => {
    const { store, page } = setup()
    store.ready()
    const seen: string[] = []
    store.subscribe(() => seen.push(store.getState().state))
    const first = store.update()
    const second = store.update() // a double tap
    expect(store.getState().state).toBe('updating')
    await Promise.all([first, second])
    expect(page.activations).toBe(1)
    expect(page.reloads).toBe(1)
    expect(seen).toEqual(['updating'])
  })

  it('never reloads before the new worker has taken over', async () => {
    let takeOver: () => void = () => {}
    const { store, page } = setup({ activate: () => new Promise<void>((resolve) => (takeOver = resolve)) })
    store.ready()
    const pending = store.update()
    await Promise.resolve()
    expect(page.reloads).toBe(0)
    takeOver()
    await pending
    expect(page.reloads).toBe(1)
  })

  it('a failing hand-over returns to ready without reloading', async () => {
    const { store, page } = setup({ activate: () => Promise.reject(new Error('redundant')) })
    store.ready()
    await store.update()
    expect(store.getState().state).toBe('ready')
    expect(page.reloads).toBe(0)
  })

  it('a hand-over that throws synchronously returns to ready', async () => {
    const { store, page } = setup({
      activate: () => {
        throw new Error('no registration')
      },
    })
    store.ready()
    await expect(store.update()).resolves.toBeUndefined()
    expect(store.getState().state).toBe('ready')
    expect(page.reloads).toBe(0)
  })

  it('a hand-over that never finishes times out back to ready', async () => {
    vi.useFakeTimers()
    const { store, page } = setup({ activate: () => new Promise<void>(() => {}) })
    store.ready()
    const pending = store.update()
    await vi.advanceTimersByTimeAsync(4999)
    expect(store.getState().state).toBe('updating')
    await vi.advanceTimersByTimeAsync(1)
    await pending
    expect(store.getState().state).toBe('ready')
    expect(page.reloads).toBe(0)
  })

  it('can be retried after a failure', async () => {
    let fail = true
    const { store, page } = setup({ activate: () => (fail ? Promise.reject(new Error('x')) : Promise.resolve()) })
    store.ready()
    await store.update()
    fail = false
    await store.update()
    expect(page.activations).toBe(2)
    expect(page.reloads).toBe(1)
  })

  it('a reload that throws returns to ready', async () => {
    const { store, env } = setup()
    env.reload = () => {
      throw new Error('blocked')
    }
    store.ready()
    await store.update()
    expect(store.getState().state).toBe('ready')
  })
})

describe('update store: Later', () => {
  it('hides the prompt for this launch and keeps the update ready', () => {
    const { store } = setup()
    store.ready()
    store.later()
    expect(store.getState()).toEqual({ state: 'ready', dismissed: true })
  })

  it('stays hidden when the update is reported again', () => {
    const { store } = setup()
    store.ready()
    store.later()
    store.ready()
    expect(store.getState().dismissed).toBe(true)
  })
})

describe('update store: checks', () => {
  it('checks on launch, then at most once an hour', async () => {
    const { store, page } = setup()
    await store.check()
    expect(page.checks).toBe(1)
    page.clock += HOUR - 1
    await store.check()
    expect(page.checks).toBe(1)
    page.clock += 1
    await store.check()
    expect(page.checks).toBe(2)
  })

  it('skips checks while offline, and an offline attempt does not count', async () => {
    const { store, page } = setup()
    page.online = false
    await store.check()
    expect(page.checks).toBe(0)
    page.online = true
    await store.check()
    expect(page.checks).toBe(1)
  })

  it('a failed check is caught and counts toward the hour', async () => {
    const { store, page, failChecks } = setup()
    failChecks(true)
    await expect(store.check()).resolves.toBeUndefined()
    expect(page.checks).toBe(1)
    await store.check()
    expect(page.checks).toBe(1)
    expect(store.getState().state).toBe('none')
  })

  it('never runs two checks at once', async () => {
    const { store, page } = setup()
    page.clock = 0
    const a = store.check()
    page.clock = 2 * HOUR
    const b = store.check()
    await Promise.all([a, b])
    expect(page.checks).toBe(1)
  })

  it('does not check while an update is already waiting', async () => {
    const { store, page } = setup()
    store.ready()
    await store.check()
    expect(page.checks).toBe(0)
  })

  it('a throwing isOnline is treated as online', async () => {
    const { store, page, env } = setup()
    env.isOnline = () => {
      throw new Error('no navigator')
    }
    await store.check()
    expect(page.checks).toBe(1)
  })
})

describe('update store: listeners', () => {
  it('a throwing listener never stops the flow', async () => {
    const { store, page } = setup()
    store.subscribe(() => {
      throw new Error('listener bug')
    })
    store.ready()
    await store.update()
    expect(page.reloads).toBe(1)
  })

  it('unsubscribed listeners are not called', () => {
    const { store } = setup()
    let calls = 0
    const stop = store.subscribe(() => (calls += 1))
    stop()
    store.ready()
    expect(calls).toBe(0)
  })
})
