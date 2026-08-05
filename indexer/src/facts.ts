import { seedFromUri } from './seed.ts'
import { resolve } from './catalog.ts'

export interface SkyFact {
  assetId: string
  owner: string
  kind: 'message' | 'proof'
  label: string
  targetSlug: string | null
  targetName: string | null
  distanceLy: number | null
  message: string | null
  event: string | null
  lat: number | null
  lon: number | null
  occurredAt: Date
  slot: number | null
  catalogHit: boolean
}

export interface ChainRow {
  assetId: string
  owner: string
  name: string
  uri: string
  slot?: number | null
}

const MESSAGE_PREFIX = 'Message to '
const PROOF_PREFIXES = ['Proof of Sky — ', 'Proof of Sky - ']
const MAX_LABEL_CHARS = 128

export function toFact(row: ChainRow): SkyFact | null {
  const seed = seedFromUri(row.uri)
  if (seed === null) return null

  const nameKind = kindFromName(row.name)
  if (nameKind === null) return null

  const seedKind = seed.k === 'm' ? 'message' : 'proof'
  if (nameKind !== seedKind) return null

  const base = {
    assetId: row.assetId,
    owner: row.owner,
    label: row.name.slice(0, MAX_LABEL_CHARS),
    slot: row.slot ?? null,
  }

  if (seed.k === 'm') {
    const planet = resolve(seed.t)
    return {
      ...base,
      kind: 'message',
      targetSlug: seed.t,
      targetName: planet?.name ?? null,
      distanceLy: planet?.distanceLy ?? null,
      message: seed.m,
      event: null,
      lat: null,
      lon: null,
      occurredAt: new Date(seed.s),
      catalogHit: planet !== null,
    }
  }

  return {
    ...base,
    kind: 'proof',
    targetSlug: null,
    targetName: null,
    distanceLy: null,
    message: null,
    event: seed.e,
    lat: seed.la,
    lon: seed.lo,
    occurredAt: new Date(seed.o),
    catalogHit: true,
  }
}

function kindFromName(name: string): 'message' | 'proof' | null {
  if (typeof name !== 'string') return null
  if (name.startsWith(MESSAGE_PREFIX)) return 'message'
  if (PROOF_PREFIXES.some((p) => name.startsWith(p))) return 'proof'
  return null
}
