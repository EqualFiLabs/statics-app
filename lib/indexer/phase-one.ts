import { getAddress, isHash, type Address, type Hex } from "viem";

import type { LaunchPoolKey } from "@/lib/deployments/types";
import { configuredIndexerUrlForDeployment, fetchIndexer } from "@/lib/indexer/statics";

export type IndexedPublicPool = Readonly<{
  poolId: Hex;
  creator: Address;
  poolKey: LaunchPoolKey;
  initialSqrtPriceX96: bigint;
  initialTick: number;
  inputFeeBps: number;
  outputFeeBps: number;
  feeRateOverridden: boolean;
  quarantined: boolean;
  rewardRestrictions: Readonly<{ token0: boolean; token1: boolean }>;
  decommissioned: boolean;
  polActivated: boolean;
  createdAtBlock: bigint;
  updatedAtBlock: bigint;
}>;

export type IndexedPhaseOneCandle = Readonly<{
  timestamp: bigint;
  openSqrtPriceX96: bigint;
  highSqrtPriceX96: bigint;
  lowSqrtPriceX96: bigint;
  closeSqrtPriceX96: bigint;
  volume0: bigint;
  volume1: bigint;
  zeroForOneCount: number;
  oneForZeroCount: number;
  swapCount: number;
  firstBlock: bigint;
  lastBlock: bigint;
}>;

export type PhaseOneCandlePage = Readonly<{
  deploymentId: string;
  poolId: Hex;
  indexedAtBlock: bigint | null;
  resolution: number;
  items: readonly IndexedPhaseOneCandle[];
}>;

export type IndexedPhaseOnePosition = Readonly<{
  positionId: bigint;
  owner: Address;
  stakedBalance: bigint;
  activeLegCount: bigint;
  unresolvedObligationCount: bigint;
  updatedAtBlock: bigint;
}>;

export type PhaseOneIndexedPage<T> = Readonly<{
  deploymentId: string;
  indexedAtBlock: bigint;
  items: readonly T[];
  nextCursor?: string | null;
}>;

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`The Phase 1 indexer returned an invalid ${label}.`);
  }
  return value as Record<string, unknown>;
}

function unsignedBigint(value: unknown, label: string): bigint {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new Error(`The Phase 1 indexer returned an invalid ${label}.`);
  }
  return BigInt(value);
}

function integer(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`The Phase 1 indexer returned an invalid ${label}.`);
  }
  return Number(value);
}

function address(value: unknown, label: string): Address {
  try {
    if (typeof value !== "string") throw new Error();
    return getAddress(value);
  } catch {
    throw new Error(`The Phase 1 indexer returned an invalid ${label}.`);
  }
}

function hash(value: unknown, label: string): Hex {
  if (typeof value !== "string" || !isHash(value)) {
    throw new Error(`The Phase 1 indexer returned an invalid ${label}.`);
  }
  return value;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`The Phase 1 indexer returned an invalid ${label}.`);
  }
  return value;
}

function page(value: unknown, deploymentId: string): Record<string, unknown> {
  const body = record(value, "response");
  if (body.deploymentId !== deploymentId) {
    throw new Error("The Phase 1 indexer returned data for a different deployment.");
  }
  if (!Array.isArray(body.items)) {
    throw new Error("The Phase 1 indexer returned an invalid item list.");
  }
  return body;
}

