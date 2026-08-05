import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { mplCore, fetchAssetV1, fetchAssetsByOwner } from '@metaplex-foundation/mpl-core'
import { publicKey } from '@metaplex-foundation/umi'
import { config } from './config.ts'
import type { ChainRow } from './facts.ts'

const umi = createUmi(config.rpc, { commitment: 'confirmed' }).use(mplCore())

export async function readAsset(address: string, slot: number | null): Promise<ChainRow | null> {
  try {
    const a = await fetchAssetV1(umi, publicKey(address))
    return { assetId: address, owner: String(a.owner), name: a.name, uri: a.uri, slot }
  } catch {
    return null
  }
}

export async function readAssetsByOwner(owner: string): Promise<ChainRow[]> {
  const assets = await fetchAssetsByOwner(umi, publicKey(owner))
  return assets.map((a) => ({
    assetId: String(a.publicKey),
    owner: String(a.owner),
    name: a.name,
    uri: a.uri,
    slot: null,
  }))
}
