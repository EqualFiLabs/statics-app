# Local Genesis + Phase 1 fork

This environment inherits mainnet Genesis, Operators and the canonical STATICS pool, deploys Phase 1 locally, and backfills Genesis history into a separate development indexer. It runs on chain **4663**. All transactions use local Anvil; a private mainnet RPC is still needed for lazy fork reads and historical replay. A hosted or publicly exposed local RPC is unnecessary.

## Prerequisites

Linux, macOS and WSL2 are supported. Native Windows is outside this tooling's scope. In WSL2, keep both repositories in the Linux filesystem (for example `~/src`), run Node and Foundry inside WSL, and open the app through `localhost`.

Install Node 22.13 or newer, npm 10 or newer, Git and Foundry. Anvil must support `--state`, `--state-interval` and `--prune-history`; the initial live acceptance uses Foundry 1.8.2. Install Google Chrome for the configured Playwright browser checks. Browser authentication is a separate manual check.

Use existing checkouts. Optional `STATICS_APP_REPOSITORY` selects an existing app/indexer checkout while the tooling and runtime remain in the launcher checkout. Its path and SDK provenance are recorded and must match on resume. The launcher never clones, changes branches, initializes submodules or synchronizes SDKs. The current compatibility profile supports aggregated claims and pending-stake timing at protocol revision `0f2af8ade5fd34fe618703a4e7fc9f315e90f509` (the original `ec73b2c3e1919b79a01726001d78bf666279c59d` profile remains supported) and this app's vendored Phase 1 SDK source `6770d0caef5b94b8f102d2a33534970fb31b681e`. Deployment sources must be unmodified; unrelated protocol notes and the protocol SDK are not deployment inputs.

If preparing a compatible protocol checkout manually, first preserve your existing work. A separate checkout can be made without switching the original:

```sh
git -C /path/to/statics worktree add --detach /path/to/statics-fork 0f2af8ade5fd34fe618703a4e7fc9f315e90f509
git -C /path/to/statics-fork submodule update --init --recursive
```

In the app checkout containing this tooling:

```sh
npm ci
npm ci --prefix ponder
```

## Configuration

Set these variables in your shell or in the app's ignored `.env.fork.local`. This file is read as data, not sourced as a shell script; use `NAME=value`, optionally quoted. Shell variables override file values.

```dotenv
STATICS_PROTOCOL_REPOSITORY=/absolute/path/to/statics-fork
# Optional separate existing app checkout, including its Ponder sources and vendored SDK:
# STATICS_APP_REPOSITORY=/absolute/path/to/statics-app
ROBINHOOD_MAINNET=https://your-private-mainnet-provider
NEXT_PUBLIC_PRIVY_APP_ID=maintainer-provided-public-app-id
# NEXT_PUBLIC_PRIVY_CLIENT_ID=optional-maintainer-provided-public-client-id
```

Ask a maintainer for the public Privy identifiers and an approved localhost origin. Do not use a Privy secret. Keep private RPC credentials out of commits, screenshots and shared logs. Runtime files under `.local/fork/` are ignored and contain local state and control tokens; do not publish that directory.

## Start and resume

```sh
npm run dev:fork
```

Defaults are profile `dev`, RPC `http://127.0.0.1:8663`, indexer `http://127.0.0.1:42070` and app **`http://localhost:3000`**. Use localhost for Privy sign-in. Existing profiles retain their snapshot, ports, public configuration and compatibility provenance.

New profiles default to a production-build local preview (`--app-mode preview`): Next.js builds once, then serves the local fork without retaining a development compiler. Source edits require restarting the profile. Use `--app-mode development` on a new profile for hot reload; it needs substantially more memory. Existing profiles without a recorded mode retain development mode. A mode conflicting with a saved profile is rejected.

