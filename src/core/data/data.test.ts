import { describe, expect, it } from 'vitest'
import { rewardRules } from '../../config/rewards'
import { settingsSpec } from '../../config/settings'
import { timerDefaults } from '../../config/timerDefaults'
import { catalog } from '../../config/catalog'
import { SCHEMA_VERSION, STORAGE_KEY } from '../../storage/persistence'
import { createWallet, rewardSession, type Wallet } from '../rewards/wallet'
import { createSettings } from '../settings/settings'
import { createWardrobe, equip, purchase } from '../shop/shop'
import { createTimer, start, type SessionCompleted } from '../timer/engine'
import {
  buildExport,
  EXPORT_FORMAT,
  EXPORT_VERSION,
  exportFileName,
  hasNoProgress,
  isProgressReset,
  progressResetState,
  progressSummary,
  serializeExport,
} from './data'

const MIN = 60_000
const T0 = Date.UTC(2026, 10, 3, 12, 0, 0)

const focus = (id: string, at: number): SessionCompleted => ({
  type: 'sessionCompleted',
  sessionId: id,
  mode: 'focus',
  durationMs: 25 * MIN,
  startedAt: at - 25 * MIN,
  completedAt: at,
  endsCycle: false,
  cycleFocusMs: 25 * MIN,
})

function richWallet(): Wallet {
  let wallet = createWallet()
  for (let i = 0; i < 4; i += 1) wallet = rewardSession(wallet, focus(`s${i}`, T0 + i * 30 * MIN), rewardRules).wallet
  const item = catalog[0]
  const bought = purchase(wallet, item, T0 + 3 * 60 * MIN)
  if (!bought.ok) throw new Error('expected purchase')
  return bought.wallet
}

describe('buildExport', () => {
  it('wraps the koa:v1 save with format, versions and time', () => {
    const settings = createSettings(settingsSpec)
    const timer = createTimer(timerDefaults)
    const wallet = richWallet()
    const wardrobe = createWardrobe()
    const file = buildExport({ version: SCHEMA_VERSION, timer, wallet, wardrobe, settings }, T0)

    expect(file.format).toBe(EXPORT_FORMAT)
    expect(file.exportVersion).toBe(EXPORT_VERSION)
    expect(file.storageKey).toBe(STORAGE_KEY)
    expect(file.exportedAt).toBe('2026-11-03T12:00:00.000Z')
    expect(file.data).toEqual({ version: SCHEMA_VERSION, timer, wallet, wardrobe, settings })
  })

  it('includes every ledger entry, purchase, equipped item, timer field and setting', () => {
    const wallet = richWallet()
    const item = catalog[0]
    const equipped = equip(createWardrobe(), wallet, item)
    if (!equipped.ok) throw new Error('expected equip')
    const timer = start(createTimer(timerDefaults), T0, 'running-1').state
    const settings = { ...createSettings(settingsSpec), dailyGoalMinutes: 150, sounds: true }
    const text = serializeExport(
      buildExport({ version: SCHEMA_VERSION, timer, wallet, wardrobe: equipped.wardrobe, settings }, T0),
    )
    const parsed = JSON.parse(text)

    expect(Object.keys(parsed.data.wallet.ledger)).toHaveLength(Object.keys(wallet.ledger).length)
    expect(parsed.data.wallet.ledger['focus:s0']).toMatchObject({ kind: 'focus', minutes: 25, sessionId: 's0' })
    expect(parsed.data.wallet.ledger['goal:2026-11-03']).toMatchObject({ kind: 'dailyGoal' })
    expect(parsed.data.wallet.spending[`item:${item.id}`]).toMatchObject({ itemId: item.id })
    expect(parsed.data.wallet.balance).toBe(wallet.balance)
    expect(parsed.data.wardrobe[item.slot]).toBe(item.id)
    expect(parsed.data.timer).toEqual(timer)
    expect(parsed.data.settings).toEqual(settings)
  })

  it('always sets the save version and leaves out missing slices', () => {
    const file = buildExport({ version: SCHEMA_VERSION }, T0)
    expect(file.data).toEqual({ version: SCHEMA_VERSION })
    expect(Object.keys(file.data)).toEqual(['version'])
  })

  it('copies only known slices', () => {
    const state = { version: SCHEMA_VERSION, settings: { a: 1 }, extra: 'x' } as unknown as Parameters<typeof buildExport>[0]
    expect(buildExport(state, T0).data).toEqual({ version: SCHEMA_VERSION, settings: { a: 1 } })
  })

  it('serializes to readable JSON that parses back to the same file', () => {
    const file = buildExport({ version: SCHEMA_VERSION, wallet: richWallet() }, T0)
    const text = serializeExport(file)
    expect(text).toContain('\n  "format": "koa-export"')
    expect(JSON.parse(text)).toEqual(file)
  })
})

