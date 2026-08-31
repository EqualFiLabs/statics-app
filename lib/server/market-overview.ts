import { createPublicClient, http, parseAbi, type PublicClient } from "viem";

import { dopplerStaticsTokenAbi, v4QuoterAbi } from "@statics-protocol/sdk";

import { deploymentRegistry, ROBINHOOD_GENESIS_DEPLOYMENT_ID } from "@/lib/deployments/registry";
import type { LaunchDeployment } from "@/lib/deployments/types";
import { currentGenesisVaultAbi } from "@/lib/genesis/current-vault";
import {
  canonicalPrices,
  feeAdjustedImpactBps,
  findMaximumDepthInput,
  priceChangeBps,
  publicDistributedSupply,
  staticsUsdPriceWad,
  strictLiquidFloat,
  usdValueWad,
  WAD,
} from "@/lib/market/analytics";
import type { MarketDepthLevel, StaticsMarketOverview } from "@/lib/market/types";
import { poolKeyForLaunch } from "@/lib/trade/canonical-market";
import { loadEthUsd } from "@/lib/server/eth-usd";
import { verifyLaunchDeploymentOnServer } from "@/lib/server/launch-verification";
import { robinhoodRpcUrl } from "@/lib/server/robinhood-rpc";

const reservesLensAbi = parseAbi([
  "function getPoolTVL(address manager, (address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) key) view returns ((uint256 coreAmount0,uint256 coreAmount1,uint256 hookReserves0,uint256 hookReserves1,uint256 hookEffective0,uint256 hookEffective1,uint160 sqrtPriceX96,int24 tick,uint128 activeLiquidity,uint256 blockNumber,address statsProvider,uint16 hookPermissions,bool hasCustomAccounting,uint8 statsStatus) tvl)",
]);
const vestingAbi = parseAbi([
  "function vestingOf(address beneficiary,uint256 scheduleId) view returns (uint256 totalAmount,uint256 releasedAmount)",
]);

const SNAPSHOT_TTL_MS = 60_000;
const DEPTH_TTL_MS = 5 * 60_000;
const DEPTH_MAX_STALE_MS = 15 * 60_000;
const DEPTH_TARGETS = [100, 200, 500] as const;

type Candle = Readonly<{
  timestamp: string;
  openSqrtPriceX96: string;
  closeSqrtPriceX96: string;
  volume0: string;
  volume1: string;
  zeroForOneCount: number;
  oneForZeroCount: number;
  swapCount: number;
  lastBlock: string;
}>;

type Activity = Readonly<{
  wethVolume: bigint;
  staticsVolume: bigint;
  swaps: number;
  buys: number;
  sells: number;
  priceChangeBps: number;
  indexedAt: string | null;
}>;

type DepthCache = Readonly<{
  value: NonNullable<StaticsMarketOverview["depth"]>;
  fetchedAt: number;
  stale: boolean;
}>;

let snapshotCache: Readonly<{ value: StaticsMarketOverview; fetchedAt: number }> | null = null;
let snapshotInFlight: Promise<StaticsMarketOverview> | null = null;
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

function indexerUrl(environment: Record<string, string | undefined> = process.env): URL {
  const raw = environment.NEXT_PUBLIC_STATICS_MAINNET_INDEXER_URL?.trim();
  if (!raw) throw new Error("NEXT_PUBLIC_STATICS_MAINNET_INDEXER_URL is not configured.");
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("The Statics indexer URL must use HTTP(S).");
  }
  return url;
}

function validCandle(value: unknown): value is Candle {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    ["timestamp", "openSqrtPriceX96", "closeSqrtPriceX96", "volume0", "volume1", "lastBlock"].every(
      (key) => typeof row[key] === "string" && /^\d+$/.test(row[key])
    ) &&
    ["zeroForOneCount", "oneForZeroCount", "swapCount"].every(
      (key) => typeof row[key] === "number" && Number.isSafeInteger(row[key]) && row[key] >= 0
    )
  );
}

