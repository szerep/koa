/**
 * Export through the share sheet (Phase 9, Step 8). The Web Share API is injected (`FileShare`),
 * so no test ever opens a real sheet.
 */
import { describe, expect, it } from 'vitest'
import { settingsSpec } from '../../config/settings'
import { EXPORT_FORMAT, exportFileName } from '../../core/data/data'
import { createWallet } from '../../core/rewards/wallet'
import { createSettings, timerConfigFrom } from '../../core/settings/settings'
import { createWardrobe } from '../../core/shop/shop'
import { createTimer } from '../../core/timer/engine'
import { createMemoryAdapter } from '../../storage/adapter'
import { STORAGE_KEY } from '../../storage/persistence'
import { createProgressData, SHARE_TITLE, type FileShare } from './progressData'

const T0 = new Date(2026, 10, 4, 9, 30).getTime()

interface Deferred {
  resolve: () => void
  reject: (error: unknown) => void
}

/** A fake Web Share API. `share()` stays pending until the test settles it, like a real sheet. */
function fakeShare({ standalone = true, canShare = true }: { standalone?: boolean; canShare?: boolean } = {}) {
  const canShareCalls: ShareData[] = []
  const shareCalls: ShareData[] = []
  const pending: Deferred[] = []
  const env: FileShare = {
    isStandalone: () => standalone,
    canShare(data) {
      canShareCalls.push(data)
      return canShare
    },
    share(data) {
      shareCalls.push(data)
      return new Promise<void>((resolve, reject) => pending.push({ resolve, reject }))
    },
  }
  return { env, canShareCalls, shareCalls, pending }
}

function setup(share?: FileShare, opts: { downloadFails?: boolean } = {}) {
  const settings = createSettings(settingsSpec)
  const storage = createMemoryAdapter()
  const downloads: { fileName: string; text: string; mimeType: string }[] = []
  const data = createProgressData({
    storage,
    snapshot: () => ({
      timer: createTimer(timerConfigFrom(settings)),
      wallet: createWallet(),
      wardrobe: createWardrobe(),
      settings,
    }),
    reload: () => {},
    download(fileName, text, mimeType) {
      if (opts.downloadFails) throw new TypeError('Blob URLs are blocked')
      downloads.push({ fileName, text, mimeType })
    },
    share,
    now: () => T0,
  })
  return { data, downloads, storage }
}

const sharedFile = (data: ShareData): File => {
  const [file] = data.files ?? []
  if (!file) throw new Error('no file shared')
  return file
}

describe('export through the share sheet', () => {
  it('opens the share sheet in an installed app that can share the file', async () => {
    const share = fakeShare()
    const { data, downloads } = setup(share.env)

    const result = data.exportData()
    expect(share.shareCalls).toHaveLength(1)
    expect(data.getState().export).toEqual({ kind: 'sharing', fileName: exportFileName(T0) })

    share.pending[0].resolve()
    await expect(result).resolves.toBe(true)
    expect(data.getState().export).toEqual({ kind: 'shared', fileName: exportFileName(T0) })
    expect(downloads).toHaveLength(0)
  })

  it('shares the same file the download would save: name, MIME type and JSON text', async () => {
    const share = fakeShare()
    const { data } = setup(share.env)
    const downloadOnly = setup()

    void data.exportData()
    expect(downloadOnly.data.exportData()).toBe(true)
    const download = downloadOnly.downloads[0]

    const shared = share.shareCalls[0]
    expect(shared.title).toBe(SHARE_TITLE)
    expect(shared.files).toHaveLength(1)
    const file = sharedFile(shared)
    expect(file).toBeInstanceOf(File)
    expect(file.name).toBe(download.fileName)
    expect(file.name).toMatch(/^koa-data-\d{4}-\d{2}-\d{2}\.json$/)
    expect(file.type).toBe('application/json')
    expect(download.mimeType).toBe('application/json')
    const text = await file.text()
    expect(text).toBe(download.text)
    const parsed = JSON.parse(text)
    expect(parsed.format).toBe(EXPORT_FORMAT)
    expect(parsed.storageKey).toBe(STORAGE_KEY)
  })

  it('asks canShare about the exact file it then shares', () => {
    const share = fakeShare()
    const { data } = setup(share.env)
    void data.exportData()
    expect(share.canShareCalls).toHaveLength(1)
    expect(share.canShareCalls[0]).toBe(share.shareCalls[0])
  })

  it('calls share() synchronously inside the tap (no await before it, so the gesture still counts)', () => {
    const share = fakeShare()
    const { data } = setup(share.env)
    void data.exportData()
    // Checked before any microtask runs.
    expect(share.shareCalls).toHaveLength(1)
  })

  it('never shares or downloads without an Export tap', () => {
    const share = fakeShare()
    const { data, downloads } = setup(share.env)
    data.requestReset()
    data.cancelReset()
    data.dismiss()
    data.subscribe(() => {})
    expect(share.canShareCalls).toHaveLength(0)
    expect(share.shareCalls).toHaveLength(0)
    expect(downloads).toHaveLength(0)
  })

  it('ignores a second tap while the sheet is open', async () => {
    const share = fakeShare()
    const { data, downloads } = setup(share.env)
    const first = data.exportData()
    expect(data.exportData()).toBe(false)
    expect(share.shareCalls).toHaveLength(1)
    expect(downloads).toHaveLength(0)

    share.pending[0].resolve()
    await first
    // Once it closes, Export works again.
    void data.exportData()
    expect(share.shareCalls).toHaveLength(2)
  })
})

