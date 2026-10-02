# Statics discovery indexer

This Ponder service indexes discovery data that the UI cannot enumerate cheaply:

- active loans and current Uniswap v4 PositionManager ownership for the full protocol;
- circulating Genesis ownership, next available Vault inventory, activation, registration, and effective weight;
- Genesis and previous-owner launch reward claims; and
- standalone launch fees harvested into the permanent fee receiver; and
- canonical STATICS/WETH swap history from the selected PoolManager and PoolId; and
- reorg-safe one-minute STATICS/WETH candles aggregated from those swaps.

When Phase 1 is configured, the same process also indexes public PoolKeys and fee policy,
canonical MarketTape swaps and observations, PositionNFT ownership and staking, managed ranged
liquidity, reward slots, continuous gauge reserve and period state, persistent allocations, LP and
allocator resolution activity, and creator or protocol revenue settlements. Permissioned-pool
sources are intentionally absent.

The PoolManager source requires `PONDER_CANONICAL_POOL_ID` and filters the indexed `id` topic at
the RPC boundary. Never run the source without this filter: Robinhood Chain produces many unrelated
PoolManager swaps per block. Full-protocol Statics and PositionManager sources are omitted entirely
when their addresses are unset.

Run a separate process and database schema for each network. Every process uses the same
config, schema, handlers, and API; `PONDER_DEPLOYMENT_ID`, `PONDER_CHAIN_ID`, addresses, start
blocks, RPC, and `DATABASE_SCHEMA` provide isolation. Numeric token IDs are never primary keys by
themselves: every stored entity is qualified by deployment ID.

`PONDER_DEPLOYMENT_ID` identifies the standalone Genesis or legacy source set.
`PONDER_PHASE_ONE_DEPLOYMENT_ID` separately identifies Phase 1 rows even when both products share a
chain and indexer process. Setting `PONDER_PUBLIC_HOOK_ADDRESS` without the Phase 1 deployment ID is
an error, so Genesis and Phase 1 history cannot silently share keys.

Copy `.env.example` to a deployment-specific env file, then run:

```sh
npm install
npm run codegen
npm run dev
```

Point the application at the separate instances with
`NEXT_PUBLIC_STATICS_MAINNET_INDEXER_URL` and `NEXT_PUBLIC_STATICS_INDEXER_URL`. Ponder owns the
reserved `/health`, `/ready`, and `/status` endpoints. Vault ownership is the implicit initial state;
the indexer does not materialize 5,555 identical rows. The application treats an unavailable or
lagging indexer as degraded discovery only; transaction state is always re-read onchain. Operator
wallet discovery reads `/status` as a checkpoint and reconciles no more than 50,000 subsequent
blocks in sequential 5,000-block `eth_getLogs` requests before checking current `ownerOf` state.
Larger gaps retain the indexed snapshot as stale instead of replaying deployment history. The trade
card rechecks every indexed inventory candidate onchain regardless of checkpoint lag, and accepts an
indexed exhausted state only when the checkpoint is at the RPC head.

Robinhood mainnet polls every two seconds. This keeps ordinary indexer lag within the application's
bounded recent-reconciliation path while halving the fixed provider cost of Ponder's latest-block poll.
The `/market/candles` route accepts `1`, `5`, `15`, `60`, `240`, and `1440` minute resolutions and
an ordered Unix-second range of at most 31 days. It aggregates larger resolutions from reorg-safe
one-minute rows and never scans historical RPC logs in response to an API request.

Phase 1 read routes live under `/phase-one`. They include deployment and indexed-block metadata and
serve public pools, MarketTape swaps and observations, wallet positions, position allocation and
managed-liquidity history, gauge state, reward slots, and transaction activity. These records are
for discovery and history. The application must still reread current authorization, balances,
cooldowns, rewards, restrictions, and protocol limits from the selected deployment before a write.

`PositionGaugeAllocationsSet` omits its PoolId and amount arrays. Its handler decodes the successful
`setGaugeAllocations` transaction input, rereads `gaugePositionAllocations` at the event block, and
fails closed unless calldata, event position, onchain ordering, amounts, locked stake, and totals
agree.

## Production isolation and monitoring

Ponder and the application's same-origin read proxy must use separate authenticated provider
applications and API keys. They must also use separate Nginx rate-limit zones: browser traffic to
`/api/rpc/` cannot consume the request budget reserved for `/indexer/`, `/health`, `/ready`, and
`/status`. Preserve an upstream `Retry-After` header through both proxy layers.

Alert on sustained provider `429` or proxy `502` responses, an unhealthy `/ready` response, and a
checkpoint that remains outside the 50,000-block recent-reconciliation window or whose lag keeps
growing. Logs and alerts may include status, chain ID, method names, batch size, and duration, but
must not include RPC URLs, credentials, calldata, wallet addresses, or complete request bodies.
