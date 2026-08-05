import { describe, it, expect } from 'vitest'
import { resolve, allSlugs } from '../src/catalog.ts'

describe('resolve', () => {
  it('resolves a known slug to public astronomical data', () => {
    expect(resolve('trappist-1e')).toEqual({
      id: 'trappist-1e',
      name: 'TRAPPIST-1 e',
      hostStar: 'TRAPPIST-1',
      distanceLy: 40.7,
      constellation: 'Aquarius',
    })
  })

  it('resolves the legacy slug that StellaMint renamed', () => {
    expect(resolve('alpha-centauri-b')?.id).toBe('alpha-centauri')
  })

  it('returns null for an unknown slug rather than guessing', () => {
    expect(resolve('kepler-999x')).toBeNull()
  })

  it('returns null for an empty slug', () => {
    expect(resolve('')).toBeNull()
  })
})

describe('allSlugs', () => {
  it('exposes every slug for coverage checks', () => {
    expect(allSlugs()).toContain('proxima-centauri-b')
    expect(allSlugs().length).toBe(12)
  })

  it('has no duplicate ids', () => {
    const slugs = allSlugs()
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('has a positive distance for every entry', () => {
    for (const slug of allSlugs()) {
      expect(resolve(slug)!.distanceLy).toBeGreaterThan(0)
    }
  })
})
