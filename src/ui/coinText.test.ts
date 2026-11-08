import { describe, expect, it } from 'vitest'
import { coinText } from './coinText'

const format = new Intl.NumberFormat()

describe('coinText', () => {
  it('uses the singular for exactly one coin', () => {
    expect(coinText(1)).toBe('1 coin')
  })

  it('uses the plural for zero and for more than one', () => {
    expect(coinText(0)).toBe('0 coins')
    expect(coinText(2)).toBe('2 coins')
    expect(coinText(105)).toBe('105 coins')
  })

  it('groups large numbers like the visible balance', () => {
    expect(coinText(1250)).toBe(`${format.format(1250)} coins`)
  })
})
