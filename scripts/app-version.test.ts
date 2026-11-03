import { describe, expect, it } from 'vitest'
import { appVersion, shortCommit } from './app-version.ts'

describe('appVersion', () => {
  it('prefers the Cloudflare Pages commit', () => {
    expect(
      appVersion({ packageVersion: '0.9.0', cloudflareSha: 'A1B2C3D4E5F60718293a4b5c6d7e8f9012345678', gitSha: 'fffffff' }),
    ).toBe('0.9.0 (a1b2c3d)')
  })

  it('falls back to local git', () => {
    expect(appVersion({ packageVersion: '0.9.0', gitSha: 'dbd45fb\n' })).toBe('0.9.0 (dbd45fb)')
    expect(appVersion({ packageVersion: '0.9.0', cloudflareSha: '', gitSha: 'dbd45fb' })).toBe('0.9.0 (dbd45fb)')
  })

  it('ignores values that are not commit hashes', () => {
    expect(appVersion({ packageVersion: '0.9.0', cloudflareSha: 'main', gitSha: 'fatal: not a git repository' })).toBe(
      '0.9.0',
    )
  })

  it('shows the package version alone without a commit', () => {
    expect(appVersion({ packageVersion: '0.9.0' })).toBe('0.9.0')
    expect(appVersion({ packageVersion: ' ' })).toBe('0.0.0')
  })
})

describe('shortCommit', () => {
  it('accepts 7 to 40 hex characters', () => {
    expect(shortCommit('abc1234')).toBe('abc1234')
    expect(shortCommit('abc123')).toBeNull()
    expect(shortCommit('g'.repeat(7))).toBeNull()
    expect(shortCommit('a'.repeat(41))).toBeNull()
    expect(shortCommit(undefined)).toBeNull()
  })
})
