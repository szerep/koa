import { describe, expect, it } from 'vitest'
import { exportMethod, isShareCancelled } from './exportMethod'

describe('exportMethod', () => {
  it('shares only in an installed app that can share the file', () => {
    expect(exportMethod({ standalone: true, canShareFiles: true })).toBe('share')
  })

  it('downloads in an installed app without file sharing', () => {
    expect(exportMethod({ standalone: true, canShareFiles: false })).toBe('download')
  })

  it('downloads in a browser tab, even where file sharing works (desktop stays as in Phase 8)', () => {
    expect(exportMethod({ standalone: false, canShareFiles: true })).toBe('download')
    expect(exportMethod({ standalone: false, canShareFiles: false })).toBe('download')
  })
})

describe('isShareCancelled', () => {
  it('treats AbortError as the user closing the sheet', () => {
    expect(isShareCancelled(new DOMException('Share canceled', 'AbortError'))).toBe(true)
    expect(isShareCancelled({ name: 'AbortError' })).toBe(true)
  })

  it('treats every other rejection as a real failure', () => {
    expect(isShareCancelled(new DOMException('No user activation', 'NotAllowedError'))).toBe(false)
    expect(isShareCancelled(new DOMException('Bad file', 'DataError'))).toBe(false)
    expect(isShareCancelled(new TypeError('share is not a function'))).toBe(false)
    expect(isShareCancelled('AbortError')).toBe(false)
    expect(isShareCancelled(null)).toBe(false)
    expect(isShareCancelled(undefined)).toBe(false)
  })
})
