# Collective Sky

Collective Sky is a Dockerized, read-only client for [StellaMint](https://stellamint.vercel.app).
It rebuilds StellaMint's collective dataset — messages sent toward exoplanets,
proofs that someone looked up at the sky — entirely from Solana devnet. It
never contacts `stellamint.vercel.app`. There is no API key, no wallet, and
nothing here touches mainnet or real money: everything runs against devnet.

If StellaMint's own frontend went offline tonight, this dashboard would keep
working, because it does not depend on it.

## Quickstart

```bash
cp .env.example .env
docker compose up
# → http://localhost:8000
```

![Collective Sky filling up as the chain is read](docs/media/collective-sky.mp4)

## Running it without devnet

Devnet's public RPC rate-limits hard (HTTP 429 within minutes of a live tail),
and its faucet enforces a daily per-IP cap, so a hands-on demo can stall on
things that have nothing to do with this code. To develop or demo against a
local chain instead:

```bash
solana-test-validator --reset --gossip-port 8010 \
  --url https://api.devnet.solana.com \
  --clone-upgradeable-program CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d

SOLANA_RPC=http://127.0.0.1:8899 node --experimental-strip-types \
  tools/seed-local-validator.ts
```

`--clone-upgradeable-program` matters: plain `--clone` copies the program
account without its executable data, and every mint then fails with
`Program is not deployed`.

Then point the indexer at it with `SOLANA_RPC=http://127.0.0.1:8899` and
`SOLANA_WS=ws://127.0.0.1:8900`. The tool mints six StellaMint-shaped assets
from two wallets, so the watchlist visibly grows past one owner.

## How it works

StellaMint mints an [mpl-core](https://developers.metaplex.com/core) asset per
message or "proof of sky", and encodes the actual payload — the target planet,
the message text, the timestamp — base64url in the asset's on-chain `uri`
field, addressed at StellaMint's own metadata endpoint, e.g.:

```
https://stellamint.vercel.app/api/metadata/eyJrIjoicCIsImUiOiJKdXBpdGVyIiwi...
```

That URL is addressing, not a dependency: the indexer decodes the base64url
path segment locally and throws the URL away. It never issues the request. The
same is true of the exoplanet catalog a message resolves against — Collective
Sky ships its own independent catalog so a target name can be checked and
given a distance without asking anyone else what that name means.

## Services

| Service    | Job |
|------------|-----|
| `postgres` | Stores decoded facts (`sky_assets`), the owner watchlist, computed themes, and generated reports. |
| `indexer`  | TypeScript. Tails the mpl-core program on devnet, decodes `uri` payloads locally, and writes verified facts to Postgres. Never calls StellaMint. |
| `narrator` | Python. Periodically reads recent facts, asks a local model (via Docker Model Runner) to write a short report, and clusters message themes. |
| `web`      | Python/FastAPI. Serves the one-page dashboard at `:8000`, reading only from Postgres. |

## The sky starts empty

There is no seeded wallet list. The indexer discovers minters by live-tailing
the mpl-core program: every owner it sees minting a valid asset is added to a
watchlist, and that watchlist is re-swept in bounded batches
(`SWEEP_BATCH`, `SWEEP_INTERVAL_MS`) so the cost of tracking it stays
predictable no matter how many people mint.

That means a freshly started stack shows an empty sky. It fills itself the
moment someone mints on [StellaMint](https://stellamint.vercel.app) — go mint
a message and watch it land.

## The model never sees the chain

The narrator does not hand the language model raw chain data. It builds a
compact digest of already-decoded facts — counts, totals, top targets, top
events, and the message texts themselves — and that digest is the model's
entire world: no `uri`s, no asset ids, no network access, no tools. Every
number in a report was computed by tested code before the model ever saw it,
so the model's only job is phrasing.

Minted messages are strangers' text on a public devnet, so they are wrapped in
`<message>` tags and the system prompt explicitly names them as untrusted data
to summarize, never to follow. The exact digest handed to the model is stored
alongside the report in `reports.fact_digest`, so any sentence in a report can
be traced back to the facts that produced it.

## What this does NOT prove

An asset counts as StellaMint's if its on-chain `name` prefix matches
(`Message to `, `Proof of Sky — `) **and** its `uri` decodes to a valid seed of
the matching kind. That is a **format check**, not an authenticity check.

Both the `name` and the `uri` are fields the minter chooses — nothing stops
someone from base64url-encoding a well-formed seed by hand and minting it with
a matching name, and this indexer would accept it exactly as it accepts
anything minted through StellaMint's own UI. StellaMint also mints without a
collection, so an asset's `updateAuthority` is simply whoever minted it, not
evidence of who built the platform. There is no cryptographic proof of origin
here, and this project does not claim one. What the check does provide is
consistency: it keeps malformed and internally-mismatched data out of the
dataset shown on this dashboard.

## Configuration

All variables are documented in [`.env.example`](.env.example); copy it to
`.env` before running. Two are worth calling out:

- `CHAT_MODEL_TAG` / `EMBED_MODEL_TAG` — the model tags Docker Model Runner
  pulls for the `chat` and `embed` models declared in `compose.yaml`'s
  top-level `models:` element. Change these if a tag isn't available on your
  machine.
- `CHAT_URL` / `EMBED_URL` — injected automatically by Compose's `models:`
  wiring on the `narrator` service (`endpoint_var` / `model_var`). The Python
  client (`collective_sky/llm.py`) is a plain OpenAI-compatible HTTP caller,
  so any local server that speaks that protocol works if you point these
  elsewhere.

## Requirements

Docker Desktop 4.40 or later, for Docker Model Runner and the Compose
`models:` element used by the `narrator` service.

## Tests

```bash
cd indexer && npm install && npm test        # 88 tests
cd ../py && pip install -e ".[dev]" && python -m pytest   # 52 tests
```

## Links

- The story behind this project: [StellaMint — a message to the stars and proof of the night you looked up](https://dev.to/msadlok/stellamint-a-message-to-the-stars-and-proof-of-the-night-you-looked-up-109p)
- The live demo: [stellamint.vercel.app](https://stellamint.vercel.app)
