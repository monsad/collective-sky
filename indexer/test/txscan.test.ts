import { describe, it, expect } from 'vitest'
import {
  isCreateLog,
  createdAccounts,
  capCandidates,
  MAX_CANDIDATES_PER_TX,
  type MinimalTx,
} from '../src/txscan.ts'

describe('isCreateLog', () => {
  it('recognises an mpl-core create instruction from program logs', () => {
    expect(isCreateLog([
      'Program CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d invoke [1]',
      'Program log: Instruction: Create',
      'Program CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d success',
    ])).toBe(true)
  })

  it('recognises CreateV1 as well', () => {
    expect(isCreateLog(['Program log: Instruction: CreateV1'])).toBe(true)
  })

  it('ignores transfers, which are the bulk of mpl-core traffic', () => {
    expect(isCreateLog(['Program log: Instruction: Transfer'])).toBe(false)
  })

  it('ignores an empty log list', () => {
    expect(isCreateLog([])).toBe(false)
  })
})

describe('createdAccounts', () => {
  const tx: MinimalTx = {
    accountKeys: ['Payer1', 'NewAsset1', 'SystemProgram', 'NewAsset2'],
    preBalances: [1_000_000_000, 0, 1, 0],
    postBalances: [980_000_000, 2_000_000, 1, 3_000_000],
  }

  it('finds accounts that went from zero to funded', () => {
    expect(createdAccounts(tx)).toEqual(['NewAsset1', 'NewAsset2'])
  })

  it('excludes the fee payer, whose balance only decreased', () => {
    expect(createdAccounts(tx)).not.toContain('Payer1')
  })

  it('excludes pre-existing accounts', () => {
    expect(createdAccounts(tx)).not.toContain('SystemProgram')
  })

  it('returns an empty list when nothing was created', () => {
    expect(createdAccounts({
      accountKeys: ['A', 'B'],
      preBalances: [10, 20],
      postBalances: [5, 25],
    })).toEqual([])
  })

  it('tolerates malformed balance arrays instead of throwing', () => {
    expect(createdAccounts({ accountKeys: ['A', 'B'], preBalances: [0], postBalances: [] }))
      .toEqual([])
  })
})

describe('capCandidates', () => {
  it('passes a normal mint through untouched', () => {
    expect(capCandidates(['A1'])).toEqual({ taken: ['A1'], dropped: 0 })
  })

  it('caps a transaction that creates far more accounts than a mint would', () => {
    const many = Array.from({ length: 30 }, (_, i) => `A${i}`)
    const { taken, dropped } = capCandidates(many)
    expect(taken).toHaveLength(MAX_CANDIDATES_PER_TX)
    expect(dropped).toBe(30 - MAX_CANDIDATES_PER_TX)
  })

  it('reports how many it dropped so a silent cap cannot look like an empty tx', () => {
    expect(capCandidates(['A', 'B', 'C'], 1)).toEqual({ taken: ['A'], dropped: 2 })
  })

  it('handles an empty candidate list', () => {
    expect(capCandidates([])).toEqual({ taken: [], dropped: 0 })
  })
})
