# Integrated DEX overview

The Markets dashboard at `/app/markets` uses the six additive `/phase-one/market` endpoints. It includes public Phase 1 markets and the inherited Genesis/Doppler canonical market; existing market, allocation, Activity and statement endpoints remain compatible. The selected Phase 1 deployment scopes the unified market registry. Each pool retains its actual source deployment and source kind.

## Configuration and replay

Configure addresses from reviewed deployment manifests, never guessed token symbols. `PONDER_POOL_MANAGER_ADDRESS` and `PONDER_CANONICAL_POOL_ID` identify the inherited market. `PONDER_CANONICAL_LIQUIDITY_START_BLOCK` must precede its PoolManager initialization (default 0); this source filters the canonical ID at the RPC boundary. It backfills initialization and liquidity only. `PONDER_POOL_MANAGER_START_BLOCK` still defines the canonical **swap and price** history start. Configure `PONDER_STATE_VIEW_ADDRESS` for one block-pinned price read at that boundary; without it, prices remain unavailable until the first indexed swap. Earlier price history is unavailable, and the initial 30-minute window is explicitly a spot fallback. Public markets start at `PONDER_PHASE_ONE_START_BLOCK` and enter the registry on `ProtocolPoolCreated`; unrelated PoolManager events are discarded.

| Environment variable                | Meaning / default                                                     |
| ----------------------------------- | --------------------------------------------------------------------- |
| `PONDER_PRICING_QUOTE_USDG`         | Optional reviewed USDG address; default requested quote               |
| `PONDER_PRICING_QUOTE_WETH`         | Reviewed WETH address; fallback only when USDG is unconfigured        |
| `PONDER_PRICING_DECIMALS_USDG`      | Quote decimals, default 6                                             |
| `PONDER_PRICING_DECIMALS_WETH`      | Quote decimals, default 18                                            |
| `PONDER_PRICING_MIN_LIQUIDITY_USDG` | Minimum quote-valued in-range inventory, default 2500 USDG            |
| `PONDER_PRICING_MIN_LIQUIDITY_WETH` | Independent floor, default 1 WETH                                     |
| `PONDER_PRICING_WRAPPED_NATIVE`     | Explicit wrapped/native equivalence; unset means no alias             |
| `PONDER_STATICS_TOKEN_ADDRESS`      | Reviewed STATICS address for gauge-credit valuation and summary price |

This schema adds `dex_pool`, `dex_range`, `dex_history`, and `dex_state`. Replay into a **new** `PONDER_DATABASE_DIRECTORY` (PGlite) or PostgreSQL schema, with both Genesis and Phase 1 sources configured. Do not share a live PGlite directory between processes. Keep the current database and endpoints running until the new process reports `/ready` and `/status` reaches the desired chain head. A local mainnet fork must use its historical relay for pre-snapshot reads; Anvil alone cannot reconstruct inherited logs. Do not reset the active database or infer missing liquidity when replay prerequisites are absent.

The Ponder source imports `lib/indexer/statement-movements.ts` through a relative path. A copied rehearsal project must retain that relative shared module as well as the vendored SDK dependencies. Ponder 0.17.4's committed `_ponder_checkpoint` and build identity are read in the same database snapshot as source rows; tests pin the checkpoint encoding. `/status` remains the public source of freshness. Last market-event time is not a checkpoint.

## Accounting

PoolManager ranges are keyed by pool, sender, ticks and salt. Zero balances retain their historical identity. A negative resulting liquidity rejects indexing instead of hiding incomplete history. All registered liquidity, including direct v4 and POL ranges, contributes principal TVL at the actual spot sqrt price. TVL excludes uncollected LP fees and hook balances.

PoolManager swaps are the price and core-delta source. The matching Phase 1 MarketTape event enriches that same record with hook fees, native fee rate and internal-swap flags. Public records without their matching tape remain incomplete; they are excluded from trading totals. Core input is negative and core output positive. Wallet settlement adds input hook fees and subtracts output hook fees. Genesis trades explicitly expose `settlement: core-pool`; transaction sender is separate from the router/hook sender.

Volume counts one **core input side** per external trade. Internal swaps remain price observations but contribute no volume, fees, recent trades or wallet counts. Native LP fees are estimated as core input × fee ppm / 1,000,000: v4 step rounding makes this an estimate. `protocolFees` means additional Statics hook fees. Harvested Genesis/Doppler LP fees are not added again.

LP bribe accrual uses slots 1–4, indexed funding and managed position topology, with ordered segments. Funding first accounts the previous schedule and rolls remaining funds into the new period. Zero managed in-range liquidity pauses the schedule; topology changes and price crossings alter its denominator. Stopping records earned accrual before excluding remaining treasury sweeps. Claims, allocator bribes and treasury distributions never count as new LP earnings. Integer segment differences preserve rounding across query-window boundaries. Quiet pools extrapolate the last observed schedule to the committed checkpoint; this is modeled accrual, not a claimable balance.

## Prices and estimates

