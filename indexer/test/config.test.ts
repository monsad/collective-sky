import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { num, atLeast, MIN_SWEEP_INTERVAL_MS, config } from '../src/config.ts'

let warn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  warn.mockRestore()
})

describe('num', () => {
  it('reads a valid value', () => {
    expect(num('X', 10, { X: '42' })).toBe(42)
  })

  it('falls back silently when the variable is absent', () => {
    expect(num('X', 10, {})).toBe(10)
    expect(warn).not.toHaveBeenCalled()
  })

  it('rejects zero, which would make the rate guard deny everything forever', () => {
    expect(num('MAX_TX_PER_MIN', 120, { MAX_TX_PER_MIN: '0' })).toBe(120)
    expect(warn).toHaveBeenCalled()
  })

  it('rejects a negative value, which would turn the main loop into a hot loop', () => {
    expect(num('SWEEP_INTERVAL_MS', 300_000, { SWEEP_INTERVAL_MS: '-1' })).toBe(300_000)
    expect(warn).toHaveBeenCalled()
  })

  it('rejects a non-numeric value and says so instead of failing silently', () => {
    expect(num('X', 10, { X: 'soon' })).toBe(10)
    expect(warn).toHaveBeenCalled()
  })

  it('rejects Infinity', () => {
    expect(num('X', 10, { X: 'Infinity' })).toBe(10)
    expect(warn).toHaveBeenCalled()
  })
})

describe('atLeast', () => {
  it('leaves a sane value alone', () => {
    expect(atLeast(300_000, 10_000, 'SWEEP_INTERVAL_MS')).toBe(300_000)
    expect(warn).not.toHaveBeenCalled()
  })

  it('raises a value below the floor and warns that it did', () => {
    expect(atLeast(50, 10_000, 'SWEEP_INTERVAL_MS')).toBe(10_000)
    expect(warn).toHaveBeenCalled()
  })
})

describe('config', () => {
  it('never exposes a sweep interval below the floor', () => {
    expect(config.sweepIntervalMs).toBeGreaterThanOrEqual(MIN_SWEEP_INTERVAL_MS)
  })

  it('never exposes a non-positive rate budget or sweep batch', () => {
    expect(config.maxTxPerMin).toBeGreaterThan(0)
    expect(config.sweepBatch).toBeGreaterThan(0)
  })
})