describe('exportFileName', () => {
  it('names the file by the local day', () => {
    expect(exportFileName(new Date(2026, 10, 3, 23, 30).getTime())).toBe('koa-data-2026-11-03.json')
    expect(exportFileName(new Date(2026, 0, 9, 0, 5).getTime())).toBe('koa-data-2026-01-09.json')
  })
})

describe('progressResetState', () => {
  it('keeps only Settings', () => {
    const settings = { ...createSettings(settingsSpec), keepScreenOn: true }
    expect(progressResetState(settings)).toEqual({ version: SCHEMA_VERSION, settings })
  })

  it('works without settings', () => {
    expect(progressResetState(undefined)).toEqual({ version: SCHEMA_VERSION })
  })
})

describe('progressSummary', () => {
  it('counts what a reset would delete', () => {
    const wallet = richWallet()
    const item = catalog[0]
    const equipped = equip(createWardrobe(), wallet, item)
    if (!equipped.ok) throw new Error('expected equip')
    const timer = { ...start(createTimer(timerDefaults), T0, 'r').state, completedInCycle: 2 }
    const summary = progressSummary(wallet, equipped.wardrobe, timer)
    expect(summary).toEqual({
      balance: wallet.balance,
      totalEarned: wallet.totalEarned,
      itemsOwned: 1,
      itemsWorn: 1,
      focusSessions: 4,
      focusMinutes: 100,
      cycleSessions: 2,
      sessionInProgress: true,
    })
    expect(hasNoProgress(summary)).toBe(false)
  })

  it('reports nothing for a new user', () => {
    const summary = progressSummary(createWallet(), createWardrobe(), createTimer(timerDefaults))
    expect(summary.focusSessions).toBe(0)
    expect(hasNoProgress(summary)).toBe(true)
  })
})

describe('isProgressReset', () => {
  const save = (slices: Record<string, unknown>) => JSON.stringify({ version: SCHEMA_VERSION, ...slices })

  it('is true when the progress slices disappear', () => {
    expect(isProgressReset(save({ wallet: {}, timer: {}, settings: {} }), save({ settings: {} }))).toBe(true)
    expect(isProgressReset(save({ timer: {} }), save({}))).toBe(true)
  })

  it('is false for ordinary saves', () => {
    expect(isProgressReset(save({ timer: {} }), save({ timer: {}, wallet: {} }))).toBe(false)
    expect(isProgressReset(save({ wallet: {}, settings: {} }), save({ wallet: {}, settings: { x: 1 } }))).toBe(false)
  })

  it('is false for a first save, a cleared key or unreadable data', () => {
    expect(isProgressReset(null, save({ settings: {} }))).toBe(false)
    expect(isProgressReset(save({ timer: {} }), null)).toBe(false)
    expect(isProgressReset('{broken', save({ settings: {} }))).toBe(false)
    expect(isProgressReset(save({ settings: {} }), save({ settings: {} }))).toBe(false)
  })
})