async function loadActivity(deployment: LaunchDeployment, now: number): Promise<Activity | null> {
  try {
    const url = new URL("market/candles", indexerUrl());
    url.searchParams.set("from", String(Math.floor(now / 1_000) - 24 * 60 * 60));
    url.searchParams.set("to", String(Math.floor(now / 1_000)));
    url.searchParams.set("resolution", "60");
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(4_000),
    });
    const payload: unknown = response.ok ? await response.json() : null;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    const rawItems = (payload as { items?: unknown }).items;
    if (!Array.isArray(rawItems) || !rawItems.every(validCandle)) return null;
    const items = rawItems;
    const staticsIsCurrency0 =
      deployment.market.poolKey.currency0.toLowerCase() ===
      deployment.contracts.statics.toLowerCase();
    const volume0 = items.reduce((sum, item) => sum + BigInt(item.volume0), 0n);
    const volume1 = items.reduce((sum, item) => sum + BigInt(item.volume1), 0n);
    const first = items[0];
    const last = items.at(-1);
    let change = 0;
    if (first && last) {
      const open = canonicalPrices(
        BigInt(first.openSqrtPriceX96),
        deployment.market.poolKey.currency0,
        deployment.contracts.statics
      ).wethPerStaticsWad;
      const close = canonicalPrices(
        BigInt(last.closeSqrtPriceX96),
        deployment.market.poolKey.currency0,
        deployment.contracts.statics
      ).wethPerStaticsWad;
      change = priceChangeBps(open, close);
    }
    return {
      wethVolume: staticsIsCurrency0 ? volume1 : volume0,
      staticsVolume: staticsIsCurrency0 ? volume0 : volume1,
      swaps: items.reduce((sum, item) => sum + item.swapCount, 0),
      buys: items.reduce(
        (sum, item) => sum + (staticsIsCurrency0 ? item.oneForZeroCount : item.zeroForOneCount),
        0
      ),
      sells: items.reduce(
        (sum, item) => sum + (staticsIsCurrency0 ? item.zeroForOneCount : item.oneForZeroCount),
        0
      ),
      priceChangeBps: change,
      indexedAt: last ? new Date(Number(BigInt(last.timestamp)) * 1_000).toISOString() : null,
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

async function refreshOverview(now: number): Promise<StaticsMarketOverview> {
  const deployment = mainnetLaunch();
  const analytics = deployment.analytics!;
  await verifyLaunchDeploymentOnServer(deployment).verification;
  const client = createPublicClient({
    transport: http(robinhoodRpcUrl(deployment.descriptor.chainId)),
  });
  const blockNumber = await client.getBlockNumber();
  const poolKey = poolKeyForLaunch(deployment);
  const [pool, accounting, totalSupply, vesting, ethUsd, activity] = await Promise.all([
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
    loadEthUsd(now),
    loadActivity(deployment, now),
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
  const ethUsdWad = ethUsd?.valueWad ?? null;
  const staticsUsdWad =
    ethUsdWad === null ? null : staticsUsdPriceWad(prices.wethPerStaticsWad, ethUsdWad);
  const unreleasedTreasury = vesting[0] > vesting[1] ? vesting[0] - vesting[1] : 0n;
  const publicDistributed = publicDistributedSupply(poolStatics);
  const liquidFloat = strictLiquidFloat(
    totalSupply,
    poolStatics,
    unreleasedTreasury,
    accounting.tokenBacking
  );
  const depth = await loadDepth(
    client,
    deployment,
    prices,
    poolStatics,
    poolWeth,
    ethUsdWad,
    staticsUsdWad,
    blockNumber,
    now
  );
  const partial = !activity || !depth || ethUsdWad === null;
  const stale = Boolean(ethUsd?.stale || depth?.stale);
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
      vaultBacking: accounting.tokenBacking.toString(),
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
          wethVolume: activity.wethVolume.toString(),
          staticsVolume: activity.staticsVolume.toString(),
          swaps: activity.swaps,
          buys: activity.buys,
          sells: activity.sells,
          priceChangeBps: activity.priceChangeBps,
        }
      : {
          wethVolume: "0",
          staticsVolume: "0",
          swaps: 0,
          buys: 0,
          sells: 0,
          priceChangeBps: 0,
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
    snapshotInFlight = refreshOverview(now)
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

export function resetMarketOverviewCacheForTest(): void {
  snapshotCache = null;
  snapshotInFlight = null;
  depthCache = null;
  depthInFlight = null;
}
