import type { ponder } from "ponder:registry";
import { and, eq, or } from "ponder";
import { staticsGaugeIncentivesAbi, staticsRangeGaugeAbi } from "@statics-protocol/sdk/phase-one";
import {
  erc20Abi,
  getAddress,
  hexToString,
  parseAbi,
  zeroAddress,
  zeroHash,
  type Address,
  type Hex,
  BaseError,
  ContractFunctionRevertedError,
  ContractFunctionZeroDataError,
} from "viem";
import {
  allocationToken,
  allocatorStream,
  allocationDirectoryPool,
  allocationDirectoryState,
  gaugePoolState,
  gaugeReserveState,
  publicPool,
  rewardRestriction,
} from "ponder:schema";
import {
  allocationEligibility,
  allocationTokenKey,
  allocationVersion,
  allocatorSchedule,
  decimalJson,
} from "./allocation-directory";

type Context = Parameters<Parameters<typeof ponder.on>[1]>[0]["context"];
type Observation = { block: { number: bigint; timestamp: bigint } };
const bytes32MetadataAbi = parseAbi([
  "function symbol() view returns (bytes32)",
  "function name() view returns (bytes32)",
]);
function metadataFailure(error: unknown): boolean {
  const deterministic = (e: unknown) =>
    e instanceof ContractFunctionRevertedError ||
    e instanceof ContractFunctionZeroDataError ||
    (e instanceof Error &&
      [
        "AbiDecodingDataSizeTooSmallError",
        "InvalidAbiDecodingTypeError",
        "PositionOutOfBoundsError",
        "AbiDecodingZeroDataError",
        "IntegerOutOfRangeError",
      ].includes(e.name));
  // BaseError.walk returns the final cause even when the predicate never matched.
  return error instanceof BaseError && deterministic(error.walk(deterministic));
}
export async function readTokenMetadata(context: Context, event: Observation, asset: Address) {
  const key = allocationTokenKey(context.chain.id, asset);
  const previous = await context.db.find(allocationToken, { key });
  if (previous) return previous;
  let symbol: string | null = null,
    name: string | null = null,
    decimals: number | null = null;
  if (asset === zeroAddress) {
    // Native metadata is explicit network configuration, never guessed from an ERC-20 call.
    symbol = process.env.PONDER_NATIVE_CURRENCY_SYMBOL?.trim() || null;
    name = process.env.PONDER_NATIVE_CURRENCY_NAME?.trim() || null;
    const configuredDecimals = process.env.PONDER_NATIVE_CURRENCY_DECIMALS;
    if (configuredDecimals !== undefined) {
      const parsed = Number(configuredDecimals);
      if (
        !/^\d+$/.test(configuredDecimals) ||
        !Number.isInteger(parsed) ||
        parsed < 0 ||
        parsed > 255
      )
        throw new Error("Invalid native currency decimals.");
      decimals = parsed;
    }
  } else {
    for (const field of ["symbol", "name"] as const) {
      let value: string | null = null;
      try {
        value = await context.client.readContract({
          address: asset,
          abi: erc20Abi,
          functionName: field,
          blockNumber: event.block.number,
        });
      } catch (error) {
        if (!metadataFailure(error)) throw error;
        try {
          value = hexToString(
            await context.client.readContract({
              address: asset,
              abi: bytes32MetadataAbi,
              functionName: field,
              blockNumber: event.block.number,
            }),
            { size: 32 }
          ).replace(/\0+$/, "");
        } catch (fallbackError) {
          if (!metadataFailure(fallbackError)) throw fallbackError;
        }
      }
      if (field === "symbol") symbol = value;
      else name = value;
    }
    try {
      decimals = await context.client.readContract({
        address: asset,
        abi: erc20Abi,
        functionName: "decimals",
        blockNumber: event.block.number,
      });
    } catch (error) {
      if (!metadataFailure(error)) throw error;
    }
  }
  const row = {
    key,
    chainId: context.chain.id,
    address: asset,
    symbol,
    name,
    decimals,
    observedAtBlock: event.block.number,
  };
  await context.db.insert(allocationToken).values(row).onConflictDoUpdate(row);
  return row;
}