describe('download fallback', () => {
  it('downloads in an installed app that cannot share files', () => {
    const share = fakeShare({ canShare: false })
    const { data, downloads } = setup(share.env)
    expect(data.exportData()).toBe(true)
    expect(share.shareCalls).toHaveLength(0)
    expect(downloads).toHaveLength(1)
    expect(data.getState().export).toEqual({ kind: 'exported', fileName: exportFileName(T0) })
  })

  it('downloads in a browser tab even when file sharing works (Phase 8 behavior)', () => {
    const share = fakeShare({ standalone: false })
    const { data, downloads } = setup(share.env)
    expect(data.exportData()).toBe(true)
    expect(share.shareCalls).toHaveLength(0)
    expect(downloads).toHaveLength(1)
  })

  it('downloads when no share capability is injected', () => {
    const { data, downloads } = setup()
    expect(data.exportData()).toBe(true)
    expect(downloads).toHaveLength(1)
  })

  it('downloads when the capability checks throw (missing or broken Web Share API)', () => {
    const throwing: FileShare = {
      isStandalone: () => true,
      canShare: () => {
        throw new TypeError('navigator.canShare is not a function')
      },
      share: () => Promise.reject(new TypeError('navigator.share is not a function')),
    }
    const { data, downloads } = setup(throwing)
    expect(data.exportData()).toBe(true)
    expect(downloads).toHaveLength(1)

    const brokenStandalone: FileShare = { ...fakeShare().env, isStandalone: () => { throw new Error('no matchMedia') } }
    const second = setup(brokenStandalone)
    expect(second.data.exportData()).toBe(true)
    expect(second.downloads).toHaveLength(1)
  })
})

describe('cancelling and failures', () => {
  it('treats closing the sheet as a choice: back to idle, no failure, no download', async () => {
    const share = fakeShare()
    const { data, downloads } = setup(share.env)
    const result = data.exportData()
    share.pending[0].reject(new DOMException('Share canceled', 'AbortError'))
    await expect(result).resolves.toBe(false)
    expect(data.getState().export).toEqual({ kind: 'idle' })
    expect(downloads).toHaveLength(0)
  })

  it('falls back to the download when sharing really fails', async () => {
    const share = fakeShare()
    const { data, downloads } = setup(share.env)
    const result = data.exportData()
    share.pending[0].reject(new DOMException('No user activation', 'NotAllowedError'))
    await expect(result).resolves.toBe(true)
    expect(downloads).toHaveLength(1)
    expect(downloads[0].fileName).toBe(exportFileName(T0))
    expect(data.getState().export).toEqual({ kind: 'exported', fileName: exportFileName(T0) })
  })

  it('falls back to the download when share() throws synchronously', async () => {
    const env: FileShare = {
      isStandalone: () => true,
      canShare: () => true,
      share: () => {
        throw new TypeError('Illegal invocation')
      },
    }
    const { data, downloads } = setup(env)
    await expect(data.exportData()).resolves.toBe(true)
    expect(downloads).toHaveLength(1)
  })

  it('shows the failure message when sharing and the fallback download both fail', async () => {
    const share = fakeShare()
    const { data } = setup(share.env, { downloadFails: true })
    const result = data.exportData()
    share.pending[0].reject(new DOMException('Bad file', 'DataError'))
    await expect(result).resolves.toBe(false)
    expect(data.getState().export).toEqual({ kind: 'failed' })
  })

  it('sets no message when the sheet closes after the user left the screen', async () => {
    const share = fakeShare()
    const { data } = setup(share.env)
    const result = data.exportData()
    data.dismiss()
    share.pending[0].resolve()
    await result
    expect(data.getState().export).toEqual({ kind: 'idle' })
  })

  it('never changes the save, whichever way the file goes', async () => {
    const share = fakeShare()
    const { data, storage } = setup(share.env)
    storage.write(STORAGE_KEY, '{"version":1}')
    const result = data.exportData()
    share.pending[0].reject(new DOMException('Share canceled', 'AbortError'))
    await result
    expect(storage.read(STORAGE_KEY)).toBe('{"version":1}')
  })
})
