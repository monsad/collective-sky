import { describe, it, expect } from 'vitest'
import { RateGuard } from '../src/ratelimit.ts'

function clock(start = 1_000_000) {
  let t = start
  return {
    now: () => t,
    advance(ms: number) {
      t += ms
    },
  }
}

describe('RateGuard', () => {
  it('allows exactly perMin calls in a burst and denies the next', () => {
    const c = clock()
    const guard = new RateGuard(5, c.now)
    for (let i = 0; i < 5; i++) expect(guard.take()).toBe(true)
    expect(guard.take()).toBe(false)
  })

  it('refills tokens in proportion to elapsed time', () => {
    const c = clock()
    const guard = new RateGuard(60, c.now)
    for (let i = 0; i < 60; i++) guard.take()
    expect(guard.take()).toBe(false)

    c.advance(10_000)
    for (let i = 0; i < 10; i++) expect(guard.take()).toBe(true)
    expect(guard.take()).toBe(false)
  })

  it('never lets the bucket exceed perMin no matter how long it idles', () => {
    const c = clock()
    const guard = new RateGuard(4, c.now)
    c.advance(24 * 60 * 60_000)
    for (let i = 0; i < 4; i++) expect(guard.take()).toBe(true)
    expect(guard.take()).toBe(false)
  })

  it('does not go backwards if the clock does', () => {
    const c = clock()
    const guard = new RateGuard(3, c.now)
    expect(guard.take()).toBe(true)
    c.advance(-60_000)
    expect(guard.take()).toBe(true)
    expect(guard.take()).toBe(true)
    expect(guard.take()).toBe(false)
  })

  it('rejects a non-positive or non-finite perMin instead of denying silently', () => {
    expect(() => new RateGuard(0)).toThrow(RangeError)
    expect(() => new RateGuard(-1)).toThrow(RangeError)
    expect(() => new RateGuard(Number.NaN)).toThrow(RangeError)
    expect(() => new RateGuard(Number.POSITIVE_INFINITY)).toThrow(RangeError)
  })

  it('defaults to the real clock when none is injected', () => {
    const guard = new RateGuard(1)
    expect(guard.take()).toBe(true)
    expect(guard.take()).toBe(false)
  })
})