export function allocationSnapshots(deploymentId: string, diamond: Address) {
  const key = (poolId: Hex) => `${deploymentId}:${poolId.toLowerCase()}`;
  async function reserve(context: Context, event: Observation) {
    const state = await context.client.readContract({
      address: diamond,
      abi: staticsGaugeIncentivesAbi,
      functionName: "gaugeReserve",
      blockNumber: event.block.number,
    });
    const row = {
      ...state,
      key: deploymentId,
      deploymentId,
      pendingReleaseAt: BigInt(state.pendingReleaseAt),
      deferredMaturityAt: BigInt(state.deferredMaturityAt),
      scheduleStart: BigInt(state.scheduleStart),
      lastCheckpoint: BigInt(state.lastCheckpoint),
      periodStart: BigInt(state.periodStart),
      periodFinish: BigInt(state.periodFinish),
      allocationCooldown: BigInt(state.allocationCooldown),
      updatedAtBlock: event.block.number,
      updatedAtTimestamp: event.block.timestamp,
    };
    await context.db.insert(gaugeReserveState).values(row).onConflictDoUpdate(row);
    await touch(context, event);
  }
  async function weight(
    context: Context,
    event: Observation,
    poolId: Hex,
    activity?: { lastCredited?: bigint; lastRecycled?: bigint }
  ) {
    const state = await context.client.readContract({
      address: diamond,
      abi: staticsGaugeIncentivesAbi,
      functionName: "gaugePoolWeight",
      args: [poolId],
      blockNumber: event.block.number,
    });
    await context.db
      .insert(gaugePoolState)
      .values({
        key: key(poolId),
        deploymentId,
        poolId,
        ...state,
        lastCredited: activity?.lastCredited ?? 0n,
        lastRecycled: activity?.lastRecycled ?? 0n,
        updatedAtBlock: event.block.number,
      })
      .onConflictDoUpdate({ ...state, ...activity, updatedAtBlock: event.block.number });
  }
  async function streams(context: Context, event: Observation, poolId: Hex) {
    const config = await context.client.readContract({
      address: diamond,
      abi: staticsRangeGaugeAbi,
      functionName: "poolRewardConfig",
      args: [poolId],
      blockNumber: event.block.number,
    });
    // At most four allocator slots. Serial requests bound discovery concurrency.
    for (let slot = 1; slot < config.slotCount; slot++) {
      const state = await context.client.readContract({
        address: diamond,
        abi: staticsGaugeIncentivesAbi,
        functionName: "gaugeAllocatorReward",
        args: [poolId, slot],
        blockNumber: event.block.number,
      });
      if (state.asset === zeroAddress) continue;
      await readTokenMetadata(context, event, getAddress(state.asset));
      const row = {
        key: `${key(poolId)}:${slot}`,
        deploymentId,
        poolId,
        slot,
        asset: getAddress(state.asset),
        allocatorShareBps: config.allocatorShareBps[slot],
        eligibilityVersion: state.eligibilityVersion,
        fundingRestrictionSequence: state.fundingRestrictionSequence,
        periodStart: BigInt(state.periodStart),
        periodFinish: BigInt(state.periodFinish),
        lastUpdate: BigInt(state.lastUpdate),
        periodBudget: state.periodBudget,
        periodEmitted: state.periodEmitted,
        terminated: state.terminated,
        observedAtBlock: event.block.number,
        observedAtTimestamp: event.block.timestamp,
      };
      await context.db.insert(allocatorStream).values(row).onConflictDoUpdate(row);
    }
  }
  async function directory(context: Context, event: Observation, poolId: Hex) {
    const pool = await context.db.find(publicPool, { key: key(poolId) });
    if (!pool) return; // Permissioned or later-phase canonical pools are not this public directory.
    const restriction = async (asset: Hex) =>
      context.db.find(rewardRestriction, { key: `${deploymentId}:${asset.toLowerCase()}` });
    const r0 = await restriction(pool.currency0),
      r1 = await restriction(pool.currency1);
    const eligibility = allocationEligibility(
      pool,
      r0?.restricted ?? false,
      r1?.restricted ?? false
    );
    const currentVersion = eligibility.eligible
      ? allocationVersion(poolId, r0?.nonce ?? 0n, r1?.nonce ?? 0n)
      : zeroHash;
    const state = await context.db.find(gaugePoolState, { key: key(poolId) });
    const poolWeight = state?.weight ?? 0n;
    const token0 = await readTokenMetadata(context, event, getAddress(pool.currency0));
    const token1 = await readTokenMetadata(context, event, getAddress(pool.currency1));
    const storedStreams = await context.db.sql
      .select()
      .from(allocatorStream)
      .where(
        and(eq(allocatorStream.deploymentId, deploymentId), eq(allocatorStream.poolId, poolId))
      );
    const metadata = (token: typeof token0) => ({
      address: token.address,
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
    });
    const allocatorStreams = [];
    for (const stream of storedStreams.sort((a, b) => a.slot - b.slot)) {
      const asset = await readTokenMetadata(context, event, getAddress(stream.asset));
      allocatorStreams.push({
        ...stream,
        key: undefined,
        deploymentId: undefined,
        poolId: undefined,
        asset: metadata(asset),
        ...allocatorSchedule(stream, currentVersion, poolWeight),
      });
    }
    const incentiveStreamCount = allocatorStreams.filter((s) => s.funded).length;
    const details = {
      poolId,
      poolKey: {
        currency0: pool.currency0,
        currency1: pool.currency1,
        hooks: pool.hook,
        fee: pool.lpFee,
        tickSpacing: pool.tickSpacing,
      },
      token0: metadata(token0),
      token1: metadata(token1),
      creator: pool.creator,
      eligibility,
      weight: poolWeight,
      stale: poolWeight > 0n && state?.storedVersion !== currentVersion,
      gaugeInitialized: pool.gaugeInitialized,
      gaugeStopped: pool.gaugeStopped,
      decommissioned: pool.decommissioned,
      decommissionStarted: pool.decommissionStarted,
      decommissionFinalized: pool.decommissionFinalized,
      quarantined: pool.quarantined,
      restrictionFlags: { token0: r0?.restricted ?? false, token1: r1?.restricted ?? false },
      currentVersion,
      storedVersion: state?.storedVersion ?? zeroHash,
      allocatorStreams,
      incentiveStreamCount,
      createdAtBlock: pool.createdAtBlock,
      updatedAtBlock: event.block.number,
      observedAtTimestamp: event.block.timestamp,
      weightObservedAtBlock: state?.updatedAtBlock ?? null,
    };
    const searchText = [
      poolId,
      token0.address,
      token1.address,
      token0.symbol,
      token1.symbol,
      token0.name,
      token1.name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const row = {
      key: key(poolId),
      deploymentId,
      poolId,
      eligible: eligibility.eligible,
      weight: poolWeight,
      incentiveStreamCount,
      createdAtBlock: pool.createdAtBlock,
      searchText,
      detailsJson: decimalJson(details),
    };
    const previous = await context.db.find(allocationDirectoryPool, { key: row.key });
    if (previous?.detailsJson !== row.detailsJson) {
      await context.db.insert(allocationDirectoryPool).values(row).onConflictDoUpdate(row);
      await touch(context, event);
    }
  }
  async function touch(context: Context, event: Observation) {
    await context.db
      .insert(allocationDirectoryState)
      .values({
        key: deploymentId,
        deploymentId,
        revision: 1n,
        indexedAtBlock: event.block.number,
        indexedAtTimestamp: event.block.timestamp,
      })
      .onConflictDoUpdate((row) => ({
        revision: row.revision + 1n,
        indexedAtBlock: event.block.number,
        indexedAtTimestamp: event.block.timestamp,
      }));
  }
  async function pool(context: Context, event: Observation, poolId: Hex) {
    await weight(context, event, poolId);
    await streams(context, event, poolId);
    await directory(context, event, poolId);
  }
  async function affectedByRestriction(context: Context, event: Observation, asset: Address) {
    const affected = await context.db.sql
      .select()
      .from(publicPool)
      .where(
        and(
          eq(publicPool.deploymentId, deploymentId),
          or(eq(publicPool.currency0, asset), eq(publicPool.currency1, asset))
        )
      );
    // Only database-derived eligibility changes; no RPC fan-out over affected pools.
    for (const row of affected) await directory(context, event, row.poolId);
  }
  return { reserve, weight, streams, directory, touch, pool, affectedByRestriction };
}
