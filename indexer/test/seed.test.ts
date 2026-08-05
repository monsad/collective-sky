import { describe, it, expect } from 'vitest'
import { seedIdFromUri, decodeSeed, seedFromUri } from '../src/seed.ts'

const PROOF_ID =
  'eyJrIjoicCIsImUiOiJKdXBpdGVyIiwibGEiOjUyLjIzLCJsbyI6MjEuMDEsIm8iOiIyMDI2LTA4LTA1VDIxOjMwOjAwLjAwMFoifQ'
const MESSAGE_ID =
  'eyJrIjoibSIsIm0iOiJ3ZSBhcmUgaGVyZSIsInQiOiJ0cmFwcGlzdC0xZSIsInMiOiIyMDI2LTA4LTA1VDIwOjAwOjAwLjAwMFoifQ'

describe('seedIdFromUri', () => {
  it('extracts the id from a StellaMint metadata uri', () => {
    expect(seedIdFromUri(`https://stellamint.vercel.app/api/metadata/${PROOF_ID}`)).toBe(PROOF_ID)
  })

  it('accepts any origin, because the origin is addressing not identity', () => {
    expect(seedIdFromUri(`http://localhost:3000/api/metadata/${PROOF_ID}`)).toBe(PROOF_ID)
  })

  it('rejects a uri that is not a metadata uri', () => {
    expect(seedIdFromUri('https://example.com/nft/1.json')).toBeNull()
  })

  it('rejects an empty id', () => {
    expect(seedIdFromUri('https://stellamint.vercel.app/api/metadata/')).toBeNull()
  })
})

describe('decodeSeed', () => {
  it('decodes a proof seed', () => {
    expect(decodeSeed(PROOF_ID)).toEqual({
      k: 'p', e: 'Jupiter', la: 52.23, lo: 21.01, o: '2026-08-05T21:30:00.000Z',
    })
  })

  it('decodes a message seed', () => {
    expect(decodeSeed(MESSAGE_ID)).toEqual({
      k: 'm', m: 'we are here', t: 'trappist-1e', s: '2026-08-05T20:00:00.000Z',
    })
  })

  it('rejects truncated base64', () => {
    expect(decodeSeed(PROOF_ID.slice(0, 20))).toBeNull()
  })

  it('rejects valid base64 that is not JSON', () => {
    expect(decodeSeed('aGVsbG8gd29ybGQ')).toBeNull()
  })

  it('rejects JSON with an unknown kind', () => {
    expect(decodeSeed(b64url('{"k":"x"}'))).toBeNull()
  })

  it('rejects a message seed missing its target', () => {
    expect(decodeSeed(b64url('{"k":"m","m":"hi","s":"2026-08-05T20:00:00.000Z"}'))).toBeNull()
  })

  it('rejects a proof seed with an out-of-range latitude', () => {
    expect(decodeSeed(b64url('{"k":"p","e":"X","la":91,"lo":0,"o":"2026-08-05T20:00:00.000Z"}')))
      .toBeNull()
  })

  it('rejects a seed with an unparseable date', () => {
    expect(decodeSeed(b64url('{"k":"m","m":"hi","t":"trappist-1e","s":"never"}'))).toBeNull()
  })

  it('rejects trailing junk that base64 decoding silently drops', () => {
    expect(decodeSeed(`${PROOF_ID}!!!!`)).toBeNull()
  })

  it('rejects an id with whitespace injected into it', () => {
    const spaced = `${MESSAGE_ID.slice(0, 10)} ${MESSAGE_ID.slice(10)}`
    expect(decodeSeed(spaced)).toBeNull()
  })

  it('accepts the standard base64 alphabet as well as the url-safe one', () => {
    const standard = PROOF_ID.replace(/-/g, '+').replace(/_/g, '/')
    expect(decodeSeed(standard)).toMatchObject({ k: 'p' })
  })

  it('accepts a padded id', () => {
    const padded = MESSAGE_ID + '='.repeat((4 - (MESSAGE_ID.length % 4)) % 4)
    expect(decodeSeed(padded)).toMatchObject({ k: 'm' })
  })

  it('rejects a message longer than the decoder admits', () => {
    const long = JSON.stringify({
      k: 'm', m: 'x'.repeat(1025), t: 'trappist-1e', s: '2026-08-05T20:00:00.000Z',
    })
    expect(b64url(long).length).toBeLessThan(2048)
    expect(decodeSeed(b64url(long))).toBeNull()
  })

  it('accepts a message at the bound', () => {
    const ok = JSON.stringify({
      k: 'm', m: 'x'.repeat(1024), t: 'trappist-1e', s: '2026-08-05T20:00:00.000Z',
    })
    expect(decodeSeed(b64url(ok))).toMatchObject({ k: 'm' })
  })

  it('rejects an oversized payload', () => {
    const huge = JSON.stringify({ k: 'm', m: 'x'.repeat(20000), t: 'trappist-1e', s: '2026-08-05T20:00:00.000Z' })
    expect(decodeSeed(b64url(huge))).toBeNull()
  })

  it('rejects a seed carrying a NUL byte, which postgres text cannot store', () => {
    expect(decodeSeed(b64url('{"k":"m","m":"hi\\u0000there","t":"trappist-1e","s":"2026-08-05T20:00:00.000Z"}')))
      .toBeNull()
  })

  it('rejects a seed carrying other C0 control characters', () => {
    expect(decodeSeed(b64url('{"k":"p","e":"X\\u0007","la":0,"lo":0,"o":"2026-08-05T20:00:00.000Z"}')))
      .toBeNull()
  })

  it('accepts newlines and tabs, which are legitimate in a human message', () => {
    expect(decodeSeed(b64url('{"k":"m","m":"line one\\nline two\\tend","t":"trappist-1e","s":"2026-08-05T20:00:00.000Z"}')))
      .toMatchObject({ m: 'line one\nline two\tend' })
  })

  it('keeps the optional arecibo flag', () => {
    const id = b64url('{"k":"m","m":"hi","t":"trappist-1e","s":"2026-08-05T20:00:00.000Z","a":1}')
    expect(decodeSeed(id)).toMatchObject({ a: 1 })
  })
})

describe('seedFromUri', () => {
  it('is the composition of the two', () => {
    expect(seedFromUri(`https://stellamint.vercel.app/api/metadata/${MESSAGE_ID}`))
      .toMatchObject({ k: 'm', t: 'trappist-1e' })
  })

  it('returns null for a foreign uri', () => {
    expect(seedFromUri('https://arweave.net/abc')).toBeNull()
  })
})

function b64url(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
