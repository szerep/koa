import { describe, expect, it } from 'vitest'
import { createMemoryAdapter } from './adapter'
import { BACKUP_KEY, loadState, saveSlice, SCHEMA_VERSION, STORAGE_KEY } from './persistence'

describe('persistence', () => {
  it('returns an empty save when nothing is stored', () => {
    expect(loadState(createMemoryAdapter())).toEqual({ version: SCHEMA_VERSION })
  })

  it('saves and loads a slice', () => {
    const storage = createMemoryAdapter()
    saveSlice(storage, 'timer', { hello: 'koa' })
    expect(loadState(storage)).toEqual({ version: SCHEMA_VERSION, timer: { hello: 'koa' } })
    expect(JSON.parse(storage.data[STORAGE_KEY]).version).toBe(SCHEMA_VERSION)
  })

  it('keeps other slices when saving one', () => {
    const storage = createMemoryAdapter({
      [STORAGE_KEY]: JSON.stringify({ version: SCHEMA_VERSION, timer: 1, future: 'kept' }),
    })
    saveSlice(storage, 'timer', 2)
    expect(JSON.parse(storage.data[STORAGE_KEY])).toEqual({ version: SCHEMA_VERSION, timer: 2, future: 'kept' })
  })

  it('backs up and resets a corrupt save', () => {
    const storage = createMemoryAdapter({ [STORAGE_KEY]: '{not json' })
    expect(loadState(storage)).toEqual({ version: SCHEMA_VERSION })
    expect(storage.data[BACKUP_KEY]).toBe('{not json')
  })

  it('backs up and resets a save from an unknown version', () => {
    const future = JSON.stringify({ version: 99, timer: {} })
    const storage = createMemoryAdapter({ [STORAGE_KEY]: future })
    expect(loadState(storage)).toEqual({ version: SCHEMA_VERSION })
    expect(storage.data[BACKUP_KEY]).toBe(future)
  })
})
