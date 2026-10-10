# Phase 1 indexer replay

Genesis and Phase 1 use separate deployment namespaces in the existing schema. Phase 1 minute candles now populate `market_candle` as external swaps are indexed. The candle API preserves its fields; `indexedAtBlock` describes the last market block represented by those rows. Indexer freshness comes from Ponder's `/status` checkpoint.

Correcting historical Phase 1 candles, allocation snapshots and reused managed legs requires replaying Phase 1 from its configured start block. Keep the current database intact and replay into a separate database directory or schema, with both Genesis and Phase 1 sources configured. Validate readiness, ownership, allocation snapshots, leg reuse and candle totals before switching the development indexer URL. Do not reset the existing Genesis database or delete its records.

Owned positions retain the 100-item page limit. The response adds `nextCursor`; additional pages use ascending PositionNFT IDs, so callers request the cursor returned by the previous page.

Genesis ownership also indexes the deployment's ERC-2309 `ConsecutiveTransfer` mints. Replaying from the Genesis deployment block is required to include treasury Operators that have never emitted an ordinary `Transfer`. Existing databases remain readable, but catching up from a recent fork block alone does not restore those initial owners. Replay into a separate database and validate owned IDs, wallet balances, activation state, outstanding credits and vault inventory before switching.

The replay also restores principal changes from `GenesisCreditDrawn` and partial `GenesisCreditRepaid` events. Partial repayments keep the credit active; only repayment to zero or recovery removes it. Verify indexed credit principal against the fork's credit records and aggregate outstanding-credit total.

## Allocation directory schema replay

The allocation directory adds token metadata, allocator stream snapshots, materialized browsing rows and a directory revision. It also adds pool gauge/lifecycle fields and restriction nonces. Existing rows cannot populate these reliably without replaying the configured Phase 1 deployment from its creation block. Do not synthesize missing history from the disposable fork's current pool list.

Use a new `PONDER_DATABASE_DIRECTORY` for PGlite, or a separate PostgreSQL database with a fresh `DATABASE_SCHEMA`. Keep the serving database intact. For a full clean replay, keep Genesis sources enabled from their deployment starts and Phase 1 sources enabled from their own start. Preserve canonical market history's existing start-block configuration.

With the same deployment configuration and a supported historical read endpoint loaded, run from `ponder/`:

```sh
PONDER_DATABASE_DIRECTORY=/path/to/separate/replay-data \
  NODE_OPTIONS=--max-old-space-size=2048 \
  npm run start -- --hostname 127.0.0.1 --port 42072 --schema allocation_directory_replay
```

Use an unused port and database directory. `ponder start` does not accept the development-only `--disable-ui` option. Keep private RPC configuration in the process environment; do not copy credentials into evidence or logs. On a mainnet fork, use its historical read relay so pre-snapshot contract reads and logs remain available.

`PONDER_LOG_BLOCK_RANGE` optionally sets a provider-supported maximum log range for backfill (1–1,000,000 blocks). Zero, negative and unsafe values are rejected before startup. Leave it unset for Ponder's defaults. This option never changes deployment starts or bypasses history. The same schema and handlers work with configured mainnet, testnet and fork sources.

Acceptance before any separately reviewed cutover:

1. Confirm `/ready` and compare `/status` with the selected chain head. Record the checkpoint; a listening server alone is insufficient.
2. Read every allocation directory page at one revision. Compare sampled PoolKeys, gauge weights, reserve denominator, allocator schedules, restriction nonces and lifecycle flags with contract reads pinned to their reported observation blocks. Include empty, paused, stopped and restricted cases where available.
3. Verify Genesis ownership and credit records against the serving indexer and pinned onchain samples; both namespaces must remain available.
4. Stop only the isolated replay process gracefully. Retain its database and evidence. Do not automatically switch the app's indexer URL, replace the serving database or delete older data.

Directory observation blocks are distinct from `/status` freshness. Silent contract checkpoints and temporary same-block allocation memberships cannot always be reconstructed from events; see [allocation directory semantics](allocation-directory-indexer.md).
