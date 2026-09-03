import { createPublicClient, http, parseAbi, type PublicClient } from "viem";

import { dopplerStaticsTokenAbi, v4QuoterAbi } from "@statics-protocol/sdk";

import { deploymentRegistry, ROBINHOOD_GENESIS_DEPLOYMENT_ID } from "@/lib/deployments/registry";
import type { LaunchDeployment } from "@/lib/deployments/types";
import { currentGenesisVaultAbi } from "@/lib/genesis/current-vault";
import {
  canonicalPrices,
  canonicalWethPerStaticsFromPrice1Per0,
  feeAdjustedImpactBps,
  findMaximumDepthInput,
  priceChangeBps,
  publicDistributedSupply,
  staticsUsdPriceWad,
  strictLiquidFloat,
  usdValueWad,
} from "@/lib/market/analytics";
import type {
  MarketDepthLevel,
  MarketSupplySnapshot,
  StaticsMarketOverview,
} from "@/lib/market/types";
import { poolKeyForLaunch } from "@/lib/trade/canonical-market";
import { loadEthUsd } from "@/lib/server/eth-usd";
import { verifyLaunchDeploymentOnServer } from "@/lib/server/launch-verification";
import { robinhoodRpcUrl } from "@/lib/server/robinhood-rpc";
import { staticsMainnetIndexerUrl } from "@/lib/server/statics-indexer-url";

const reservesLensAbi = parseAbi([
  "function getPoolTVL(address manager, (address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) key) view returns ((uint256 coreAmount0,uint256 coreAmount1,uint256 hookReserves0,uint256 hookReserves1,uint256 hookEffective0,uint256 hookEffective1,uint160 sqrtPriceX96,int24 tick,uint128 activeLiquidity,uint256 blockNumber,address statsProvider,uint16 hookPermissions,bool hasCustomAccounting,uint8 statsStatus) tvl)",
]);
const vestingAbi = parseAbi([
  "function vestingOf(address beneficiary,uint256 scheduleId) view returns (uint256 totalAmount,uint256 releasedAmount)",
]);

const SNAPSHOT_TTL_MS = 60_000;
const SUPPLY_MAX_STALE_MS = 30 * 60_000;
const DEPTH_TTL_MS = 5 * 60_000;
const DEPTH_MAX_STALE_MS = 15 * 60_000;
const DEPTH_TARGETS = [100, 200, 500] as const;

type IndexedActivity = Readonly<{
  deploymentId: string;
  from: string;
  to: string;
  volume0: string;
  volume1: string;
  zeroForOneCount: number;
  oneForZeroCount: number;
  swapCount: number;
  openPrice1Per0Wad: string | null;
  highPrice1Per0Wad: string | null;
  lowPrice1Per0Wad: string | null;
  closePrice1Per0Wad: string | null;
  lastBlock: string | null;
  lastTimestamp: string | null;
  lastLogIndex: number | null;
}>;

type Activity = Readonly<{
  wethVolume: bigint;
  staticsVolume: bigint;
  swaps: number;
  buys: number;
  sells: number;
  priceChangeBps: number;
  highWethPerStaticsWad: bigint | null;
  lowWethPerStaticsWad: bigint | null;
  lastWethPerStaticsWad: bigint | null;
  indexedAt: string | null;
}>;

type DepthCache = Readonly<{
  value: NonNullable<StaticsMarketOverview["depth"]>;
  fetchedAt: number;
  stale: boolean;
}>;

type MarketFundamentals = Readonly<{
  deployment: LaunchDeployment;
  client: PublicClient;
  blockNumber: bigint;
  poolStatics: bigint;
  poolWeth: bigint;
  prices: ReturnType<typeof canonicalPrices>;
  totalSupply: bigint;
  unreleasedTreasury: bigint;
  vaultBacking: bigint;
  publicDistributed: bigint;
  liquidFloat: bigint;
}>;

type FundamentalsCache = Readonly<{
  value: MarketFundamentals;
  fetchedAt: number;
}>;

let snapshotCache: Readonly<{ value: StaticsMarketOverview; fetchedAt: number }> | null = null;
let snapshotInFlight: Promise<StaticsMarketOverview> | null = null;
let spotSnapshotCache: Readonly<{ value: StaticsMarketOverview; fetchedAt: number }> | null = null;
let spotSnapshotInFlight: Promise<StaticsMarketOverview> | null = null;
let fundamentalsCache: FundamentalsCache | null = null;
let fundamentalsInFlight: Promise<FundamentalsCache> | null = null;
let depthCache: DepthCache | null = null;
let depthInFlight: Promise<DepthCache | null> | null = null;

