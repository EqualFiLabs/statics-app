# Statics discovery indexer

This Ponder service indexes only data the UI cannot enumerate cheaply from current contract state:

- active loan IDs for public recovery discovery;
- current Uniswap v4 PositionManager NFT ownership.

Balances, loan terms, ownership, eligibility, and every value used to build a transaction are re-read from the configured contracts. The index is discovery infrastructure, not protocol authority.

Copy `.env.example` to `.env.local`, set the fresh deployment addresses and start blocks, then run:

```sh
npm install
npm run codegen
npm run dev
```

For production, configure PostgreSQL with `DATABASE_URL`, assign the deployment a unique
`DATABASE_SCHEMA`, and run `npm run start`.

Point the frontend at the service with `NEXT_PUBLIC_STATICS_INDEXER_URL`. Ponder owns the reserved
`/health`, `/ready`, and `/status` endpoints. `/health` reports process liveness, while `/ready`
returns success only after the indexer has caught up to realtime.