export function parseIndexedPublicPools(
  value: unknown,
  deploymentId: string
): PhaseOneIndexedPage<IndexedPublicPool> {
  const body = page(value, deploymentId);
  return {
    deploymentId,
    indexedAtBlock: unsignedBigint(body.indexedAtBlock, "indexed block"),
    items: (body.items as unknown[]).map((item) => {
      const row = record(item, "public pool");
      const poolKey = record(row.poolKey, "PoolKey");
      return {
        poolId: hash(row.poolId, "PoolId"),
        creator: address(row.creator, "creator"),
        poolKey: {
          currency0: address(poolKey.currency0, "currency0"),
          currency1: address(poolKey.currency1, "currency1"),
          fee: integer(poolKey.fee, "LP fee"),
          tickSpacing: integer(poolKey.tickSpacing, "tick spacing"),
          hooks: address(poolKey.hooks, "hook"),
        },
        initialSqrtPriceX96: unsignedBigint(row.initialSqrtPriceX96, "initial price"),
        initialTick: integer(row.initialTick, "initial tick"),
        inputFeeBps: integer(row.inputFeeBps, "input fee"),
        outputFeeBps: integer(row.outputFeeBps, "output fee"),
        feeRateOverridden: boolean(row.feeRateOverridden, "fee override flag"),
        quarantined: boolean(row.quarantined, "quarantine flag"),
        rewardRestrictions: {
          token0: boolean(
            record(row.rewardRestrictions, "reward restrictions").token0,
            "token0 reward restriction"
          ),
          token1: boolean(
            record(row.rewardRestrictions, "reward restrictions").token1,
            "token1 reward restriction"
          ),
        },
        decommissioned: boolean(row.decommissioned, "decommission flag"),
        polActivated: boolean(row.polActivated, "managed POL flag"),
        createdAtBlock: unsignedBigint(row.createdAtBlock, "creation block"),
        updatedAtBlock: unsignedBigint(row.updatedAtBlock, "update block"),
      };
    }),
  };
}

export function parsePhaseOneCandles(value: unknown, deploymentId: string): PhaseOneCandlePage {
  const body = page(value, deploymentId);
  return {
    deploymentId,
    poolId: hash(body.poolId, "PoolId"),
    indexedAtBlock:
      body.indexedAtBlock === null ? null : unsignedBigint(body.indexedAtBlock, "indexed block"),
    resolution: integer(body.resolution, "candle resolution"),
    items: (body.items as unknown[]).map((item) => {
      const row = record(item, "market candle");
      return {
        timestamp: unsignedBigint(row.timestamp, "candle timestamp"),
        openSqrtPriceX96: unsignedBigint(row.openSqrtPriceX96, "open price"),
        highSqrtPriceX96: unsignedBigint(row.highSqrtPriceX96, "high price"),
        lowSqrtPriceX96: unsignedBigint(row.lowSqrtPriceX96, "low price"),
        closeSqrtPriceX96: unsignedBigint(row.closeSqrtPriceX96, "close price"),
        volume0: unsignedBigint(row.volume0, "token0 volume"),
        volume1: unsignedBigint(row.volume1, "token1 volume"),
        zeroForOneCount: integer(row.zeroForOneCount, "zero-for-one count"),
        oneForZeroCount: integer(row.oneForZeroCount, "one-for-zero count"),
        swapCount: integer(row.swapCount, "swap count"),
        firstBlock: unsignedBigint(row.firstBlock, "first block"),
        lastBlock: unsignedBigint(row.lastBlock, "last block"),
      };
    }),
  };
}

export function parseIndexedPositions(
  value: unknown,
  deploymentId: string
): PhaseOneIndexedPage<IndexedPhaseOnePosition> {
  const body = page(value, deploymentId);
  if (
    body.nextCursor !== undefined &&
    body.nextCursor !== null &&
    typeof body.nextCursor !== "string"
  )
    throw new Error("The Phase 1 indexer returned an invalid cursor.");
  return {
    deploymentId,
    nextCursor: typeof body.nextCursor === "string" ? body.nextCursor : null,
    indexedAtBlock: unsignedBigint(body.indexedAtBlock, "indexed block"),
    items: (body.items as unknown[]).map((item) => {
      const row = record(item, "position");
      return {
        positionId: unsignedBigint(row.positionId, "position ID"),
        owner: address(row.owner, "position owner"),
        stakedBalance: unsignedBigint(row.stakedBalance, "staked balance"),
        activeLegCount: unsignedBigint(row.activeLegCount, "active leg count"),
        unresolvedObligationCount: unsignedBigint(
          row.unresolvedObligationCount,
          "unresolved obligation count"
        ),
        updatedAtBlock: unsignedBigint(row.updatedAtBlock, "update block"),
      };
    }),
  };
}

