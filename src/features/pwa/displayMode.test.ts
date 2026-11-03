import { describe, expect, it } from 'vitest'
import { isStandalone, STANDALONE_QUERIES } from './displayMode'

const env = (matching: string[] = [], navigatorStandalone?: boolean) => ({
  matches: (query: string) => matching.includes(query),
  navigatorStandalone,
})

describe('isStandalone', () => {
  it('is false in a browser tab', () => {
    expect(isStandalone(env())).toBe(false)
    expect(isStandalone(env([], false))).toBe(false)
    expect(isStandalone(env(['(display-mode: browser)']))).toBe(false)
  })

  it('is true for each installed display mode', () => {
    for (const query of STANDALONE_QUERIES) expect(isStandalone(env([query]))).toBe(true)
  })

  it('is true on iOS when navigator.standalone is set, even without the media query', () => {
    expect(isStandalone(env([], true))).toBe(true)
  })

  it('is false when matchMedia throws', () => {
    const throwing = {
      matches: () => {
        throw new Error('no matchMedia')
      },
      navigatorStandalone: undefined,
    }
    expect(isStandalone(throwing)).toBe(false)
  })
})
