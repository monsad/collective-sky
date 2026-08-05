export type MessageSeed = { k: 'm'; m: string; t: string; s: string; a?: 1 }
export type ProofSeed = { k: 'p'; e: string; la: number; lo: number; o: string }
export type Seed = MessageSeed | ProofSeed

const METADATA_MARKER = '/api/metadata/'
const MAX_SEED_BYTES = 2048
const MAX_MESSAGE_CHARS = 1024

export function seedIdFromUri(uri: string): string | null {
  if (typeof uri !== 'string') return null
  const at = uri.indexOf(METADATA_MARKER)
  if (at === -1) return null
  const id = uri.slice(at + METADATA_MARKER.length).split(/[?#/]/)[0] ?? ''
  return id.length > 0 ? id : null
}

export function decodeSeed(id: string): Seed | null {
  if (typeof id !== 'string' || id.length === 0 || id.length > MAX_SEED_BYTES) return null

  let json: string
  try {
    const buf = Buffer.from(id.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
    const canonical = id.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    if (buf.toString('base64url') !== canonical) return null
    json = buf.toString('utf8')
  } catch {
    return null
  }

  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return null
  }
  if (typeof raw !== 'object' || raw === null) return null

  const o = raw as Record<string, unknown>
  if (o.k === 'm') return parseMessage(o)
  if (o.k === 'p') return parseProof(o)
  return null
}

export function seedFromUri(uri: string): Seed | null {
  const id = seedIdFromUri(uri)
  return id === null ? null : decodeSeed(id)
}

function parseMessage(o: Record<string, unknown>): MessageSeed | null {
  if (!isText(o.m, 1, MAX_MESSAGE_CHARS)) return null
  if (!isText(o.t, 1, 128)) return null
  if (!isIsoDate(o.s)) return null
  const seed: MessageSeed = { k: 'm', m: o.m, t: o.t, s: o.s }
  if (o.a === 1) seed.a = 1
  return seed
}

function parseProof(o: Record<string, unknown>): ProofSeed | null {
  if (!isText(o.e, 1, 256)) return null
  if (!isFiniteInRange(o.la, -90, 90)) return null
  if (!isFiniteInRange(o.lo, -180, 180)) return null
  if (!isIsoDate(o.o)) return null
  return { k: 'p', e: o.e, la: o.la, lo: o.lo, o: o.o }
}

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/

function isText(v: unknown, min: number, max: number): v is string {
  if (typeof v !== 'string') return false
  if (v.length < min || v.length > max) return false
  return !CONTROL_CHARS.test(v)
}

function isFiniteInRange(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
}

function isIsoDate(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && !Number.isNaN(Date.parse(v))
}
