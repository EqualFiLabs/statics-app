# Statics discovery indexer

This Ponder service indexes discovery data that the UI cannot enumerate cheaply:

- active loans and current Uniswap v4 PositionManager ownership for the full protocol;
- Genesis ownership, Vault inventory, activation, registration, and effective weight;
- Genesis and previous-owner launch reward claims; and
- standalone launch fees harvested into the permanent fee receiver.

Run a separate process and database schema for each deployment. Both processes use the same
config, schema, handlers, and API; `PONDER_DEPLOYMENT_ID`, `PONDER_CHAIN_ID`, addresses, start
blocks, RPC, and `DATABASE_SCHEMA` provide isolation. Numeric token IDs are never primary keys by
themselves: every stored entity is qualified by deployment ID.

Copy `.env.example` to a deployment-specific env file, then run:

```sh
npm install
npm run codegen
npm run dev
```

Point the application at the separate instances with
`NEXT_PUBLIC_STATICS_MAINNET_INDEXER_URL` and `NEXT_PUBLIC_STATICS_INDEXER_URL`. Ponder owns the
reserved `/health`, `/ready`, and `/status` endpoints. The application treats an unavailable or
lagging indexer as degraded discovery only; transaction state is always re-read onchain.
