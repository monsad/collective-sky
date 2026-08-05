export function num(
  name: string,
  fallback: number,
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = env[name]
  if (raw === undefined || raw === '') return fallback
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) {
    console.warn(`[config] ${name}=${raw} is not a positive number; using ${fallback}`)
    return fallback
  }
  return n
}

export function atLeast(value: number, floor: number, name: string): number {
  if (value >= floor) return value
  console.warn(`[config] ${name}=${value} is below the ${floor} floor; using ${floor}`)
  return floor
}

export const MIN_SWEEP_INTERVAL_MS = 10_000

export const config = {
  rpc: process.env.SOLANA_RPC ?? 'https://api.devnet.solana.com',
  ws: process.env.SOLANA_WS ?? 'wss://api.devnet.solana.com',
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://sky:sky@postgres:5432/collective_sky',
  live: process.env.LIVE !== '0',
  sweepIntervalMs: atLeast(
    num('SWEEP_INTERVAL_MS', 300_000),
    MIN_SWEEP_INTERVAL_MS,
    'SWEEP_INTERVAL_MS',
  ),
  maxTxPerMin: num('MAX_TX_PER_MIN', 120),
  sweepBatch: num('SWEEP_BATCH', 200),
}
