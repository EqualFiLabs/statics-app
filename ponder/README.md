# Statics discovery indexer

This Ponder service indexes discovery data that the UI cannot enumerate cheaply:

- active loans and current Uniswap v4 PositionManager ownership for the full protocol;
- circulating Genesis ownership, next available Vault inventory, activation, registration, and effective weight;
- Genesis and previous-owner rewards before and after the Diamond handoff;
- direct Morpho lender, borrower, repayment, and liquidation activity;
- standalone launch fees harvested into the permanent fee receiver;
- canonical STATICS/WETH swap history from the selected PoolManager and PoolId; and
- reorg-safe one-minute STATICS/WETH candles aggregated from those swaps.

The PoolManager source requires `PONDER_CANONICAL_POOL_ID` and filters the indexed `id` topic at
the RPC boundary. Never run the source without this filter: Robinhood Chain produces many unrelated
PoolManager swaps per block. Full-protocol Statics and PositionManager sources are omitted entirely
when their addresses are unset. The Morpho source is likewise omitted unless
`PONDER_MORPHO_ADDRESS` is configured.

Run a separate process and database schema for each network. Every process uses the same
config, schema, handlers, and API; `PONDER_DEPLOYMENT_ID`, `PONDER_CHAIN_ID`, addresses, start
blocks, RPC, and `DATABASE_SCHEMA` provide isolation. Numeric token IDs are never primary keys by
themselves: every stored entity is qualified by deployment ID.

Copy `.env.example` to a deployment-specific env file, then run:

```sh
npm install
npm run codegen
npm run dev
```

The current combined testnet values (without RPC or database credentials) are
checked in at `../deployments/46630-ponder-config.md`.

Point the application at the separate instances with
`NEXT_PUBLIC_STATICS_MAINNET_INDEXER_URL` and `NEXT_PUBLIC_STATICS_INDEXER_URL`. Ponder owns the
reserved `/health`, `/ready`, and `/status` endpoints. Vault ownership is the implicit initial state;
the indexer does not materialize 5,555 identical rows. The application treats an unavailable or
lagging indexer as degraded discovery only; transaction state is always re-read onchain. Operator
wallet discovery reads `/status` as a checkpoint and reconciles no more than 50,000 subsequent
blocks with one `eth_getLogs` request before checking current `ownerOf` state. Larger gaps retain the
indexed snapshot as stale instead of replaying deployment history. The trade card accepts next
inventory only from a checkpoint no more than 100 blocks behind the RPC head and withholds cached
inventory while that authoritative read is refreshing.

Robinhood mainnet polls every two seconds. This keeps ordinary indexer lag inside the application's
100-block freshness boundary while halving the fixed provider cost of Ponder's latest-block poll.
The `/market/candles` route accepts `1`, `5`, `15`, `60`, `240`, and `1440` minute resolutions and
an ordered Unix-second range of at most 31 days. It aggregates larger resolutions from reorg-safe
one-minute rows and never scans historical RPC logs in response to an API request.

## Production isolation and monitoring

Ponder and the application's same-origin read proxy must use separate authenticated provider
applications and API keys. They must also use separate Nginx rate-limit zones: browser traffic to
`/api/rpc/` cannot consume the request budget reserved for `/indexer/`, `/health`, `/ready`, and
`/status`. Preserve an upstream `Retry-After` header through both proxy layers.

Alert on sustained provider `429` or proxy `502` responses, an unhealthy `/ready` response, and a
checkpoint that remains more than 100 blocks behind its configured chain. Logs and alerts may
include status, chain ID, method names, batch size, and duration, but must not include RPC URLs,
credentials, calldata, wallet addresses, or complete request bodies.