function mainnetLaunch(): LaunchDeployment {
  const deployment = deploymentRegistry().find(
    (option) => option.descriptor.deploymentId === ROBINHOOD_GENESIS_DEPLOYMENT_ID
  )?.launch;
  if (!deployment?.analytics) {
    throw new Error("The reviewed Robinhood launch analytics manifest is unavailable.");
  }
  return deployment;
}

function nullableUnsigned(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && /^\d+$/.test(value));
}

function validIndexedActivity(value: unknown): value is IndexedActivity {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.deploymentId === "string" &&
    ["from", "to", "volume0", "volume1"].every(
      (key) => typeof row[key] === "string" && /^\d+$/.test(row[key])
    ) &&
    [
      "openPrice1Per0Wad",
      "highPrice1Per0Wad",
      "lowPrice1Per0Wad",
      "closePrice1Per0Wad",
      "lastBlock",
      "lastTimestamp",
    ].every((key) => nullableUnsigned(row[key])) &&
    (row.lastLogIndex === null ||
      (typeof row.lastLogIndex === "number" &&
        Number.isSafeInteger(row.lastLogIndex) &&
        row.lastLogIndex >= 0)) &&
    ["zeroForOneCount", "oneForZeroCount", "swapCount"].every(
      (key) => typeof row[key] === "number" && Number.isSafeInteger(row[key]) && row[key] >= 0
    )
  );
}

async function loadActivity(deployment: LaunchDeployment, now: number): Promise<Activity | null> {
  try {
    const url = staticsMainnetIndexerUrl("market/activity");
    url.searchParams.set("from", String(Math.floor(now / 1_000) - 24 * 60 * 60));
    url.searchParams.set("to", String(Math.floor(now / 1_000)));
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(4_000),
    });
    const activity: unknown = response.ok ? await response.json() : null;
    if (!validIndexedActivity(activity)) return null;
    const staticsIsCurrency0 =
      deployment.market.poolKey.currency0.toLowerCase() ===
      deployment.contracts.statics.toLowerCase();
    const canonical = (value: string | null) =>
      value === null
        ? null
        : canonicalWethPerStaticsFromPrice1Per0(BigInt(value), staticsIsCurrency0);
    const open = canonical(activity.openPrice1Per0Wad);
    const close = canonical(activity.closePrice1Per0Wad);
    const rawHigh = canonical(activity.highPrice1Per0Wad);
    const rawLow = canonical(activity.lowPrice1Per0Wad);
    const high = staticsIsCurrency0 ? rawHigh : rawLow;
    const low = staticsIsCurrency0 ? rawLow : rawHigh;
    return {
      wethVolume: BigInt(staticsIsCurrency0 ? activity.volume1 : activity.volume0),
      staticsVolume: BigInt(staticsIsCurrency0 ? activity.volume0 : activity.volume1),
      swaps: activity.swapCount,
      buys: staticsIsCurrency0 ? activity.oneForZeroCount : activity.zeroForOneCount,
      sells: staticsIsCurrency0 ? activity.zeroForOneCount : activity.oneForZeroCount,
      priceChangeBps: open === null || close === null ? 0 : priceChangeBps(open, close),
      highWethPerStaticsWad: high,
      lowWethPerStaticsWad: low,
      lastWethPerStaticsWad: close,
      indexedAt:
        activity.lastTimestamp === null
          ? null
          : new Date(Number(BigInt(activity.lastTimestamp)) * 1_000).toISOString(),
    };
  } catch {
    return null;
  }
}

async function quote(
  client: PublicClient,
  deployment: LaunchDeployment,
  zeroForOne: boolean,
  amountIn: bigint,
  blockNumber: bigint
): Promise<bigint | null> {
  if (amountIn <= 0n || amountIn > (1n << 128n) - 1n) return null;
  try {
    const result = await client.simulateContract({
      address: deployment.contracts.quoter,
      abi: v4QuoterAbi,
      functionName: "quoteExactInputSingle",
      args: [
        {
          poolKey: poolKeyForLaunch(deployment),
          zeroForOne,
          exactAmount: amountIn,
          hookData: "0x",
        },
      ],
      blockNumber,
    });
    return result.result[0];
  } catch {
    return null;
  }
}

