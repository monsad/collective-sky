import { Connection, PublicKey } from '@solana/web3.js'
import { config } from './config.ts'
import { MPL_CORE_PROGRAM_ID, isCreateLog, createdAccounts, capCandidates } from './txscan.ts'
import { readAsset, readAssetsByOwner } from './chain.ts'
import { toFact, type ChainRow } from './facts.ts'
import { upsertFact, addOwner, listOwners, markSwept, setCursor, type Db } from './store.ts'
import { RateGuard } from './ratelimit.ts'

const connection = new Connection(config.rpc, {
  wsEndpoint: config.ws,
  commitment: 'confirmed',
})

async function ingest(db: Db, row: ChainRow): Promise<boolean> {
  const fact = toFact(row)
  if (fact === null) return false
  await upsertFact(db, fact)
  await addOwner(db, fact.owner)
  return true
}

async function inspectTransaction(
  db: Db,
  guard: RateGuard,
  signature: string,
  slot: number,
): Promise<void> {
  try {
    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
    })
    if (!tx) return
    const keys = tx.transaction.message.getAccountKeys({
      accountKeysFromLookups: tx.meta?.loadedAddresses,
    })
    const { taken, dropped } = capCandidates(createdAccounts({
      accountKeys: Array.from({ length: keys.length }, (_, i) => String(keys.get(i))),
      preBalances: tx.meta?.preBalances ?? [],
      postBalances: tx.meta?.postBalances ?? [],
    }))
    if (dropped > 0) {
      console.warn(`[live] ${signature}: inspecting ${taken.length} of ${taken.length + dropped} created accounts`)
    }
    for (const address of taken) {
      if (!guard.take()) {
        console.warn(`[live] rate guard exhausted; skipping candidate ${address}`)
        break
      }
      const row = await readAsset(address, slot)
      if (row && (await ingest(db, row))) {
        console.log(`[live] ${row.name} — ${address}`)
      }
    }
  } catch (err) {
    console.warn('[live] transaction inspection failed:', String(err))
  }
}

export function startLiveTail(db: Db): number {
  const guard = new RateGuard(config.maxTxPerMin)
  let queue: Promise<void> = Promise.resolve()
  return connection.onLogs(
    new PublicKey(MPL_CORE_PROGRAM_ID),
    (logs, ctx) => {
      if (logs.err !== null) return
      if (!isCreateLog(logs.logs)) return
      if (!guard.take()) return
      queue = queue.then(() => inspectTransaction(db, guard, logs.signature, ctx.slot))
    },
    'confirmed',
  )
}

export async function pingChain(db: Db): Promise<boolean> {
  try {
    await connection.getSlot('confirmed')
    await setCursor(db, 'last_chain_ok', new Date().toISOString())
    return true
  } catch (err) {
    console.warn('[chain] unreachable:', String(err))
    return false
  }
}

export async function sweepOwners(db: Db): Promise<number> {
  let found = 0
  for (const owner of await listOwners(db)) {
    let rows: ChainRow[]
    try {
      rows = await readAssetsByOwner(owner)
    } catch (err) {
      console.warn(`[sweep] ${owner} failed:`, String(err))
      continue
    }

    try {
      for (const row of rows) {
        try {
          if (await ingest(db, row)) found++
        } catch (err) {
          console.warn(`[sweep] ${owner} asset ${row.assetId} failed:`, String(err))
        }
      }
    } finally {
      try {
        await markSwept(db, owner)
      } catch (err) {
        console.warn(`[sweep] ${owner} markSwept failed:`, String(err))
      }
    }
  }
  return found
}