async function load(
  deploymentId: string,
  path: string,
  indexerUrl?: string | null
): Promise<unknown> {
  const base =
    indexerUrl === undefined ? configuredIndexerUrlForDeployment(deploymentId) : indexerUrl;
  if (!base) throw new Error("No Phase 1 indexer is configured for this deployment.");
  const response = await fetchIndexer(`${base}${path}`, "no-store");
  if (!response.ok) throw new Error(`Phase 1 indexer request failed (${response.status}).`);
  return response.json();
}

export async function loadIndexedPublicPools(
  deploymentId: string,
  indexerUrl?: string | null
): Promise<PhaseOneIndexedPage<IndexedPublicPool>> {
  return parseIndexedPublicPools(
    await load(deploymentId, "/phase-one/pools", indexerUrl),
    deploymentId
  );
}

export async function loadIndexedPhaseOnePositions(
  owner: Address,
  deploymentId: string,
  indexerUrl?: string | null,
  cursor?: string | null
): Promise<PhaseOneIndexedPage<IndexedPhaseOnePosition>> {
  return parseIndexedPositions(
    await load(
      deploymentId,
      `/phase-one/wallets/${getAddress(owner)}/positions${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
      indexerUrl
    ),
    deploymentId
  );
}

export async function loadPhaseOneCandles(input: {
  deploymentId: string;
  poolId: Hex;
  from: bigint;
  to: bigint;
  resolution: 1 | 5 | 15 | 60 | 240 | 1_440;
  indexerUrl?: string | null;
}): Promise<PhaseOneCandlePage> {
  const query = new URLSearchParams({
    pool: input.poolId,
    from: input.from.toString(),
    to: input.to.toString(),
    resolution: input.resolution.toString(),
  });
  return parsePhaseOneCandles(
    await load(input.deploymentId, `/phase-one/market/candles?${query}`, input.indexerUrl),
    input.deploymentId
  );
}

export async function loadIndexedPhaseOnePosition(
  positionId: bigint,
  deploymentId: string
): Promise<IndexedPhaseOnePosition> {
  const body = record(
    await load(deploymentId, `/phase-one/positions/${positionId}`),
    "position response"
  );
  return parseIndexedPositions(
    {
      deploymentId: body.deploymentId,
      indexedAtBlock: body.indexedAtBlock,
      items: [{ ...record(body.position, "position"), updatedAtBlock: body.indexedAtBlock }],
    },
    deploymentId
  ).items[0];
}

export type IndexedManagedLiquidity = Readonly<{
  positionId: bigint;
  poolId: Hex;
  posmTokenId: bigint;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  active: boolean;
}>;

export function parseIndexedManagedLiquidity(
  value: unknown,
  positionId: bigint,
  deploymentId: string,
  owner: Address
): readonly IndexedManagedLiquidity[] {
  const body = record(value, "position response");
  if (body.deploymentId !== deploymentId)
    throw new Error("The indexer returned a different deployment.");
  const position = record(body.position, "position");
  if (unsignedBigint(position.positionId, "position ID") !== positionId)
    throw new Error("The indexer returned a different position.");
  if (address(position.owner, "owner").toLowerCase() !== owner.toLowerCase()) return [];
  if (!Array.isArray(body.managedLiquidity))
    throw new Error("The indexer returned invalid liquidity positions.");
  return body.managedLiquidity.map((item) => {
    const row = record(item, "liquidity position");
    return {
      positionId,
      poolId: hash(row.poolId, "pool"),
      posmTokenId: unsignedBigint(row.posmTokenId, "LP NFT"),
      tickLower: integer(row.tickLower, "lower tick"),
      tickUpper: integer(row.tickUpper, "upper tick"),
      liquidity: unsignedBigint(row.liquidity, "liquidity"),
      active: boolean(row.active, "active liquidity"),
    };
  });
}

export async function loadIndexedManagedLiquidity(
  positionId: bigint,
  deploymentId: string,
  owner: Address
): Promise<readonly IndexedManagedLiquidity[]> {
  return parseIndexedManagedLiquidity(
    await load(deploymentId, `/phase-one/positions/${positionId}`),
    positionId,
    deploymentId,
    owner
  );
}

export type IndexedAllocationSnapshot = Readonly<{
  positionId: bigint;
  nextAllocationAt: bigint;
  totalAllocated: bigint;
  lockedStake: bigint;
  allocations: readonly Readonly<{ poolId: Hex; amount: bigint; eligibilityVersion: Hex }>[];
  updatedAtBlock: bigint;
}>;
export function parseIndexedAllocationSnapshot(
  value: unknown,
  positionId: bigint,
  deploymentId: string,
  owner: Address
): IndexedAllocationSnapshot {
  const body = record(value, "position response");
  if (body.deploymentId !== deploymentId)
    throw new Error("The Phase 1 indexer returned a different deployment.");
  const position = record(body.position, "position");
  if (
    unsignedBigint(position.positionId, "position ID") !== positionId ||
    address(position.owner, "owner").toLowerCase() !== owner.toLowerCase()
  )
    throw new Error("The position does not belong to this wallet.");
  if (body.allocations === null)
    return {
      positionId,
      nextAllocationAt: 0n,
      totalAllocated: 0n,
      lockedStake: 0n,
      allocations: [],
      updatedAtBlock: unsignedBigint(body.indexedAtBlock, "indexed block"),
    };
  const row = record(body.allocations, "allocations");
  if (
    !Array.isArray(row.poolIds) ||
    !Array.isArray(row.amounts) ||
    !Array.isArray(row.eligibilityVersions) ||
    row.poolIds.length !== row.amounts.length ||
    row.poolIds.length !== row.eligibilityVersions.length
  )
    throw new Error("The Phase 1 indexer returned invalid allocation arrays.");
  const amounts = row.amounts,
    versions = row.eligibilityVersions;
  const allocations = row.poolIds.map((poolId, index) => ({
    poolId: hash(poolId, "allocation pool"),
    amount: unsignedBigint(amounts[index], "allocation amount"),
    eligibilityVersion: hash(versions[index], "eligibility version"),
  }));
  if (new Set(allocations.map((entry) => entry.poolId.toLowerCase())).size !== allocations.length)
    throw new Error("The Phase 1 indexer returned duplicate allocation pools.");
  const totalAllocated = unsignedBigint(row.totalAllocated, "allocated stake");
  if (allocations.reduce((total, entry) => total + entry.amount, 0n) !== totalAllocated)
    throw new Error("The Phase 1 indexer returned an inconsistent allocation total.");
  return {
    positionId,
    nextAllocationAt: unsignedBigint(row.nextAllocationAt, "cooldown"),
    totalAllocated,
    lockedStake: unsignedBigint(row.lockedStake, "locked stake"),
    allocations,
    updatedAtBlock: unsignedBigint(row.updatedAtBlock, "allocation block"),
  };
}
export async function loadIndexedAllocationSnapshot(
  positionId: bigint,
  deploymentId: string,
  owner: Address
) {
  return parseIndexedAllocationSnapshot(
    await load(deploymentId, `/phase-one/positions/${positionId}`),
    positionId,
    deploymentId,
    owner
  );
}

const allocationReasons = [
  "gauge-uninitialized",
  "gauge-stopped",
  "decommissioned",
  "currency0-restricted",
  "currency1-restricted",
] as const;
export type AllocationEligibilityReason = (typeof allocationReasons)[number];
function nullableText(value: unknown, label: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string")
    throw new Error(`The Phase 1 indexer returned an invalid ${label}.`);
  return value;
}
function boundedInteger(value: unknown, minimum: number, maximum: number, label: string): number {
  const result = integer(value, label);
  if (result < minimum || result > maximum)
    throw new Error(`The Phase 1 indexer returned an invalid ${label}.`);
  return result;
}
function nullableUnsigned(value: unknown, label: string): bigint | null {
  return value === null ? null : unsignedBigint(value, label);
}
function allocationMetadata(value: unknown) {
  const row = record(value, "token metadata");
  return {
    address: address(row.address, "token address"),
    symbol: nullableText(row.symbol, "symbol"),
    name: nullableText(row.name, "name"),
    decimals: row.decimals === null ? null : boundedInteger(row.decimals, 0, 255, "decimals"),
  };
}
function parseAllocationPool(value: unknown) {
  const row = record(value, "allocation pool"),
    key = record(row.poolKey, "PoolKey"),
    eligibilityRow = record(row.eligibility, "eligibility"),
    restrictions = record(row.restrictionFlags, "restriction flags");
  const token0 = allocationMetadata(row.token0),
    token1 = allocationMetadata(row.token1);
  const poolKey = {
    currency0: address(key.currency0, "currency0"),
    currency1: address(key.currency1, "currency1"),
    hooks: address(key.hooks, "hooks"),
    fee: boundedInteger(key.fee, 0, 0xffffff, "fee"),
    tickSpacing: boundedInteger(key.tickSpacing, 1, 32767, "tick spacing"),
  };
  if (
    poolKey.currency0 !== token0.address ||
    poolKey.currency1 !== token1.address ||
    poolKey.currency0.toLowerCase() >= poolKey.currency1.toLowerCase()
  )
    throw new Error("The Phase 1 indexer returned inconsistent pool currencies.");
  if (
    !Array.isArray(eligibilityRow.reasons) ||
    eligibilityRow.reasons.some((v) => !allocationReasons.includes(v)) ||
    new Set(eligibilityRow.reasons).size !== eligibilityRow.reasons.length
  )
    throw new Error("The Phase 1 indexer returned invalid eligibility reasons.");
  const eligibility = {
    eligible: boolean(eligibilityRow.eligible, "eligibility"),
    reasons: eligibilityRow.reasons as AllocationEligibilityReason[],
  };
  const gaugeInitialized = boolean(row.gaugeInitialized, "gauge initialization"),
    gaugeStopped = boolean(row.gaugeStopped, "gauge stop"),
    decommissioned = boolean(row.decommissioned, "decommission"),
    decommissionStarted = boolean(row.decommissionStarted, "decommission start"),
    decommissionFinalized = boolean(row.decommissionFinalized, "decommission finalization");
  const restrictionFlags = {
    token0: boolean(restrictions.token0, "currency0 restriction"),
    token1: boolean(restrictions.token1, "currency1 restriction"),
  };
  const expectedReasons = [
    !gaugeInitialized && "gauge-uninitialized",
    gaugeStopped && "gauge-stopped",
    decommissioned && "decommissioned",
    restrictionFlags.token0 && "currency0-restricted",
    restrictionFlags.token1 && "currency1-restricted",
  ].filter(Boolean);
  if (
    eligibility.eligible !== (expectedReasons.length === 0) ||
    expectedReasons.join() !== eligibility.reasons.join() ||
    (decommissionFinalized && !decommissionStarted)
  )
    throw new Error("The Phase 1 indexer returned inconsistent eligibility.");
  const weight = unsignedBigint(row.weight, "pool weight"),
    currentVersion = hash(row.currentVersion, "current version"),
    storedVersion = hash(row.storedVersion, "stored version"),
    stale = boolean(row.stale, "stale weight");
  if (stale !== (weight > 0n && storedVersion !== currentVersion))
    throw new Error("The Phase 1 indexer returned inconsistent stale weight.");
  if (!Array.isArray(row.allocatorStreams) || row.allocatorStreams.length > 4)
    throw new Error("The Phase 1 indexer returned invalid allocator streams.");
  const allocatorStreams = row.allocatorStreams.map((value) => {
    const stream = record(value, "allocator stream");
    const result = {
      slot: boundedInteger(stream.slot, 1, 4, "allocator slot"),
      asset: allocationMetadata(stream.asset),
      allocatorShareBps: boundedInteger(stream.allocatorShareBps, 0, 10000, "allocator share"),
      eligibilityVersion: hash(stream.eligibilityVersion, "stream version"),
      fundingRestrictionSequence: unsignedBigint(
        stream.fundingRestrictionSequence,
        "restriction sequence"
      ),
      periodStart: unsignedBigint(stream.periodStart, "stream start"),
      periodFinish: unsignedBigint(stream.periodFinish, "stream finish"),
      lastUpdate: unsignedBigint(stream.lastUpdate, "last update"),
      periodBudget: unsignedBigint(stream.periodBudget, "stream budget"),
      periodEmitted: unsignedBigint(stream.periodEmitted, "stream emitted"),
      terminated: boolean(stream.terminated, "termination"),
      observedAtBlock: unsignedBigint(stream.observedAtBlock, "stream observation block"),
      observedAtTimestamp: unsignedBigint(
        stream.observedAtTimestamp,
        "stream observation timestamp"
      ),
      funded: boolean(stream.funded, "funded stream"),
      paused: boolean(stream.paused, "paused stream"),
      invalidated: boolean(stream.invalidated, "invalidated stream"),
      rateNumerator: unsignedBigint(stream.rateNumerator, "rate numerator"),
      rateDenominator: unsignedBigint(stream.rateDenominator, "rate denominator"),
      nominalRatePerSecond: unsignedBigint(stream.nominalRatePerSecond, "nominal rate"),
      ratePerSecond: unsignedBigint(stream.ratePerSecond, "effective rate"),
    };
    const invalidated = !eligibility.eligible || currentVersion !== result.eligibilityVersion;
    const remaining = result.periodBudget - result.periodEmitted,
      duration =
        result.periodFinish > result.lastUpdate ? result.periodFinish - result.lastUpdate : 0n;
    const funded = !result.terminated && !invalidated && remaining > 0n && duration > 0n,
      paused = funded && weight === 0n;
    if (
      remaining < 0n ||
      result.lastUpdate < result.periodStart ||
      result.observedAtTimestamp < result.lastUpdate ||
      result.invalidated !== invalidated ||
      result.funded !== funded ||
      result.paused !== paused ||
      result.rateNumerator !== (funded ? remaining : 0n) ||
      result.rateDenominator !== (funded ? duration : 0n) ||
      result.nominalRatePerSecond !== (funded ? remaining / duration : 0n) ||
      result.ratePerSecond !== (funded && !paused ? remaining / duration : 0n)
    )
      throw new Error("The Phase 1 indexer returned an inconsistent allocator schedule.");
    return result;
  });
  if (new Set(allocatorStreams.map((s) => s.slot)).size !== allocatorStreams.length)
    throw new Error("The Phase 1 indexer returned duplicate allocator slots.");
  const incentiveStreamCount = boundedInteger(row.incentiveStreamCount, 0, 4, "incentive count");
  if (incentiveStreamCount !== allocatorStreams.filter((s) => s.funded).length)
    throw new Error("The Phase 1 indexer returned an inconsistent incentive count.");
  const createdAtBlock = unsignedBigint(row.createdAtBlock, "creation block"),
    updatedAtBlock = unsignedBigint(row.updatedAtBlock, "update block"),
    weightObservedAtBlock = nullableUnsigned(row.weightObservedAtBlock, "weight observation block"),
    observedAtTimestamp = unsignedBigint(row.observedAtTimestamp, "observation timestamp");
  if (
    createdAtBlock > updatedAtBlock ||
    (weightObservedAtBlock !== null && weightObservedAtBlock > updatedAtBlock) ||
    allocatorStreams.some(
      (s) => s.observedAtBlock > updatedAtBlock || s.observedAtTimestamp > observedAtTimestamp
    )
  )
    throw new Error("The Phase 1 indexer returned inconsistent observation blocks.");
  return {
    poolId: hash(row.poolId, "PoolId"),
    poolKey,
    token0,
    token1,
    creator: address(row.creator, "creator"),
    eligibility,
    weight,
    stale,
    gaugeInitialized,
    gaugeStopped,
    decommissioned,
    decommissionStarted,
    decommissionFinalized,
    quarantined: boolean(row.quarantined, "quarantine"),
    restrictionFlags,
    currentVersion,
    storedVersion,
    allocatorStreams,
    incentiveStreamCount,
    createdAtBlock,
    updatedAtBlock,
    observedAtTimestamp,
    weightObservedAtBlock,
  };
}
export type IndexedAllocationPool = ReturnType<typeof parseAllocationPool>;
export function parseAllocationDirectory(value: unknown, deploymentId: string) {
  const body = page(value, deploymentId);
  const indexedAtBlock = nullableUnsigned(body.indexedAtBlock, "directory block"),
    indexedAtTimestamp = nullableUnsigned(body.indexedAtTimestamp, "directory timestamp"),
    directoryRevision = unsignedBigint(body.directoryRevision, "directory revision");
  const items = (body.items as unknown[]).map(parseAllocationPool),
    total = boundedInteger(body.total, 0, Number.MAX_SAFE_INTEGER, "directory total");
  if (
    items.length > 100 ||
    items.length > total ||
    new Set(items.map((p) => p.poolId.toLowerCase())).size !== items.length ||
    (indexedAtBlock === null) !== (indexedAtTimestamp === null) ||
    (items.length > 0 && indexedAtBlock === null) ||
    items.some(
      (p) => p.updatedAtBlock > indexedAtBlock! || p.observedAtTimestamp > indexedAtTimestamp!
    )
  )
    throw new Error("The Phase 1 indexer returned an inconsistent directory page.");
  const nextCursor = nullableText(body.nextCursor, "directory cursor");
  if (
    nextCursor !== null &&
    (!nextCursor ||
      items.length === 0 ||
      items.length >= total ||
      !/^[A-Za-z0-9_-]+$/.test(nextCursor))
  )
    throw new Error("The Phase 1 indexer returned an invalid directory cursor.");
  let reserve = null;
  if (body.reserve !== null) {
    const row = record(body.reserve, "reserve");
    reserve = {
      activated: boolean(row.activated, "reserve activation"),
      periodBudget: unsignedBigint(row.periodBudget, "reserve budget"),
      periodStart: unsignedBigint(row.periodStart, "reserve start"),
      periodFinish: unsignedBigint(row.periodFinish, "reserve finish"),
      totalAllocatedWeight: unsignedBigint(row.totalAllocatedWeight, "allocated weight"),
      observedAtBlock: unsignedBigint(row.observedAtBlock, "reserve block"),
      observedAtTimestamp: unsignedBigint(row.observedAtTimestamp, "reserve timestamp"),
      periodExpired: boolean(row.periodExpired, "expired period"),
    };
    if (
      reserve.periodStart > reserve.periodFinish ||
      indexedAtBlock === null ||
      reserve.observedAtBlock > indexedAtBlock ||
      reserve.observedAtTimestamp > indexedAtTimestamp! ||
      reserve.periodExpired !==
        (reserve.periodFinish > 0n && reserve.periodFinish <= indexedAtTimestamp!)
    )
      throw new Error("The Phase 1 indexer returned an inconsistent reserve observation.");
  }
  return {
    deploymentId,
    indexedAtBlock,
    indexedAtTimestamp,
    directoryRevision,
    reserve,
    items,
    nextCursor,
    total,
  };
}
export type AllocationDirectoryPage = ReturnType<typeof parseAllocationDirectory>;
export type AllocationDirectoryFilters = Readonly<{
  search?: string;
  eligible?: "true" | "false" | "all";
  hasIncentives?: boolean;
  sort?: "weight" | "incentives" | "created";
  direction?: "asc" | "desc";
  limit?: number;
  cursor?: string;
}>;
export class AllocationDirectoryChangedError extends Error {
  readonly code = "DIRECTORY_CHANGED";
  constructor() {
    super("The allocation directory changed. Restart from the first page.");
    this.name = "AllocationDirectoryChangedError";
  }
}
export async function loadAllocationDirectory(input: {
  deploymentId: string;
  filters?: AllocationDirectoryFilters;
  indexerUrl?: string | null;
}): Promise<AllocationDirectoryPage> {
  const base =
    input.indexerUrl === undefined
      ? configuredIndexerUrlForDeployment(input.deploymentId)
      : input.indexerUrl;
  if (!base) throw new Error("No indexer is configured for this deployment.");
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(input.filters ?? {}))
    if (value !== undefined) query.set(key, String(value));
  const response = await fetchIndexer(
    `${base}/phase-one/allocation-pools${query.size ? `?${query}` : ""}`,
    "no-store"
  );
  if (response.status === 409) {
    const body = record(await response.json(), "directory error");
    if (body.code === "DIRECTORY_CHANGED") throw new AllocationDirectoryChangedError();
  }
  if (!response.ok) throw new Error(`Allocation directory request failed (${response.status}).`);
  return parseAllocationDirectory(await response.json(), input.deploymentId);
}

export { parsePositionStatement } from "./position-statement";
export type {
  PositionStatementPage,
  StatementCategory,
  StatementPayload,
} from "./position-statement";
import { parsePositionStatement, type StatementCategory } from "./position-statement";
export class StatementHistoryChangedError extends Error {
  readonly code = "STATEMENT_HISTORY_CHANGED";
  constructor() {
    super("Statement history changed. Restart from the first page.");
    this.name = "StatementHistoryChangedError";
  }
}
export async function loadPositionStatement(input: {
  deploymentId: string;
  positionId: bigint;
  indexerUrl?: string | null;
  filters?: {
    category?: StatementCategory;
    poolId?: Hex;
    asset?: Address;
    fromBlock?: bigint;
    toBlock?: bigint;
    direction?: "asc" | "desc";
    cursor?: string;
    limit?: number;
  };
}) {
  if (input.positionId < 0n || input.positionId >= 1n << 256n)
    throw new Error("Invalid Position NFT ID.");
  const base =
    input.indexerUrl === undefined
      ? configuredIndexerUrlForDeployment(input.deploymentId)
      : input.indexerUrl;
  if (!base) throw new Error("No indexer is configured for this deployment.");
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(input.filters ?? {}))
    if (value !== undefined) query.set(key, String(value));
  const response = await fetchIndexer(
    `${base}/phase-one/positions/${input.positionId}/statement${query.size ? `?${query}` : ""}`,
    "no-store"
  );
  if (response.status === 409) {
    const error = record(await response.json(), "statement error");
    if (error.code === "STATEMENT_HISTORY_CHANGED") throw new StatementHistoryChangedError();
  }
  if (!response.ok) throw new Error(`Position statement request failed (${response.status}).`);
  return parsePositionStatement(
    await response.json(),
    input.deploymentId,
    input.positionId,
    input.filters?.direction
  );
}
