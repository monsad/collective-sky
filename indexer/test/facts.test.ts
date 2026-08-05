import { describe, it, expect } from 'vitest'
import { toFact, type SkyFact } from '../src/facts.ts'

const PROOF_URI =
  'https://stellamint.vercel.app/api/metadata/eyJrIjoicCIsImUiOiJKdXBpdGVyIiwibGEiOjUyLjIzLCJsbyI6MjEuMDEsIm8iOiIyMDI2LTA4LTA1VDIxOjMwOjAwLjAwMFoifQ'
const MESSAGE_URI =
  'https://stellamint.vercel.app/api/metadata/eyJrIjoibSIsIm0iOiJ3ZSBhcmUgaGVyZSIsInQiOiJ0cmFwcGlzdC0xZSIsInMiOiIyMDI2LTA4LTA1VDIwOjAwOjAwLjAwMFoifQ'

const BASE = { assetId: 'Asset111', owner: 'Owner111', slot: 42 }

describe('toFact', () => {
  it('builds a message fact with catalog data resolved', () => {
    const fact = toFact({ ...BASE, name: 'Message to TRAPPIST-1 e', uri: MESSAGE_URI })
    expect(fact).toEqual<SkyFact>({
      assetId: 'Asset111',
      owner: 'Owner111',
      kind: 'message',
      label: 'Message to TRAPPIST-1 e',
      targetSlug: 'trappist-1e',
      targetName: 'TRAPPIST-1 e',
      distanceLy: 40.7,
      message: 'we are here',
      event: null,
      lat: null,
      lon: null,
      occurredAt: new Date('2026-08-05T20:00:00.000Z'),
      slot: 42,
      catalogHit: true,
    })
  })

  it('builds a proof fact', () => {
    const fact = toFact({ ...BASE, name: 'Proof of Sky — Jupiter', uri: PROOF_URI })
    expect(fact).toMatchObject({
      kind: 'proof',
      event: 'Jupiter',
      lat: 52.23,
      lon: 21.01,
      message: null,
      targetSlug: null,
      distanceLy: null,
      catalogHit: true,
      occurredAt: new Date('2026-08-05T21:30:00.000Z'),
    })
  })

  it('keeps a message whose target is not in our catalog, flagged as a gap', () => {
    const uri = metadataUri('{"k":"m","m":"hi","t":"kepler-999x","s":"2026-08-05T20:00:00.000Z"}')
    const fact = toFact({ ...BASE, name: 'Message to Kepler-999 x', uri })
    expect(fact).toMatchObject({
      targetSlug: 'kepler-999x',
      targetName: null,
      distanceLy: null,
      catalogHit: false,
    })
  })

  it('rejects an asset whose name does not match StellaMint', () => {
    expect(toFact({ ...BASE, name: 'Some Other NFT', uri: MESSAGE_URI })).toBeNull()
  })

  it('rejects an asset whose uri is not a decodable seed', () => {
    expect(toFact({ ...BASE, name: 'Proof of Sky — Fake', uri: 'https://evil.example/x.json' }))
      .toBeNull()
  })

  it('rejects a proof name carrying a message seed', () => {
    expect(toFact({ ...BASE, name: 'Proof of Sky — Jupiter', uri: MESSAGE_URI })).toBeNull()
  })

  it('rejects a message name carrying a proof seed', () => {
    expect(toFact({ ...BASE, name: 'Message to Jupiter', uri: PROOF_URI })).toBeNull()
  })

  it('truncates an absurdly long name rather than storing it whole', () => {
    const name = `Message to ${'x'.repeat(200_000)}`
    const fact = toFact({ ...BASE, name, uri: MESSAGE_URI })
    expect(fact!.label).toHaveLength(128)
    expect(fact!.label).toBe(name.slice(0, 128))
  })

  it('leaves a normal-length label untouched', () => {
    const fact = toFact({ ...BASE, name: 'Message to TRAPPIST-1 e', uri: MESSAGE_URI })
    expect(fact!.label).toBe('Message to TRAPPIST-1 e')
  })

  it('accepts a hyphen-minus in the proof label as well as an em dash', () => {
    expect(toFact({ ...BASE, name: 'Proof of Sky - Jupiter', uri: PROOF_URI })).not.toBeNull()
  })
})

function metadataUri(json: string): string {
  const id = Buffer.from(json, 'utf8').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `https://stellamint.vercel.app/api/metadata/${id}`
}
