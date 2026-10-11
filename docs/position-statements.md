# Position NFT statements

The Phase 1 statement endpoint follows an NFT throughout ownership changes and closure:

```
GET /phase-one/positions/:positionId/statement
  ?category=lifecycle|staking|liquidity|allocations|rewards
  &poolId=0x…&asset=0x…&fromBlock=…&toBlock=…
  &direction=desc&cursor=…&limit=25
```

It returns deployment ID, Position NFT ID, `historyStart`, `observationBoundary`, ordered
items and `nextCursor`. Limits are 1–100. Integers in payloads/amounts are decimal strings;
log index and metadata decimals are JSON numbers. The typed loader validates ABI widths,
tuple/array fields, identities, ownership context, canonical order and pagination bounds.
Amounts are parsed to bigint; small ABI integers (such as ticks) retain SDK number types.
Liquidity entries expose indexed `poolCurrencies` in PoolKey order; staking entries expose
the cached `stakingAsset`. Other entries use null for these identities. The loader derives
the expected positive movement children from the payload and validates their exact count,
order, assets, amounts, actors and accounting purpose, including successful zero outputs.

Each canonical position event has one entry keyed by deployment/transaction/log index.
`transactionSender` is transport context. It is not an inferred payer/original caller.
Entries retain their event payload and ordered `movements`. Movements distinguish:

- `wallet`: actual payer debits or recipient credits established by event semantics;
- `internal`: custody reward debit or recycled rebalance withdrawal/mint settlement;
- `entitlement`: earned or forfeited rewards, distinct from payouts.

Amounts are not converted to USD, estimated from prices or scraped from ERC-20 transfers.
Pool currencies follow the indexed PoolKey order; token metadata is cached by chain/address
and remains nullable when contract getters are unavailable. Stake eligibility weights are
STATICS qualification, not reward-asset cash, and produce no synthetic token movement.
Creation-fee entries identify the treasury receipt without guessing the payer.

Mint/burn transfers update independent lifetime ownership rows. PositionCreated/PositionClosed
supply opening/closing entries; ordinary transfers remain visible. StakingPositionCreated
and AggregatedRewardPaid do not duplicate canonical creation/staking or individual claims.
Successful zero fee collections remain visible with no positive movement children.
The creation payload's owner is the original mint recipient. Ownership context follows
observed transfers, including transfers inside the safe-mint callback before PositionCreated.

Filtering by asset matches movement currencies and explicit reward assets. Pool filters
also match exact allocation replacement arrays. Unknown NFTs return 404; valid empty filters
return 200 with an empty list. The history's `openingObserved` indicates whether indexing
observed opening; a late start must not be presented as complete lifetime coverage.

## Pagination and observations

The first page captures the most recent statement-observed block/hash and a cumulative
digest of earlier statement events. Page, ownership history and boundary use one SQL MVCC
snapshot. Subsequent pages remain bound to deployment, NFT, normalized filters, direction,
limit and boundary. New blocks do not enter an existing traversal. Replaying/reorganizing
that boundary returns `409 STATEMENT_HISTORY_CHANGED`; the loader throws
`StatementHistoryChangedError` so callers can explicitly restart. Invalid/mismatched cursors
return 400. The boundary is a statement observation, not a claim of indexer freshness;
`/status` remains the checkpoint source.

## Compatibility and SDK refresh

Requires the coordinated protocol statement events and SDK PR #41. Existing Activity
endpoints remain available; their changed global-claim amount uses actual received value.
The legacy root SDK and `./phase-one` both carry the new bindings. Genesis, credit, batch
and selection timing extensions retain their existing artifacts.

Refresh from a clean statement SDK checkout with:

```sh
STATICS_PROTOCOL_REPOSITORY=/path/to/statics \
STATICS_POSITION_STATEMENT_SDK_REPOSITORY=/path/to/statics-sdk \
  node scripts/vendor-position-statements-sdk.mjs
```

The overlay records the protocol and SDK revisions/checksums and legacy artifact commit. It preserves the
legacy compiled API, regenerates the combined ABI declaration and copies the matching Phase 1
SDK rather than replacing unrelated Genesis/Dollar bindings with the current SDK root.
Use a checkout containing the recorded legacy artifact commit for reproducible refreshes.

## Fresh resync acceptance

These events change topic signatures. A fresh schema resync must target a new disposable
deployment emitting the new signatures. Old Phase 1 logs lack the amounts and allocation
arrays; replay cannot recreate them. Do not estimate absent history or mix event generations
under one deployment ID. No schema migration or preservation of the disposable database is
required. Implementation does not reset or cut over the active fork/database.

1. Build/deploy the coordinated protocol revision into an isolated test profile, with new
   Phase 1 deployment ID and start block. Preserve configured Genesis addresses and deployment
   starts for ownership/credit backfill. Load canonical private RPC configuration in the shell.
2. Set Ponder's standard source configuration for that profile, including
   `PONDER_PHASE_ONE_DEPLOYMENT_ID`, `PONDER_DEPLOYMENT_START_BLOCK`,
   `PONDER_PHASE_ONE_START_BLOCK`, the diamond and PoolManager/hook addresses.
   Select a fresh `PONDER_DATABASE_DIRECTORY` and unused local indexer port. Never point this
   replay at the active profile database.
3. Execute real staking/liquidity/allocation/claim/transfer/closure flows on the disposable
   deployment. Include wrapped calls and repeated events within the same block. Use the
   matching SDK; keep event log indices.
4. Start Ponder, inspect `/ready` and `/status` checkpoint progress, then query lifetime
   statements and the existing Genesis ownership/credit APIs. Compare block-pinned state and
   receipts to the recorded payloads and wallet/internal/entitlement movements separately.
5. Verify ascending/descending pagination during new blocks, cursor restart after an isolated
   rollback/replay, retained closure history, and no duplicate aggregated wallet credits.

Local validation uses real-v4 Foundry flow tests, Solidity event/ABI fixtures, PostgreSQL API
execution and handler/strict-loader tests. Full live-fork Genesis replay acceptance requires
an isolated deployment with the coordinated new events; existing old-event forks cannot
prove it. Record that check as skipped until such a profile is available, never as a pass.
