export const MPL_CORE_PROGRAM_ID = 'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d'

export interface MinimalTx {
  accountKeys: string[]
  preBalances: number[]
  postBalances: number[]
}

const CREATE_MARKERS = ['Instruction: Create', 'Instruction: CreateV1']

export function isCreateLog(logs: string[]): boolean {
  if (!Array.isArray(logs)) return false
  return logs.some((line) => CREATE_MARKERS.some((m) => line.includes(m)))
}

export const MAX_CANDIDATES_PER_TX = 8

export function capCandidates(
  candidates: string[],
  max: number = MAX_CANDIDATES_PER_TX,
): { taken: string[]; dropped: number } {
  if (candidates.length <= max) return { taken: candidates, dropped: 0 }
  return { taken: candidates.slice(0, max), dropped: candidates.length - max }
}

export function createdAccounts(tx: MinimalTx): string[] {
  const { accountKeys, preBalances, postBalances } = tx
  if (!Array.isArray(accountKeys)) return []
  const out: string[] = []
  for (let i = 0; i < accountKeys.length; i++) {
    const pre = preBalances?.[i]
    const post = postBalances?.[i]
    if (pre === 0 && typeof post === 'number' && post > 0) {
      out.push(accountKeys[i]!)
    }
  }
  return out
}