Webpack compilation uses a 3 GiB JavaScript heap and concurrency of two, alongside a 2 GiB Ponder heap and bounded Anvil history. These are component budgets, not a cap on total resident memory. Preview builds use one Next.js worker and its build memory optimizations. The generated config preserves the source app configuration and treats wagmi's absent optional Tempo `accounts` module as unavailable. Development mode retains one inactive page for 15 seconds. Keep resource-heavy builds and parallel fork sessions separate.

For a new profile, choose ports explicitly if another session is running:

```sh
npm run dev:fork -- --profile contributor --rpc-port 8665 --indexer-port 42072 --app-port 3002
# Optional explicit historical snapshot, if your provider can execute its state:
# npm run dev:fork -- --profile older --snapshot BLOCK_NUMBER --rpc-port 8666 --indexer-port 42073 --app-port 3003
```

A new session records the current executable mainnet block and hash. Startup deploys Phase 1, advances its local governance timelocks, seeds a STATICS/WETH pool and funds fixture accounts. Genesis is inherited, never redeployed. Backfill starts at Genesis deployment; canonical market history starts at the snapshot. Readiness requires a caught-up indexer and a responding app. The fork mines transactions immediately and does not mine idle blocks, keeping historical snapshots bounded by actual activity. Large historical replay can take time; inspect block progress and the profile's `ponder.log`.

The Phase 1 fixture is a separate pool initialized from the inherited Doppler pool's price **at the recorded snapshot**, before fixture purchases change that market. `profile.json` records `marketFixture` with the source pool, snapshot, atomic `sqrtPriceX96`, token decimals, aligned range and seed limits. The range is centered on that price and liquidity fits both fixture balances. There is no 1:1 fallback. The atomic ratio already incorporates decimals; display conversion must not change the initialization ratio. Each pool can move independently after initialization and uses its own hook and fee.

Older profiles seeded at 1:1 are retained on resume. Verification rejects missing price provenance. Use a separately named fresh profile or a reviewed migration that moves and rebalances the existing fixture through local transactions, preserving wallet funding and positions. Do not overwrite pool storage, swap manifest PoolKeys, delete the old profile or automatically redeploy Genesis.

Keep the launcher running in its terminal. Rerunning the same command reuses a healthy owned session. Conflicting saved settings or occupied foreign ports fail without stopping anything. After graceful stop, the same command loads the compact Anvil checkpoint; completed deployment stages are not repeated. It verifies a contract read at that checkpoint block. Checkpoints contain current state, not the entire historical state archive. Anvil keeps 1,024 recent states while running; arbitrary older local contract reads may be unavailable after restart. Preserve the indexer database and relay cache for replay. Successful block-pinned local contract reads are cached per profile and survive restart; uncached reads are never replaced with latest state. A source change needing uncached older local reads requires a separate fresh profile.

```sh
npm run fork:status -- --profile contributor
npm run fork:stop -- --profile contributor
npm run dev:fork -- --profile contributor
```

Ctrl-C also saves and stops the profile. Shutdown checkpoints current chain state before terminating Anvil. Periodic saves run every 60 seconds. The launcher never requests `anvil_dumpState(true)` or enables full historical-state dumping. Node decoding and automatic recovery files are limited to 128 MiB; oversized legacy profiles remain untouched for reviewed compact migration. A full-history dump can exhaust Anvil memory even when Node streams the response. An interrupted or forced final state save is marked uncertain and cannot be resumed automatically. Snapshot or deployment interruptions are retained in the stage journal. An uncertain stage is not automatically retried: inspect receipts and Forge broadcasts in that profile with a maintainer before attempting recovery. Use a differently named profile for a fresh setup; preserve the old profile rather than deleting it.

When indexer sources change, a new database and project directory are created within the profile. Previous databases remain recoverable. Cached historical RPC results are scoped by snapshot block/hash.

## Wallet and bounded controls

Configure an external wallet with chain ID `4663`, symbol `ETH` and this profile's loopback RPC. This chain ID is also mainnet's; confirm the wallet RPC is local before signing. Do not expose Anvil outside loopback. Privy uses the app's configured local read and wallet paths.