async function depthLevel(
  client: PublicClient,
  deployment: LaunchDeployment,
  zeroForOne: boolean,
  high: bigint,
  targetImpactBps: number,
  outputPerInputWad: bigint,
  inputUsdWad: bigint | null,
  blockNumber: bigint
): Promise<MarketDepthLevel> {
  const result = await findMaximumDepthInput(high, targetImpactBps, async (candidate) => {
    const output = await quote(client, deployment, zeroForOne, candidate, blockNumber);
    return output
      ? {
          amountOut: output,
          impactBps: feeAdjustedImpactBps(
            candidate,
            output,
            outputPerInputWad,
            deployment.market.poolKey.fee
          ),
        }
      : null;
  });
  if (!result) throw new Error("Canonical Quoter depth is unavailable.");
  const staticsIsCurrency0 =
    deployment.market.poolKey.currency0.toLowerCase() ===
    deployment.contracts.statics.toLowerCase();
  const inputIsStatics = zeroForOne === staticsIsCurrency0;
  return {
    targetImpactBps,
    actualImpactBps: result.impactBps,
    inputToken: inputIsStatics ? "STATICS" : "WETH",
    outputToken: inputIsStatics ? "WETH" : "STATICS",
    amountIn: result.amountIn.toString(),
    amountOut: result.amountOut.toString(),
    inputUsdWad: inputUsdWad === null ? null : usdValueWad(result.amountIn, inputUsdWad).toString(),
  };
}

async function calculateDepth(
  client: PublicClient,
  deployment: LaunchDeployment,
  prices: ReturnType<typeof canonicalPrices>,
  poolStatics: bigint,
  poolWeth: bigint,
  ethUsdWad: bigint | null,
  staticsUsdWad: bigint | null,
  blockNumber: bigint
): Promise<NonNullable<StaticsMarketOverview["depth"]>> {
  const staticsIsCurrency0 =
    deployment.market.poolKey.currency0.toLowerCase() ===
    deployment.contracts.statics.toLowerCase();
  const buyZeroForOne = !staticsIsCurrency0;
  const buys = await Promise.all(
    DEPTH_TARGETS.map((target) =>
      depthLevel(
        client,
        deployment,
        buyZeroForOne,
        poolWeth,
        target,
        prices.staticsPerWethWad,
        ethUsdWad,
        blockNumber
      )
    )
  );
  const sells = await Promise.all(
    DEPTH_TARGETS.map((target) =>
      depthLevel(
        client,
        deployment,
        !buyZeroForOne,
        poolStatics,
        target,
        prices.wethPerStaticsWad,
        staticsUsdWad,
        blockNumber
      )
    )
  );
  return { buyStatics: buys, sellStatics: sells };
}

async function loadDepth(
  client: PublicClient,
  deployment: LaunchDeployment,
  prices: ReturnType<typeof canonicalPrices>,
  poolStatics: bigint,
  poolWeth: bigint,
  ethUsdWad: bigint | null,
  staticsUsdWad: bigint | null,
  blockNumber: bigint,
  now: number
): Promise<DepthCache | null> {
  if (depthCache && now - depthCache.fetchedAt <= DEPTH_TTL_MS) {
    return { ...depthCache, stale: false };
  }
  if (!depthInFlight) {
    depthInFlight = calculateDepth(
      client,
      deployment,
      prices,
      poolStatics,
      poolWeth,
      ethUsdWad,
      staticsUsdWad,
      blockNumber
    )
      .then((value) => {
        depthCache = { value, fetchedAt: now, stale: false };
        return depthCache;
      })
      .catch(() =>
        depthCache && now - depthCache.fetchedAt <= DEPTH_MAX_STALE_MS
          ? { ...depthCache, stale: true }
          : null
      )
      .finally(() => {
        depthInFlight = null;
      });
  }
  return depthInFlight;
}

