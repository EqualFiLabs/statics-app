import type { MarketDepthLevel, StaticsMarketOverview } from "@/lib/market/types";

function unsigned(value: unknown): value is string {
  return typeof value === "string" && /^\d+$/.test(value);
}

function nullableUnsigned(value: unknown): value is string | null {
  return value === null || unsigned(value);
}

function depthLevel(value: unknown): value is MarketDepthLevel {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.targetImpactBps === "number" &&
    typeof row.actualImpactBps === "number" &&
    (row.inputToken === "WETH" || row.inputToken === "STATICS") &&
    (row.outputToken === "WETH" || row.outputToken === "STATICS") &&
    unsigned(row.amountIn) &&
    unsigned(row.amountOut) &&
    nullableUnsigned(row.inputUsdWad)
  );
}

export function isStaticsMarketOverview(value: unknown): value is StaticsMarketOverview {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  const price = data.price as Record<string, unknown> | undefined;
  const supply = data.supply as Record<string, unknown> | undefined;
  const valuation = data.valuation as Record<string, unknown> | undefined;
  const liquidity = data.liquidity as Record<string, unknown> | undefined;
  const activity = data.activity24h as Record<string, unknown> | undefined;
  const freshness = data.freshness as Record<string, unknown> | undefined;
  const depth = data.depth as Record<string, unknown> | null | undefined;
  return Boolean(
    data.schemaVersion === 1 &&
    (data.status === "fresh" || data.status === "stale" || data.status === "partial") &&
    data.chainId === 4_663 &&
    data.deploymentId === "robinhood-genesis" &&
    typeof data.poolId === "string" &&
    unsigned(data.asOfBlock) &&
    price &&
    unsigned(price.staticsPerWethWad) &&
    unsigned(price.wethPerStaticsWad) &&
    nullableUnsigned(price.ethUsdWad) &&
    nullableUnsigned(price.staticsUsdWad) &&
    supply &&
    [
      "total",
      "poolInventory",
      "publicDistributed",
      "unreleasedTreasury",
      "vaultBacking",
      "strictLiquidFloat",
    ].every((key) => unsigned(supply[key])) &&
    valuation &&
    ["fdvUsdWad", "publicMarketCapUsdWad", "liquidFloatMarketCapUsdWad"].every((key) =>
      nullableUnsigned(valuation[key])
    ) &&
    liquidity &&
    unsigned(liquidity.principalWeth) &&
    unsigned(liquidity.principalStatics) &&
    nullableUnsigned(liquidity.tvlUsdWad) &&
    activity &&
    typeof activity.available === "boolean" &&
    unsigned(activity.wethVolume) &&
    unsigned(activity.staticsVolume) &&
    ["swaps", "buys", "sells", "priceChangeBps"].every(
      (key) => typeof activity[key] === "number" && Number.isSafeInteger(activity[key])
    ) &&
    (depth === null ||
      (depth &&
        Array.isArray(depth.buyStatics) &&
        depth.buyStatics.every(depthLevel) &&
        Array.isArray(depth.sellStatics) &&
        depth.sellStatics.every(depthLevel))) &&
    freshness &&
    (freshness.indexedAt === null || typeof freshness.indexedAt === "string") &&
    typeof freshness.snapshotAt === "string" &&
    (freshness.depthAt === null || typeof freshness.depthAt === "string") &&
    (freshness.usdPriceAt === null || typeof freshness.usdPriceAt === "string") &&
    typeof freshness.usdPriceStale === "boolean"
  );
}

export async function loadMarketOverview(signal?: AbortSignal): Promise<StaticsMarketOverview> {
  const response = await fetch("/api/market/overview", {
    headers: { accept: "application/json" },
    signal,
  });
  const payload: unknown = response.ok ? await response.json() : null;
  if (!isStaticsMarketOverview(payload)) {
    throw new Error("The market analytics response is unavailable or invalid.");
  }
  return payload;
}
