# Allocation directory indexer

`GET /phase-one/allocation-pools` supplies public-pool discovery for allocation management. It does not enumerate a wallet, estimate claimable rewards, submit transactions, or make RPC calls. Existing Phase 1 endpoints retain their responses.

## Queries and pagination

| Parameter       | Default  | Meaning                                                                                                                                                |
| --------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `search`        | empty    | Trimmed, case-insensitive literal substring of pool ID, currency address, symbol or name. `%` and `_` are ordinary characters. Maximum 256 characters. |
| `eligible`      | `true`   | Only eligible pools. `false` and `all` both include ineligible pools with reasons.                                                                     |
| `hasIncentives` | omitted  | `true` includes pools with funded allocator streams; `false` includes pools without them.                                                              |
| `sort`          | `weight` | `weight`, `incentives`, or `created`.                                                                                                                  |
| `direction`     | `desc`   | `asc` or `desc`, including the PoolId tie-breaker.                                                                                                     |
| `limit`         | `25`     | Integer from 1 through 100.                                                                                                                            |
| `cursor`        | omitted  | Opaque cursor from the preceding page. Retain the same deployment, normalized filters, ordering and page size.                                         |

The response contains `deploymentId`, `directoryRevision`, `indexedAtBlock`, `indexedAtTimestamp`, `reserve`, `items`, `nextCursor`, and the full filtered `total`. Bigints are decimal strings. Empty/unobserved directories return null observation fields and reserve. Individual metadata fields may be null; decimals are never assumed to be 18.

Each item includes its PoolKey, creator, currencies and metadata, allocation eligibility/reasons, weight and staleness, lifecycle/quarantine/restriction flags, eligibility versions, allocator stream snapshots, incentive count, and creation/update/observation provenance. Stream fields include slot, reward metadata, allocator share, funding restriction sequence, eligibility version, timing, budget/emitted amounts, termination, observed block/time, and derived rate/status fields.

An incentive is a stream with a positive remaining budget and duration, a matching current eligibility version, and no stored termination. A stream paused at zero weight still counts. Incentive sorting uses this **stream count**; amounts in different tokens are not added or valued.

All page data, count, reserve and revision are read in one PostgreSQL statement. Relevant indexed directory changes advance the revision. A stale cursor returns HTTP 409 with `code: "DIRECTORY_CHANGED"`; restart at the first page. Invalid or differently scoped cursors return 400. `loadAllocationDirectory` exposes a typed `AllocationDirectoryChangedError`. It does not automatically join pages from different revisions.

## Eligibility and observations

Quarantine pauses trading but does not make a public pool ineligible for allocations. Eligibility requires an initialized, running gauge and unrestricted currencies. Decommission stops the gauge. The restriction nonce increments on restriction addition, so removing a restriction permits new allocations but cannot revive an old allocation/stream version. Stale weight is not subtracted from the contract's reserve denominator.

Rates describe the **stored schedule observation**, not guaranteed live emissions. The remaining nominal rate is `(periodBudget - periodEmitted) / (periodFinish - lastUpdate)`. `rateNumerator` and `rateDenominator` preserve the exact fraction; `nominalRatePerSecond` is its floor. `ratePerSecond` is zero for paused, invalidated, terminated or exhausted observations. Tiny funded streams can have a zero integer rate and a positive numerator. `funded`, `paused`, and `invalidated` distinguish these cases.

A reserve's `periodExpired` is evaluated against the directory observation timestamp. Its budget remains the observed period's budget; no next-period budget is projected. Freshness relative to the chain comes from Ponder's existing `/status`, not the last directory event. Consumers must use that checkpoint and the per-stream observation fields when presenting freshness.

Some contract checkpoint calls change allocator streams without emitting an event. Allocation events do not contain pool IDs, so temporary pools entered and left within one block cannot always be discovered. The indexer refreshes the union of the previous indexed set and the block-ending set, never infers intermediate state from outer calldata. These limits make the directory observational; simulations and onchain state remain authoritative for actions.

Metadata is cached per chain/address and each ERC-20 field is read independently at the event block. Standard string and bytes32 symbol/name encodings are supported. Deterministic getter failures become null; transport failures fail/retry indexing rather than permanently caching missing metadata. Configure native metadata with `PONDER_NATIVE_CURRENCY_SYMBOL`, `PONDER_NATIVE_CURRENCY_NAME`, and `PONDER_NATIVE_CURRENCY_DECIMALS`; unset fields remain null.

## Contract references and provenance

Semantics were inspected at protocol `e0cdf29a841276060d5f1fb4cf8e67b52cd2a1cc`. The implementation uses PR #80's existing vendored ABI provenance, including Phase 1 SDK revision `6770d0caef5b94b8f102d2a33534970fb31b681e`. It does not update the SDK or protocol checkout.

Relevant contract sources:

- `LibGaugeEligibility.version`: initialized/stopped checks, public pool kinds, currency restrictions and nonce-derived versions.
- `LibGaugeRouting`: allocation replacement, stale-weight abstention and the reserve denominator.
- `LibGaugeBribes.checkpointStream` / `recordFunding`: zero-weight pause, version termination, remaining-budget emission and funding extension.
- `GaugeIncentiveViewFacet`: stored pool-weight, reserve and allocator-stream observations.
- `ProtocolPoolCreationFacet`: gauge initialization before public-pool discovery.
- `ProtocolPoolAdminFacet`: gauge stop and decommission lifecycle events.
- `RewardPolicyFacet`: restriction nonce and schedule checkpoint behavior.

See [Phase 1 replay](phase-one-indexer-replay.md) before running a changed schema against an existing deployment.
