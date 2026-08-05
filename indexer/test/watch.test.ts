import { describe, it, expect, vi, beforeEach } from 'vitest'

const readAssetsByOwner = vi.fn()
const upsertFact = vi.fn()
const addOwner = vi.fn()
const listOwners = vi.fn()
const markSwept = vi.fn()

vi.mock('../src/chain.ts', () => ({
  readAsset: vi.fn(),
  readAssetsByOwner: (...a: unknown[]) => readAssetsByOwner(...a),
}))

vi.mock('../src/store.ts', () => ({
  upsertFact: (...a: unknown[]) => upsertFact(...a),
  addOwner: (...a: unknown[]) => addOwner(...a),
  listOwners: (...a: unknown[]) => listOwners(...a),
  markSwept: (...a: unknown[]) => markSwept(...a),
  setCursor: vi.fn(),
}))

const { sweepOwners } = await import('../src/watch.ts')

const db = { query: vi.fn() } as never

function row(assetId: string) {
  return {
    assetId,
    owner: 'Owner111',
    name: 'Message to TRAPPIST-1 e',
    uri: 'https://stellamint.vercel.app/api/metadata/eyJrIjoibSIsIm0iOiJ3ZSBhcmUgaGVyZSIsInQiOiJ0cmFwcGlzdC0xZSIsInMiOiIyMDI2LTA4LTA1VDIwOjAwOjAwLjAwMFoifQ',
    slot: null,
  }
}

describe('sweepOwners', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    listOwners.mockResolvedValue(['Owner111'])
    upsertFact.mockResolvedValue(undefined)
    addOwner.mockResolvedValue(undefined)
    markSwept.mockResolvedValue(undefined)
  })

  it('ingests every asset an owner holds', async () => {
    readAssetsByOwner.mockResolvedValue([row('A1'), row('A2')])
    expect(await sweepOwners(db)).toBe(2)
    expect(markSwept).toHaveBeenCalledWith(db, 'Owner111')
  })

  it('keeps ingesting the siblings of an asset that fails to store', async () => {
    readAssetsByOwner.mockResolvedValue([row('Bad'), row('Good1'), row('Good2')])
    upsertFact.mockRejectedValueOnce(new Error('null byte in text'))
    expect(await sweepOwners(db)).toBe(2)
  })

  it('marks the owner swept even when some of its assets failed', async () => {
    readAssetsByOwner.mockResolvedValue([row('Bad')])
    upsertFact.mockRejectedValue(new Error('null byte in text'))
    await sweepOwners(db)
    expect(markSwept).toHaveBeenCalledWith(db, 'Owner111')
  })

  it('does not mark an owner swept when the owner read itself failed', async () => {
    readAssetsByOwner.mockRejectedValue(new Error('rpc down'))
    expect(await sweepOwners(db)).toBe(0)
    expect(markSwept).not.toHaveBeenCalled()
  })

  it('carries on to the next owner when one owner is unreachable', async () => {
    listOwners.mockResolvedValue(['Owner111', 'Owner222'])
    readAssetsByOwner
      .mockRejectedValueOnce(new Error('rpc down'))
      .mockResolvedValueOnce([row('A1')])
    expect(await sweepOwners(db)).toBe(1)
  })
})