async function refreshFundamentals(now: number): Promise<FundamentalsCache> {
  const deployment = mainnetLaunch();
  const analytics = deployment.analytics!;
  await verifyLaunchDeploymentOnServer(deployment).verification;
  const client = createPublicClient({
    transport: http(robinhoodRpcUrl(deployment.descriptor.chainId)),
  });
  const blockNumber = await client.getBlockNumber();
  const poolKey = poolKeyForLaunch(deployment);
  const [pool, accounting, totalSupply, vesting] = await Promise.all([
    client.readContract({
      address: analytics.reservesLens.address,
      abi: reservesLensAbi,
      functionName: "getPoolTVL",
      args: [deployment.contracts.poolManager, poolKey],
      blockNumber,
    }),
    client.readContract({
      address: deployment.contracts.vault,
      abi: currentGenesisVaultAbi,
      functionName: "vaultAccounting",
      blockNumber,
    }),
    client.readContract({
      address: deployment.contracts.statics,
      abi: dopplerStaticsTokenAbi,
      functionName: "totalSupply",
      blockNumber,
    }),
    client.readContract({
      address: deployment.contracts.statics,
      abi: vestingAbi,
      functionName: "vestingOf",
      args: [analytics.treasuryBeneficiary, 0n],
      blockNumber,
    }),
  ]);
  const staticsIsCurrency0 =
    deployment.market.poolKey.currency0.toLowerCase() ===
    deployment.contracts.statics.toLowerCase();
  const poolStatics = staticsIsCurrency0 ? pool.coreAmount0 : pool.coreAmount1;
  const poolWeth = staticsIsCurrency0 ? pool.coreAmount1 : pool.coreAmount0;
  const prices = canonicalPrices(
    pool.sqrtPriceX96,
    deployment.market.poolKey.currency0,
    deployment.contracts.statics
  );
  const unreleasedTreasury = vesting[0] > vesting[1] ? vesting[0] - vesting[1] : 0n;
  return {
    fetchedAt: now,
    value: {
      deployment,
      client,
      blockNumber,
      poolStatics,
      poolWeth,
      prices,
      totalSupply,
      unreleasedTreasury,
      vaultBacking: accounting.tokenBacking,
      publicDistributed: publicDistributedSupply(poolStatics),
      liquidFloat: strictLiquidFloat(
        totalSupply,
        poolStatics,
        unreleasedTreasury,
        accounting.tokenBacking
      ),
    },
  };
}

async function loadFundamentals(now: number, allowStale: boolean): Promise<FundamentalsCache> {
  if (fundamentalsCache && now - fundamentalsCache.fetchedAt <= SNAPSHOT_TTL_MS) {
    return fundamentalsCache;
  }
  if (!fundamentalsInFlight) {
    fundamentalsInFlight = refreshFundamentals(now)
      .then((value) => {
        fundamentalsCache = value;
        return value;
      })
      .finally(() => {
        fundamentalsInFlight = null;
      });
  }
  try {
    return await fundamentalsInFlight;
  } catch (error) {
    if (
      allowStale &&
      fundamentalsCache &&
      now - fundamentalsCache.fetchedAt <= SUPPLY_MAX_STALE_MS
    ) {
      return fundamentalsCache;
    }
    throw error;
  }
}

export async function loadMarketSupplySnapshot(now = Date.now()): Promise<MarketSupplySnapshot> {
  const fundamentals = await loadFundamentals(now, true);
  const { value } = fundamentals;
  return {
    status: now - fundamentals.fetchedAt <= SNAPSHOT_TTL_MS ? "fresh" : "stale",
    chainId: value.deployment.descriptor.chainId,
    deploymentId: value.deployment.descriptor.deploymentId,
    tokenAddress: value.deployment.contracts.statics,
    decimals: 18,
    asOfBlock: value.blockNumber.toString(),
    snapshotAt: new Date(fundamentals.fetchedAt).toISOString(),
    total: value.totalSupply.toString(),
    poolInventory: value.poolStatics.toString(),
    publicDistributed: value.publicDistributed.toString(),
    unreleasedTreasury: value.unreleasedTreasury.toString(),
    vaultBacking: value.vaultBacking.toString(),
    strictLiquidFloat: value.liquidFloat.toString(),
  };
}

