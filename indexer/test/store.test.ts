import { describe, it, expect } from 'vitest'
import { upsertFact, addOwner, listOwners, getCursor, setCursor, type Db } from '../src/store.ts'
import type { SkyFact } from '../src/facts.ts'
import { config } from '../src/config.ts'

function fakeDb(rows: unknown[][] = []): Db & { calls: { sql: string; params: unknown[] }[] } {
  const calls: { sql: string; params: unknown[] }[] = []
  return {
    calls,
    async query(sql: string, params: unknown[] = []) {
      calls.push({ sql, params })
      return { rows: (rows.shift() ?? []) as Record<string, unknown>[] }
    },
  }
}

const FACT: SkyFact = {
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
}

describe('upsertFact', () => {
  it('writes every field of the fact', async () => {
    const db = fakeDb()
    await upsertFact(db, FACT)
    const { sql, params } = db.calls[0]!
    expect(sql).toContain('INSERT INTO sky_assets')
    expect(params).toEqual([
      'Asset111', 'Owner111', 'message', 'Message to TRAPPIST-1 e',
      'trappist-1e', 'TRAPPIST-1 e', 40.7, 'we are here',
      null, null, null, FACT.occurredAt, 42, true,
    ])
  })

  it('is written as an upsert keyed on asset_id', async () => {
    const db = fakeDb()
    await upsertFact(db, FACT)
    expect(db.calls[0]!.sql).toContain('ON CONFLICT (asset_id) DO UPDATE')
  })

  it('omits first_seen from the SET list, so a re-index cannot move it', async () => {
    const db = fakeDb()
    await upsertFact(db, FACT)
    expect(db.calls[0]!.sql).not.toContain('first_seen = ')
  })

  it('writes slot through COALESCE, so a slotless sweep cannot clobber it', async () => {
    const db = fakeDb()
    await upsertFact(db, FACT)
    expect(db.calls[0]!.sql).toContain('slot = COALESCE(EXCLUDED.slot, sky_assets.slot)')
  })
})

describe('addOwner', () => {
  it('inserts an owner idempotently', async () => {
    const db = fakeDb()
    await addOwner(db, 'Owner111')
    expect(db.calls[0]!.sql).toContain('ON CONFLICT (address) DO NOTHING')
    expect(db.calls[0]!.params).toEqual(['Owner111'])
  })
})

describe('listOwners', () => {
  it('returns owner addresses, oldest sweep first', async () => {
    const db = fakeDb([[{ address: 'A' }, { address: 'B' }]])
    expect(await listOwners(db)).toEqual(['A', 'B'])
    expect(db.calls[0]!.sql).toContain('ORDER BY last_swept ASC NULLS FIRST')
  })

  it('bounds the batch, because anyone can mint to unlimited fresh wallets', async () => {
    const db = fakeDb([[]])
    await listOwners(db, 50)
    expect(db.calls[0]!.sql).toContain('LIMIT $1')
    expect(db.calls[0]!.params).toEqual([50])
  })

  it('defaults the batch to the configured SWEEP_BATCH', async () => {
    const db = fakeDb([[]])
    await listOwners(db)
    expect(db.calls[0]!.params).toEqual([config.sweepBatch])
  })

  it('round-robins: the oldest sweep first ordering keeps the tail from starving', async () => {
    const db = fakeDb([[]])
    await listOwners(db)
    expect(db.calls[0]!.sql).toContain('ORDER BY last_swept ASC NULLS FIRST')
  })
})

describe('cursor', () => {
  it('returns null when the key is absent', async () => {
    const db = fakeDb([[]])
    expect(await getCursor(db, 'slot')).toBeNull()
  })

  it('returns the stored value', async () => {
    const db = fakeDb([[{ v: '12345' }]])
    expect(await getCursor(db, 'slot')).toBe('12345')
  })

  it('upserts on write', async () => {
    const db = fakeDb()
    await setCursor(db, 'slot', '12345')
    expect(db.calls[0]!.sql).toContain('ON CONFLICT (k) DO UPDATE')
    expect(db.calls[0]!.params).toEqual(['slot', '12345'])
  })
})
