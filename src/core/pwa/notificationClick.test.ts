import { describe, expect, it } from 'vitest'
import { focusOrOpenKoa, isKoaWindow, notificationTargetUrl, pickClient, type ClientsLike, type WindowClientLike } from './notificationClick'

const scope = 'https://koa.example/'

interface FakeClient extends WindowClientLike {
  name: string
  focusCalls: number
}

function client(name: string, url: string, focused = false, focusFails = false): FakeClient {
  const c: FakeClient = {
    name,
    url,
    focused,
    focusCalls: 0,
    focus() {
      c.focusCalls++
      return focusFails ? Promise.reject(new Error('not allowed')) : Promise.resolve(c)
    },
  }
  return c
}

function fakeClients(windows: FakeClient[]) {
  const opened: string[] = []
  const queries: unknown[] = []
  const clients: ClientsLike = {
    matchAll(options) {
      queries.push(options)
      return Promise.resolve(windows)
    },
    openWindow(url) {
      opened.push(url)
      return Promise.resolve(null)
    },
  }
  return { clients, opened, queries }
}

describe('isKoaWindow', () => {
  it('accepts Koa pages on any hash tab', () => {
    expect(isKoaWindow('https://koa.example/', scope)).toBe(true)
    expect(isKoaWindow('https://koa.example/#/settings', scope)).toBe(true)
    expect(isKoaWindow('https://koa.example/index.html?x=1', scope)).toBe(true)
  })

  it('rejects other origins, paths outside the scope and broken URLs', () => {
    expect(isKoaWindow('https://other.example/', scope)).toBe(false)
    expect(isKoaWindow('http://koa.example/', scope)).toBe(false)
    expect(isKoaWindow('https://koa.example/', 'https://koa.example/app/')).toBe(false)
    expect(isKoaWindow('not a url', scope)).toBe(false)
    expect(isKoaWindow('https://koa.example/', 'not a url')).toBe(false)
  })
})

describe('pickClient', () => {
  it('prefers a focused Koa window', () => {
    const a = client('a', 'https://koa.example/#/shop')
    const b = client('b', 'https://koa.example/', true)
    expect(pickClient([a, b], scope)?.name).toBe('b')
  })

  it('then any Koa window, in the order the browser lists them', () => {
    const a = client('a', 'https://koa.example/#/shop')
    const b = client('b', 'https://koa.example/')
    expect(pickClient([a, b], scope)?.name).toBe('a')
  })

  it('never picks another site, even a focused one', () => {
    const other = client('other', 'https://other.example/', true)
    const koa = client('koa', 'https://koa.example/')
    expect(pickClient([other, koa], scope)?.name).toBe('koa')
    expect(pickClient([other], scope)).toBeNull()
  })

  it('returns null when no window is open', () => {
    expect(pickClient([], scope)).toBeNull()
  })
})

describe('notificationTargetUrl', () => {
  it('resolves the notification url inside the scope', () => {
    expect(notificationTargetUrl({ url: '/' }, scope)).toBe('https://koa.example/')
    expect(notificationTargetUrl({ url: '/#/stats' }, scope)).toBe('https://koa.example/#/stats')
  })

  it('falls back to the scope for missing, malformed or foreign urls', () => {
    expect(notificationTargetUrl(undefined, scope)).toBe(scope)
    expect(notificationTargetUrl(null, scope)).toBe(scope)
    expect(notificationTargetUrl('/', scope)).toBe(scope)
    expect(notificationTargetUrl({ url: 42 }, scope)).toBe(scope)
    expect(notificationTargetUrl({ url: 'https://evil.example/' }, scope)).toBe(scope)
    expect(notificationTargetUrl({ url: '//evil.example/' }, scope)).toBe(scope)
    expect(notificationTargetUrl({ url: 'http://[' }, scope)).toBe(scope)
  })
})

describe('focusOrOpenKoa', () => {
  it('focuses the open Koa window and opens nothing', async () => {
    const koa = client('koa', 'https://koa.example/#/settings')
    const { clients, opened, queries } = fakeClients([koa])
    expect(await focusOrOpenKoa(clients, scope, { url: '/' })).toBe('focused')
    expect(koa.focusCalls).toBe(1)
    expect(opened).toEqual([])
    // Includes windows the worker doesn't control yet (first visit, or after an update).
    expect(queries).toEqual([{ type: 'window', includeUncontrolled: true }])
  })

  it('with two Koa tabs focuses only one', async () => {
    const a = client('a', 'https://koa.example/')
    const b = client('b', 'https://koa.example/#/shop', true)
    const { clients, opened } = fakeClients([a, b])
    await focusOrOpenKoa(clients, scope, { url: '/' })
    expect([a.focusCalls, b.focusCalls]).toEqual([0, 1])
    expect(opened).toEqual([])
  })

  it('opens Koa when no Koa window is open', async () => {
    const { clients, opened } = fakeClients([client('other', 'https://other.example/')])
    expect(await focusOrOpenKoa(clients, scope, { url: '/' })).toBe('opened')
    expect(opened).toEqual(['https://koa.example/'])
  })

  it('opens Koa if focusing the window is refused', async () => {
    const koa = client('koa', 'https://koa.example/', false, true)
    const { clients, opened } = fakeClients([koa])
    expect(await focusOrOpenKoa(clients, scope, { url: '/' })).toBe('opened')
    expect(koa.focusCalls).toBe(1)
    expect(opened).toEqual(['https://koa.example/'])
  })
})
