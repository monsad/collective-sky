import type { SkyFact } from './facts.ts'
import { config } from './config.ts'

export interface Db {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>
}

export async function upsertFact(db: Db, f: SkyFact): Promise<void> {
  await db.query(
    `INSERT INTO sky_assets (
       asset_id, owner, kind, label, target_slug, target_name, distance_ly,
       message, event, lat, lon, occurred_at, slot, catalog_hit
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (asset_id) DO UPDATE SET
       owner = EXCLUDED.owner,
       label = EXCLUDED.label,
       target_slug = EXCLUDED.target_slug,
       target_name = EXCLUDED.target_name,
       distance_ly = EXCLUDED.distance_ly,
       message = EXCLUDED.message,
       event = EXCLUDED.event,
       lat = EXCLUDED.lat,
       lon = EXCLUDED.lon,
       occurred_at = EXCLUDED.occurred_at,
       slot = COALESCE(EXCLUDED.slot, sky_assets.slot),
       catalog_hit = EXCLUDED.catalog_hit`,
    [
      f.assetId, f.owner, f.kind, f.label, f.targetSlug, f.targetName, f.distanceLy,
      f.message, f.event, f.lat, f.lon, f.occurredAt, f.slot, f.catalogHit,
    ],
  )
}

export async function addOwner(db: Db, address: string): Promise<void> {
  await db.query(
    `INSERT INTO owners (address) VALUES ($1) ON CONFLICT (address) DO NOTHING`,
    [address],
  )
}

export async function listOwners(db: Db, limit: number = config.sweepBatch): Promise<string[]> {
  const { rows } = await db.query(
    `SELECT address FROM owners ORDER BY last_swept ASC NULLS FIRST LIMIT $1`,
    [limit],
  )
  return rows.map((r) => String(r.address))
}

export async function markSwept(db: Db, address: string): Promise<void> {
  await db.query(`UPDATE owners SET last_swept = now() WHERE address = $1`, [address])
}

export async function getCursor(db: Db, k: string): Promise<string | null> {
  const { rows } = await db.query(`SELECT v FROM cursor WHERE k = $1`, [k])
  const row = rows[0]
  return row ? String(row.v) : null
}

export async function setCursor(db: Db, k: string, v: string): Promise<void> {
  await db.query(
    `INSERT INTO cursor (k, v) VALUES ($1, $2)
     ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v`,
    [k, v],
  )
}