async function refreshOverview(now: number, includeDepth: boolean): Promise<StaticsMarketOverview> {
  const deployment = mainnetLaunch();
  const [fundamentals, ethUsd, activity] = await Promise.all([
    loadFundamentals(now, false),
    loadEthUsd(now),
    loadActivity(deployment, now),
  ]);
  const {
    client,
    blockNumber,
    poolStatics,
    poolWeth,
    prices,
    totalSupply,
    unreleasedTreasury,
    vaultBacking,
    publicDistributed,
    liquidFloat,
  } = fundamentals.value;
  const ethUsdWad = ethUsd?.valueWad ?? null;
  const staticsUsdWad =
    ethUsdWad === null ? null : staticsUsdPriceWad(prices.wethPerStaticsWad, ethUsdWad);
  const depth = includeDepth
    ? await loadDepth(
        client,
        deployment,
        prices,
        poolStatics,
        poolWeth,
        ethUsdWad,
        staticsUsdWad,
        blockNumber,
        now
      )
    : null;
  const partial = !activity || ethUsdWad === null || (includeDepth && !depth);
  const stale = Boolean(ethUsd?.stale || (includeDepth && depth?.stale));
  return {
    schemaVersion: 1,
    status: partial ? "partial" : stale ? "stale" : "fresh",
    chainId: deployment.descriptor.chainId,
    deploymentId: deployment.descriptor.deploymentId,
    poolId: deployment.market.poolId,
    asOfBlock: blockNumber.toString(),
    price: {
      staticsPerWethWad: prices.staticsPerWethWad.toString(),
      wethPerStaticsWad: prices.wethPerStaticsWad.toString(),
      ethUsdWad: ethUsdWad?.toString() ?? null,
      staticsUsdWad: staticsUsdWad?.toString() ?? null,
    },
    supply: {
      total: totalSupply.toString(),
      poolInventory: poolStatics.toString(),
      publicDistributed: publicDistributed.toString(),
      unreleasedTreasury: unreleasedTreasury.toString(),
      vaultBacking: vaultBacking.toString(),
      strictLiquidFloat: liquidFloat.toString(),
    },
    valuation: {
      fdvUsdWad: staticsUsdWad === null ? null : usdValueWad(totalSupply, staticsUsdWad).toString(),
      publicMarketCapUsdWad:
        staticsUsdWad === null ? null : usdValueWad(publicDistributed, staticsUsdWad).toString(),
      liquidFloatMarketCapUsdWad:
        staticsUsdWad === null ? null : usdValueWad(liquidFloat, staticsUsdWad).toString(),
    },
    liquidity: {
      principalWeth: poolWeth.toString(),
      principalStatics: poolStatics.toString(),
      tvlUsdWad:
        ethUsdWad === null || staticsUsdWad === null
          ? null
          : (usdValueWad(poolWeth, ethUsdWad) + usdValueWad(poolStatics, staticsUsdWad)).toString(),
    },
    activity24h: activity
      ? {
          available: true,
          wethVolume: activity.wethVolume.toString(),
          staticsVolume: activity.staticsVolume.toString(),
          swaps: activity.swaps,
          buys: activity.buys,
          sells: activity.sells,
          priceChangeBps: activity.priceChangeBps,
          highWethPerStaticsWad: activity.highWethPerStaticsWad?.toString() ?? null,
          lowWethPerStaticsWad: activity.lowWethPerStaticsWad?.toString() ?? null,
          lastWethPerStaticsWad: activity.lastWethPerStaticsWad?.toString() ?? null,
          lastTradeAt: activity.indexedAt,
        }
      : {
          available: false,
          wethVolume: "0",
          staticsVolume: "0",
          swaps: 0,
          buys: 0,
          sells: 0,
          priceChangeBps: 0,
          highWethPerStaticsWad: null,
          lowWethPerStaticsWad: null,
          lastWethPerStaticsWad: null,
          lastTradeAt: null,
        },
    depth: depth?.value ?? null,
    freshness: {
      indexedAt: activity?.indexedAt ?? null,
      snapshotAt: new Date(now).toISOString(),
      depthAt: depth ? new Date(depth.fetchedAt).toISOString() : null,
      usdPriceAt: ethUsd ? new Date(ethUsd.fetchedAt).toISOString() : null,
      usdPriceStale: ethUsd?.stale ?? false,
    },
  };
}

export async function loadMarketOverview(now = Date.now()): Promise<StaticsMarketOverview> {
  if (snapshotCache && now - snapshotCache.fetchedAt <= SNAPSHOT_TTL_MS) return snapshotCache.value;
  if (!snapshotInFlight) {
    snapshotInFlight = refreshOverview(now, true)
      .then((value) => {
        snapshotCache = { value, fetchedAt: now };
        return value;
      })
      .finally(() => {
        snapshotInFlight = null;
      });
  }
  return snapshotInFlight;
}

export async function loadMarketSpotOverview(now = Date.now()): Promise<StaticsMarketOverview> {
  if (spotSnapshotCache && now - spotSnapshotCache.fetchedAt <= SNAPSHOT_TTL_MS) {
    return spotSnapshotCache.value;
  }
  if (!spotSnapshotInFlight) {
    spotSnapshotInFlight = refreshOverview(now, false)
      .then((value) => {
        spotSnapshotCache = { value, fetchedAt: now };
        return value;
      })
      .finally(() => {
        spotSnapshotInFlight = null;
      });
  }
  return spotSnapshotInFlight;
}

export function resetMarketOverviewCacheForTest(): void {
  snapshotCache = null;
  snapshotInFlight = null;
  spotSnapshotCache = null;
  spotSnapshotInFlight = null;
  fundamentalsCache = null;
  fundamentalsInFlight = null;
  depthCache = null;
  depthInFlight = null;
}
