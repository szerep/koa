import { describe, expect, it } from 'vitest'
import { koalaContextFor } from './context'

describe('koalaContextFor', () => {
  it('is focus only while a focus session runs', () => {
    expect(koalaContextFor({ mode: 'focus', status: 'running' })).toBe('focus')
    expect(koalaContextFor({ mode: 'focus', status: 'paused' })).toBe('idle')
    expect(koalaContextFor({ mode: 'focus', status: 'idle' })).toBe('idle')
  })

  it('is break for a started break, running or paused', () => {
    expect(koalaContextFor({ mode: 'shortBreak', status: 'running' })).toBe('break')
    expect(koalaContextFor({ mode: 'longBreak', status: 'paused' })).toBe('break')
    expect(koalaContextFor({ mode: 'shortBreak', status: 'idle' })).toBe('idle')
  })
})