To sign in manually, open the approved `http://localhost:PORT/app/swap`, click Sign in, complete the Privy flow and confirm the selected wallet uses this fork. An immediate sign-in error commonly means the public identifiers or allowed origin are wrong; `127.0.0.1` and `localhost` are different origins.

```sh
npm run fork:fund-wallet -- 0xYOUR_ADDRESS --eth 10 --weth 2 --statics 100 --profile contributor
npm run fork:advance-time -- 3600 --profile contributor
```

ETH funding **adds** the requested amount through a confirmed local transfer. WETH is wrapped and transferred; STATICS comes from seeded fixture account zero. Insufficient fixtures fail clearly; requests are never reduced. Amounts use up to 18 decimal places. Funding is capped at 1,000,000 ETH/WETH and 10,000,000 STATICS per request; time advancement is capped at one year. Partial transaction failures retain receipts for diagnosis. Never retry funding blindly after a transport interruption.

## Verification and lifecycle tests

```sh
npm run verify:fork -- --profile contributor
```

Default verification reads full indexed/onchain Operator ownership, activation and reward-registration state, active credits, aggregate principal and vault inventory. It runs the three configured disconnected browser checks with both manifests. It does not submit transactions, pause mining or advance time. Its state comparisons wait for the indexer's checkpoint to equal the current fork head and abort if that head changes; results and browser artifacts stay in the profile.

It also compares the fixture's initialization price with the pinned Doppler price. A current-price comparison would be misleading after independent local swaps, so acceptance uses the archived successful creation receipt and recorded provenance instead.

Wallet sign-in and authenticated signing remain manual and must be reported separately. The local market overview's `/api/market/spot` can return **503** because it selects production analytics configuration; this separate application issue is outside the tooling PR.

```sh
npm run test:fork -- --profile contributor
```

This creates a new `test-contributor-...` profile using separate ports and a fresh snapshot, runs the seven lifecycle groups and browser checks, then stops only that test profile. It never mutates the selected interactive profile. Tests cover swaps, staking, managed liquidity and reuse, external attachment, Operators, inherited credit repayment/recovery, and funded rewards. Missing snapshot prerequisites are explicit skips in `lifecycle-results.json`, not passes. Failure logs and state are retained. Uniswap execution uses the existing application fixtures; the fork is never mapped to mainnet for API execution.

```sh
npm run test:fork-tooling
```

Credential-free Node tests exercise routing, boundary splitting, cache/restart behavior, write rejection, redaction, profiles, ports, transaction receipts and ownership controls. CI runs these on Linux and macOS alongside the existing quality gate. Live fork acceptance requires a configured private RPC; unexecuted WSL and authenticated-browser checks must be reported as such.

## Common failures

- **Occupied port:** select unused ports for a new profile, or stop the known owner explicitly. The launcher never kills unrelated Anvil processes.
- **Incompatible profile:** retain it and use a new name with compatible checkouts. Do not change the saved snapshot or replace its state to force a restart.
- **Missing submodule or source revision:** prepare dependencies and the compatible checkout manually; the launcher does not change Git state.
- **RPC denied, unavailable or pruned snapshot:** check your provider permissions and archive capability. Never replace the configured provider silently.
- **Uncertain deployment:** preserve `profile.json`, state, receipts and Forge broadcasts. Do not rerun a deployment or create a replacement NFT until the original transactions are understood.
- **Checkpoint read mismatch after restart:** retain state and artifacts for diagnosis; do not reset the session. Older local reads outside the retained window are unavailable unless already cached by the indexer; do not substitute current state.
- **Indexer replay:** handler/schema/source changes create a new database; old Genesis data is preserved.

The Genesis-only `dev:launch-fork` and its existing controls remain available independently.

Lifecycle tests always use the launcher checkout’s guarded suite, with application imports and SDK aliases pointing to the selected app checkout. A selected checkout’s older hardcoded-port suite is never executed by `test:fork`.