Prices use a 30-minute time-weighted tick, with interpolation/extrapolation of indexed cumulative ticks. Insufficient history explicitly returns `priceFallback: true` and the latest known tick. Negative averages round down. Ratios retain integer precision and token decimal normalization. Unknown decimals prevent token valuation. Token responses include `priceNumerator` and `priceDenominator` so positive sub-quote-unit prices survive integer display rounding.

Only routes anchored to the requested quote are admitted. Candidate edges use **quote-valued in-range inventory**, with both currencies derived from already anchored prices. Disconnected cycles cannot price themselves. Admitted depths are frozen before widest-path selection; equal depths prefer fewer hops and deterministic PoolId ordering. Missing USDG routes remain unpriced; they do not trigger WETH fallback. USDG values are labeled approximately dollars, with no peg guarantee or external feeds.

Current and previous 24-hour volumes use the same current quote prices. Completed UTC days use the daily-close pricing graph and historical range inventory; the current day is provisional. Price change uses the current route at both 24-hour boundaries and is null without historical coverage.

Estimated annualized yield uses estimated LP fees + gauge credits + modeled LP bribe accrual, valued at current prices and divided by current principal TVL. It annualizes over the available history window, capped at seven days, using a 52-week year; less than one day of history returns null. `yieldComponents.windowSeconds` gives the exact window, while `complete` identifies a full seven-day window. Gauge credits are **credited-at-settlement** history, distinct from recycled amounts and reserve accounting. Missing component prices, less than one day of coverage or zero TVL returns null. Shorter windows are labeled with the observed history duration. Claims and late treasury sweeps cannot inflate earnings. The observation's `yieldComponents` states this basis explicitly.

The Markets **Projected LP APR** column is separate from trailing yield. `projectedLpAprBps` annualizes current LP reward rates over the principal value of all indexed managed legs, including out-of-range managed legs, at current quote prices. Direct v4 and other unmanaged positions remain in headline TVL but are excluded from this denominator. This is a pool-average estimate, not an individual concentrated position's return. Only in-range liquidity earns rewards; range width and time in range affect individual returns.

`lpRewardProjection` reports `eligibleValueLocked`, `annualRewardValue`, separate `creatorAnnualRewards` and `gaugeAnnualRewards`, reward asset addresses and `status` (`active`, `paused`, `inactive`). Slots 1–4 already contain the LP share from `PoolRewardFunded.lpAmount`; allocator amounts and trading fees are excluded. Annual creator rewards use each live schedule's budget divided by its full duration, scaled by a 52-week year. Funding resets that schedule with remaining funds plus the LP top-up, so a new indexed top-up changes the projection without waiting for historical accrual. The current activated, unexpired reserve period contributes its STATICS rate at the pool's eligible weight over the full routing denominator; no future reserve budget or catch-up period is predicted. Stopped pools earn no projected rewards. With no managed in-range liquidity, rewards are paused and the projected earning rate is zero. Missing required prices, unknown managed principal or zero managed value returns null APR; older indexers without these fields display an unavailable projection, never a historical yield substitute.

Annualization does not assume the campaign is funded for a year. The current rate applies only while funding lasts and can change with funding, prices, allocations or liquidity. LPs retain their native trading fees in addition. Markets supports `sort=apr`, while `sort=yield` retains its historical meaning. Pool queries refresh every 30 seconds, traversing pages sequentially from a fresh first-page snapshot; indexer snapshot caching still applies.

Reserve responses retain observed budgets and timestamps, `accounted` and `expired`; `emitted` remains the draft-compatible alias for reserve period accounting, not LP payouts. No next-period budget is predicted. Ineligible/stale allocation weight is not silently subtracted from the contract denominator; `othersBps` includes undistributed weight and integer rounding.

The protocol Overview also shows **Pool incentives — next 7 days**, from `weeklyIncentives` on the market emissions response. Its `from` is the committed checkpoint timestamp and `until` is exactly seven days later. Each funded pool lists separate `lp` and `allocator` arrays of `{ token, amount, quoteValue }`, plus pause flags. These are pool-wide externally funded rewards that anyone can fund, not wallet balances. Protocol STATICS slot 0 remains in the existing emissions section and is excluded from these amounts; externally funded STATICS in slots 1–4 is included.

LP schedules are projected to the checkpoint before projecting the following seven days, using the same integer schedule differences as indexed accrual. Allocator schedules come from the existing allocation directory records in the same database snapshot, using remaining budget and remaining duration. Both sides stop at the funded end; no future top-ups are assumed and today's editable allocator percentage is never applied retroactively to existing funding. Out-of-range/zero-liquidity LP streams and zero-weight allocator streams display zero with a paused label. Ended, stopped and invalidated streams do not contribute. Amounts remain visible by token even when no quote price exists. Older API responses without `weeklyIncentives` show unavailable data rather than zero rewards. This adds no browser contract reads, indexing handlers, schema migrations or reindex requirement; the updated indexer API must be deployed alongside the app to supply the new field.

