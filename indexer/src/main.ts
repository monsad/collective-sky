import pg from 'pg'
import { config } from './config.ts'
import { startLiveTail, sweepOwners, pingChain } from './watch.ts'
import type { Db } from './store.ts'

const pool = new pg.Pool({ connectionString: config.databaseUrl })

pool.on('error', (err) => {
  console.warn('[db] idle client error (pool will reconnect):', String(err))
})
const db: Db = { query: (sql, params) => pool.query(sql, params as never[]) }

async function waitForDb(): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await pool.query('SELECT 1')
      return
    } catch (err) {
      if (attempt >= 30) throw err
      const wait = Math.min(5000, 200 * 2 ** attempt) + Math.random() * 200
      console.log(`[boot] waiting for postgres (${attempt})`)
      await new Promise((r) => setTimeout(r, wait))
    }
  }
}

async function main(): Promise<void> {
  await waitForDb()
  console.log(`[boot] rpc=${config.rpc} live=${config.live}`)

  if (config.live) {
    startLiveTail(db)
    console.log('[boot] tailing mpl-core; the sky fills as the world mints')
  }

  for (;;) {
    try {
      await pingChain(db)
      const found = await sweepOwners(db)
      if (found > 0) console.log(`[sweep] ingested ${found} assets`)
    } catch (err) {
      console.warn('[sweep] cycle failed, retrying next interval:', String(err))
    }
    await new Promise((r) => setTimeout(r, config.sweepIntervalMs))
  }
}

main().catch((err) => {
  console.error('[fatal]', err)
  process.exit(1)
})
