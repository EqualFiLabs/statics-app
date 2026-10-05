# Phase 1 indexer replay

Genesis and Phase 1 use separate deployment namespaces in the existing schema. Phase 1 minute candles now populate `market_candle` as external swaps are indexed. The candle API preserves its fields; `indexedAtBlock` describes the last market block represented by those rows. Indexer freshness comes from Ponder's `/status` checkpoint.

Correcting historical Phase 1 candles, allocation snapshots and reused managed legs requires replaying Phase 1 from its configured start block. Keep the current database intact and replay into a separate database directory or schema, with both Genesis and Phase 1 sources configured. Validate readiness, ownership, allocation snapshots, leg reuse and candle totals before switching the development indexer URL. Do not reset the existing Genesis database or delete its records.

Owned positions retain the 100-item page limit. The response adds `nextCursor`; additional pages use ascending PositionNFT IDs, so callers request the cursor returned by the previous page.

Genesis ownership also indexes the deployment's ERC-2309 `ConsecutiveTransfer` mints. Replaying from the Genesis deployment block is required to include treasury Operators that have never emitted an ordinary `Transfer`. Existing databases remain readable, but catching up from a recent fork block alone does not restore those initial owners. Replay into a separate database and validate owned IDs, wallet balances, activation state, outstanding credits and vault inventory before switching.

The replay also restores principal changes from `GenesisCreditDrawn` and partial `GenesisCreditRepaid` events. Partial repayments keep the credit active; only repayment to zero or recovery removes it. Verify indexed credit principal against the fork's credit records and aggregate outstanding-credit total.