## Endpoints and pagination

Every endpoint accepts `quote=usdg|weth` and returns deployment, committed block/time and actual quote metadata. Amounts are decimal strings. Null means unavailable; totals sum available contributions and include per-metric coverage, so a partial total is not presented as complete.

| Route                         | Parameters and response                                                                |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| `/phase-one/market/summary`   | Current/previous totals, coverage, active/unpriced pools, STATICS price                |
| `/phase-one/market/pools`     | Literal case-insensitive `search`; `sort=volume                                        | valueLocked | fees | yield | apr | created`, `direction=asc | desc`; `limit`default 25, maximum 100;`cursor` |
| `/phase-one/market/tokens`    | Prices, exact price ratios, route IDs, fallback, 24-hour change and traded volume      |
| `/phase-one/market/volume`    | `days` default 30, range 1–90; UTC day buckets, provisional and coverage fields        |
| `/phase-one/market/emissions` | Observed period and allocation weight distribution                                     |
| `/phase-one/market/trades`    | `limit` default 8, range 1–50; latest external trades, settlement/source and log index |

Pool ordering is numeric, null-last, with ascending PoolId ties. A traversal pins an immutable in-memory five-minute snapshot and binds its cursor to deployment, quote, search, sorting and page size. New trading cannot change those pages. Malformed/mismatched cursors return 400; expiry, replay/reorganization or bounded-cache eviction returns 409 `MARKET_SNAPSHOT_CHANGED`. Restart from the first page. Database results are shared across endpoints for 15 seconds, with a 50 MiB / 16-snapshot cache bound. The API does not submit transactions or make RPC calls.

The client uses strict parsers, reads subsequent pages, retains section-specific quote formatting, labels estimates/fallback/coverage, and shows incomplete account holdings explicitly. Development fixtures obey filtering, pagination, empty deployments, day ranges and emission normalization. `NEXT_PUBLIC_DEX_OVERVIEW_FIXTURES` is ignored in production.

## Verified contract semantics

Source reviewed at protocol `a50b3691c0f7d9fdb75ca6c831f7ea7ab6f522d7`:

- `src/liquidity/StaticsSwapFeeHook.sol`: `_chargeUnspecifiedLeg` and `afterSwap` define fee currency packing and raw core delta.
- `src/facets/RangeGaugeCallbackFacet.sol`: MarketTape flags/native LP fee and checkpoint-before-crossing behavior.
- `src/libraries/LibRangeGauge.sol`: `_checkpointStreams`, `fundReward` and `stopGauge` distinguish accrual, paused schedule extension, funding resets and treasury recycling.
- `src/libraries/LibGaugeRouting.sol`: reserve `periodAccounted` includes accounted/recycled routing, not only LP credits.
- `src/genesis/StaticsFeeReceiver.sol`: Genesis harvests existing LP fees; it is not additional swap revenue.

No contract or SDK changes are required. Historical coverage is only as complete as configured source starts and relay availability. The local market-overview 503 on the old application route is separate from these additive endpoints.

## Liquidity range chart

`GET /phase-one/market/depth?pool=<PoolId>` returns ordered initialized-tick net liquidity,
indexed active liquidity, the spot tick/price, tick spacing, observation block/time and
`liquidityComplete`. It uses the same committed market snapshot and performs no RPC reads.
The liquidity screen hides depth bars when inherited range coverage is incomplete. History
windows use the indexed clock, including on time-warped forks, and do not extend chart history
before the first available candle. Pool statistics retain the response's USDG or WETH quote;
WETH values are never formatted as dollars. Empty or failed market responses leave onchain
liquidity management available.

## Pool fee labels

Overview shows the LP fee separately from the input/output hook rates in the fee tooltip.
Their displayed sum is a nominal approximation, not an exact execution quote. Unknown hook
rates display as unavailable rather than as zero. Genesis uses its native LP rate.

`PublicHook:DefaultFeeRateSet` updates indexed public pools that inherit the defaults;
explicit pool overrides remain unchanged. This handler uses database state without RPC reads.
Existing indexer databases need replay from the configured hook deployment start to recover
previously unhandled default changes. No schema migration is required. Restarting alone does
not recover past events; the active local database is not reset by this change.

## Protocol overview

The Phase 1 home at `/app` reuses these market endpoints for totals, top pools and trades.
It also reads deployment-scoped `/phase-one/gauges` and `/phase-one/activity?limit=10`,
plus the deployment diamond's `totalStaked` and `rewardAsset` views.
Reward-asset discovery is limited to ERC-20 assets in reviewed supported pools.
Connected-wallet data reuses the accounts and Genesis portfolio queries; unavailable reads
remain unknown instead of becoming zero balances. Overview queries reconcile after confirmed
transactions and public protocol data refreshes every 30 seconds.

The Operator supply chart shows current vault inventory and circulation without assuming
that the initial treasury allocation is still held. Expired activated gauge periods are
separate from reserves that have never been activated and from unavailable emissions data.
