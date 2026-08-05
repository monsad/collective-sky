import data from './catalog.data.json' with { type: 'json' }

export interface Exoplanet {
  id: string
  name: string
  hostStar: string
  distanceLy: number
  constellation: string
}

const LIST = data as Exoplanet[]
const BY_ID = new Map(LIST.map((p) => [p.id, p]))

const LEGACY_IDS: Record<string, string> = {
  'alpha-centauri-b': 'alpha-centauri',
}

export function resolve(slug: string): Exoplanet | null {
  if (!slug) return null
  return BY_ID.get(LEGACY_IDS[slug] ?? slug) ?? null
}

export function allSlugs(): string[] {
  return LIST.map((p) => p.id)
}
