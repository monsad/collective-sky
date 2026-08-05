import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { mplCore, create } from '@metaplex-foundation/mpl-core'
import { generateSigner, keypairIdentity } from '@metaplex-foundation/umi'
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'

const RPC = process.env.SOLANA_RPC ?? 'http://127.0.0.1:8899'
const conn = new Connection(RPC, 'confirmed')

function b64url(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const SITE = 'https://stellamint.vercel.app'
const uriFor = (seed: unknown) => `${SITE}/api/metadata/${b64url(JSON.stringify(seed))}`

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()

const WALLETS = [Keypair.generate(), Keypair.generate()]

const MINTS: { wallet: number; name: string; uri: string }[] = [
  {
    wallet: 0,
    name: 'Message to TRAPPIST-1 e',
    uri: uriFor({ k: 'm', m: 'We are here, and we were curious about you first.', t: 'trappist-1e', s: hoursAgo(9) }),
  },
  {
    wallet: 0,
    name: 'Message to Proxima Centauri b',
    uri: uriFor({ k: 'm', m: 'Sent from a small blue planet on a quiet Tuesday.', t: 'proxima-centauri-b', s: hoursAgo(7) }),
  },
  {
    wallet: 1,
    name: 'Message to Ross 128 b',
    uri: uriFor({ k: 'm', m: 'If this reaches anyone: we spent our nights looking up.', t: 'ross-128-b', s: hoursAgo(5) }),
  },
  {
    wallet: 1,
    name: 'Message to Teegarden’s Star b',
    uri: uriFor({ k: 'm', m: 'Hello from Warsaw. The sky was clear tonight.', t: 'teegarden-b', s: hoursAgo(3) }),
  },
  {
    wallet: 0,
    name: 'Proof of Sky — Jupiter',
    uri: uriFor({ k: 'p', e: 'Jupiter', la: 52.23, lo: 21.01, o: hoursAgo(4) }),
  },
  {
    wallet: 1,
    name: 'Proof of Sky — Perseids',
    uri: uriFor({ k: 'p', e: 'Perseids', la: 50.06, lo: 19.94, o: hoursAgo(2) }),
  },
]

async function fund(kp: Keypair): Promise<number> {
  const sig = await conn.requestAirdrop(kp.publicKey, 2 * LAMPORTS_PER_SOL)
  const bh = await conn.getLatestBlockhash()
  await conn.confirmTransaction({ signature: sig, ...bh }, 'confirmed')
  return (await conn.getBalance(kp.publicKey)) / LAMPORTS_PER_SOL
}

for (const [i, kp] of WALLETS.entries()) {
  const balance = await fund(kp)
  console.log(`wallet ${i}: ${kp.publicKey.toBase58()} funded, balance ${balance} SOL`)
  if (balance === 0) throw new Error(`wallet ${i} did not receive its airdrop`)
}

const DELAY_MS = Number(process.env.DELAY_MS ?? 0)

for (const [i, m] of MINTS.entries()) {
  const kp = WALLETS[m.wallet]!
  const umi = createUmi(RPC, { commitment: 'confirmed' }).use(mplCore())
  umi.use(keypairIdentity(umi.eddsa.createKeypairFromSecretKey(kp.secretKey)))

  const asset = generateSigner(umi)
  await create(umi, { asset, name: m.name, uri: m.uri }).sendAndConfirm(umi, { confirm: { commitment: 'confirmed' } })
  console.log(`[${i + 1}/${MINTS.length}] ${m.name} -> ${asset.publicKey}`)
  if (DELAY_MS) await new Promise((r) => setTimeout(r, DELAY_MS))
}

console.log('\nowners:')
for (const kp of WALLETS) console.log(' ', kp.publicKey.toBase58())
process.exit(0)
