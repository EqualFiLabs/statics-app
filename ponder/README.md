# Statics discovery indexer

This Ponder service indexes discovery data that the UI cannot enumerate cheaply:

- active loans and current Uniswap v4 PositionManager ownership for the full protocol;
- circulating Genesis ownership, next available Vault inventory, activation, registration, and effective weight;
- Genesis and previous-owner launch reward claims; and
- standalone launch fees harvested into the permanent fee receiver; and
- canonical STATICS/WETH swap history from the selected PoolManager and PoolId.

Run a separate process and database schema for each network. Every process uses the same
config, schema, handlers, and API; `PONDER_DEPLOYMENT_ID`, `PONDER_CHAIN_ID`, addresses, start
blocks, RPC, and `DATABASE_SCHEMA` provide isolation. Numeric token IDs are never primary keys by
themselves: every stored entity is qualified by deployment ID.

Production deployments can set `PONDER_RPC_URLS_<chainId>` to a comma-separated provider pool.
Ponder will balance requests across the configured URLs and fall back between providers. The
singular `PONDER_RPC_URL_<chainId>` remains supported for local and single-provider deployments.

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
wallet discovery reads `/status` as a checkpoint, rejects snapshots more than 100 blocks behind,
and reconciles transfers after a healthy checkpoint before checking current `ownerOf` state. The
trade card discovers the next Operator directly from Vault inventory and withholds cached inventory
while that authoritative read is refreshing.
