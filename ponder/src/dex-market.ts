import {
  advanceStreams,
  segmentAmount,
  rangeAmounts,
  type MarketPool,
  type MarketRange,
  type AccrualSegment,
  type DexMetadata,
} from "./dex-domain";
import { checkpointObservation } from "./dex-checkpoint";
import type { DexSnapshot, Metric } from "./dex-snapshot";
import {
  priceGraph,
  poolPrice,
  routePrice,
  priceChange,
  currency,
  value,
  ratio,
  decimal,
  multiply,
  type PricingConfig,
} from "./dex-pricing";

export function pricingConfig(
  requested: "usdg" | "weth",
  env: NodeJS.ProcessEnv = process.env
): PricingConfig {
  const kind = requested === "usdg" && !env.PONDER_PRICING_QUOTE_USDG ? "weth" : requested;
  const address = env[`PONDER_PRICING_QUOTE_${kind.toUpperCase()}`];
  if (!address || !/^0x[\da-fA-F]{40}$/.test(address))
    throw new Error(`Configure PONDER_PRICING_QUOTE_${kind.toUpperCase()}`);
  const decimals = Number(
    env[`PONDER_PRICING_DECIMALS_${kind.toUpperCase()}`] ?? (kind === "weth" ? "18" : "6")
  );
  const floor =
    env[`PONDER_PRICING_MIN_LIQUIDITY_${kind.toUpperCase()}`] ?? (kind === "weth" ? "1" : "2500");
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255 || !/^\d+(\.\d+)?$/.test(floor))
    throw new Error("Invalid pricing decimals or floor");
  const [whole, fraction = ""] = floor.split(".");
  if (fraction.length > decimals) throw new Error("Pricing floor exceeds quote precision");
  const wrapped = env.PONDER_PRICING_WRAPPED_NATIVE ?? null;
  if (wrapped !== null && !/^0x[\da-fA-F]{40}$/.test(wrapped))
    throw new Error("Invalid wrapped-native pricing configuration");
  return {
    kind,
    address: address.toLowerCase(),
    decimals,
    symbol: kind === "usdg" ? "USDG" : "WETH",
    floor: BigInt(whole!) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0") || "0"),
    wrappedNative: wrapped,
  };
}
export function historicalRanges(s: DexSnapshot, at: bigint) {
  const ranges = new Map(s.ranges.map((r) => [r.rangeKey, { ...r }]));
  for (const h of [...s.history].reverse()) {
    if (h.kind !== "range" || BigInt(h.timestamp) <= at) continue;
    const change = h.details as MarketRange & { rangeKey: string; delta: string };
    const r = ranges.get(change.rangeKey);
    if (!r) throw new Error("Missing historical range identity");
    r.liquidity = String(BigInt(r.liquidity) - BigInt(change.delta));
    if (BigInt(r.liquidity) < 0n) throw new Error("Inconsistent historical range inventory");
  }
  return [...ranges.values()];
}
const numberBps = (x: bigint) =>
  x >= 0n && x <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(x) : null;
const zeroMetric = (id: string, bucket: string): Metric => ({
  poolId: id,
  bucket,
  volume0: "0",
  volume1: "0",
  lp0: "0",
  lp1: "0",
  fee0: "0",
  fee1: "0",
  swaps: "0",
  wallets: "0",
});
/** 52 weeks, matching the seven-day window annualised as × 52. */
const YEAR_SECONDS = 52n * 604800n;
export function buildMarket(
  s: DexSnapshot,
  deploymentId: string,
  config: PricingConfig,
  staticsAsset: string | null
) {
  const { time: now, block } = checkpointObservation(s.checkpoint),
    day = now / 86400n;
  const graph = priceGraph(s.pools, s.ranges, s.prices, now, config);
  const prices = graph.prices;
  const price = (asset: string) => prices.get(currency(asset, config));
  const metadata = (asset: string): DexMetadata =>
    s.tokens.find((t) => t.address.toLowerCase() === asset.toLowerCase()) ?? {
      address: asset,
      symbol: null,
      name: null,
      decimals: null,
    };
  const pricedValue = (asset: string, amount: bigint) =>
    amount === 0n ? 0n : price(asset) ? value(amount, price(asset)!.price) : null;
  const observed = {
    deploymentId,
    indexedAtBlock: String(block),
    indexedAtTimestamp: String(now),
    quote: {
      kind: config.kind,
      address: config.address,
      symbol: config.symbol,
      decimals: config.decimals,
    },
    observation: {
      checkpoint: s.checkpoint,
      pricingWindowSeconds: 1800,
      lpFeesEstimated: true,
      tvlBasis: "range-principal-excluding-fees-and-hook-balances",
      volumeBasis: "one-core-input-side",
      protocolFeeBasis: "additional-statics-hook-fees",
      walletBasis: "transaction-sender",
    },
  };
  function aggregate(p: MarketPool, m: Metric, graphPrices = prices) {
    const val = (asset: string, n: string) => {
      const found = graphPrices.get(currency(asset, config));
      return BigInt(n) === 0n ? 0n : found ? value(BigInt(n), found.price) : null;
    };
    const sum = (a: bigint | null, b: bigint | null) => (a === null || b === null ? null : a + b);
    return {
      volume: sum(val(p.token0.address, m.volume0), val(p.token1.address, m.volume1)),
      lpFees: sum(val(p.token0.address, m.lp0), val(p.token1.address, m.lp1)),
      protocolFees: sum(val(p.token0.address, m.fee0), val(p.token1.address, m.fee1)),
      swaps: BigInt(m.swaps),
    };
  }
  const metric = (p: MarketPool, bucket: string) =>
    s.metrics.find((m) => m.poolId === p.poolId && m.bucket === bucket) ??
    zeroMetric(p.poolId, bucket);
  const inventory = (p: MarketPool, at: bigint, ranges: readonly MarketRange[]) => {
    const pp = poolPrice(p, s.prices, at);
    if (!pp || !p.liquidityComplete) return null;
    return ranges
      .filter((r) => r.poolId === p.poolId)
      .reduce(
        (total, r) => {
          const amounts = rangeAmounts(r, pp.spot);
          return {
            amount0: total.amount0 + amounts.amount0,
            amount1: total.amount1 + amounts.amount1,
          };
        },
        { amount0: 0n, amount1: 0n }
      );
  };
  const tvl = (p: MarketPool, amounts: ReturnType<typeof inventory>) => {
    if (!amounts || !price(p.token0.address) || !price(p.token1.address)) return null;
    return (
      value(amounts.amount0, price(p.token0.address)!.price) +
      value(amounts.amount1, price(p.token1.address)!.price)
    );
  };
  const previousRanges = historicalRanges(s, now - 86400n);
  const pools = s.pools.map((p) => {
    const current = aggregate(p, metric(p, "current")),
      weekly = aggregate(p, metric(p, "week")),
      amounts = inventory(p, now, s.ranges),
      locked = tvl(p, amounts);
    const pp = poolPrice(p, s.prices, now),
      old = poolPrice(p, s.prices, now - 86400n);
    const pair =
      pp && p.token0.decimals !== null && p.token1.decimals !== null
        ? ratio(
            pp.sqrt * pp.sqrt * 10n ** BigInt(p.token0.decimals),
            (1n << 192n) * 10n ** BigInt(p.token1.decimals)
          )
        : null;
    const oldPair = old && !old.fallback ? ratio(old.sqrt * old.sqrt, 1n << 192n) : null;
    const allocation = s.allocations.find((a) => a.poolId === p.poolId),
      denom = BigInt(s.reserve?.totalAllocatedWeight ?? "0");
    const emissionShare =
      allocation?.eligible && denom > 0n ? Number((BigInt(allocation.weight) * 10000n) / denom) : 0;
    const credits = s.history
      .filter(
        (h) => h.poolId === p.poolId && h.kind === "credit" && BigInt(h.timestamp) >= now - 604800n
      )
      .reduce((sum, h) => sum + BigInt((h.details as { amount: string }).amount), 0n);
    const recycled = s.history
      .filter(
        (h) => h.poolId === p.poolId && h.kind === "recycle" && BigInt(h.timestamp) >= now - 604800n
      )
      .reduce((sum, h) => sum + BigInt((h.details as { amount: string }).amount), 0n);
    const bribes = new Map<string, bigint>();
    const addSegment = (seg: AccrualSegment) =>
      bribes.set(seg.asset, (bribes.get(seg.asset) ?? 0n) + segmentAmount(seg, now - 604800n, now));
    for (const h of s.history)
      if (h.poolId === p.poolId && h.kind === "accrual")
        for (const seg of h.details as AccrualSegment[]) addSegment(seg);
    const simulated = structuredClone(p);
    for (const seg of advanceStreams(simulated, now)) addSegment(seg);
    let bribeValue: bigint | null = 0n;
    for (const [asset, amount] of bribes) {
      const v = pricedValue(asset, amount);
      if (v === null) {
        bribeValue = null;
        break;
      }
      bribeValue += v;
    }
    const gaugeValue =
      credits === 0n ? 0n : staticsAsset ? pricedValue(staticsAsset, credits) : null;
    const complete = BigInt(p.historyStart) <= now - 604800n;
    // Yield annualises over the history that exists, up to seven days; under a day of history
    // is too little to annualise. Every component above is summed over the same window.
    const observed = now > BigInt(p.historyStart) ? now - BigInt(p.historyStart) : 0n;
    const windowSeconds = observed < 604800n ? observed : 604800n;
    const earnings =
      weekly.lpFees !== null && gaugeValue !== null && bribeValue !== null
        ? weekly.lpFees + gaugeValue + bribeValue
        : null;
    return {
      poolId: p.poolId,
      token0: p.token0,
      token1: p.token1,
      lpFee: p.lpFee,
      pairPrice: pair ? decimal(pair) : null,
      change24hBps:
        pp && !pp.fallback ? priceChange(ratio(pp.sqrt * pp.sqrt, 1n << 192n), oldPair) : null,
      volume24h: current.volume,
      volume7d: weekly.volume,
      lpFees24h: current.lpFees,
      protocolFees24h: current.protocolFees,
      valueLocked: locked,
      amount0: amounts?.amount0 ?? 0n,
      amount1: amounts?.amount1 ?? 0n,
      incentiveStreams: allocation?.incentiveStreamCount ?? 0,
      emissionShareBps: Math.min(10000, emissionShare),
      estimatedYieldBps:
        windowSeconds >= 86400n && earnings !== null && locked !== null && locked > 0n
          ? numberBps((earnings * YEAR_SECONDS * 10000n) / (windowSeconds * locked))
          : null,
      priced: !!price(p.token0.address) && !!price(p.token1.address),
      source: p.source,
      sourceDeploymentId: p.sourceDeploymentId,
      createdAtBlock: p.createdAtBlock,
      priceFallback: pp?.fallback ?? true,
      liquidityComplete: p.liquidityComplete,
      historyStart: p.historyStart,
      yieldComponents: {
        lpFees: weekly.lpFees,
        gaugeCredits: gaugeValue,
        lpBribeAccrual: bribeValue,
        gaugeCreditedAmount: credits,
        gaugeRecycledAmount: recycled,
        complete,
        windowSeconds,
        estimated: true,
        basis: "trailing-window-settlement-credits-and-modeled-lp-accrual",
      },
      bribeAccrual: [...bribes].map(([asset, amount]) => ({ asset: metadata(asset), amount })),
      active: p.initialized && !p.decommissioned,
      previousValueLocked: tvl(p, inventory(p, now - 86400n, previousRanges)),
    };
  });
  const sumAvailable = (values: (bigint | null)[]) => {
    const valid = values.filter((v): v is bigint => v !== null);
    return valid.length ? valid.reduce((a, b) => a + b, 0n) : values.length ? null : 0n;
  };
  function totals(bucket: "current" | "previous") {
    const contributions = s.pools.map((p) => aggregate(p, metric(p, bucket)));
    const values = {
      volume: contributions.map((c) => c.volume),
      lpFees: contributions.map((c) => c.lpFees),
      protocolFees: contributions.map((c) => c.protocolFees),
      valueLocked: pools.map((p) => (bucket === "current" ? p.valueLocked : p.previousValueLocked)),
    };
    return {
      ...Object.fromEntries(Object.entries(values).map(([k, vs]) => [k, sumAvailable(vs)])),
      swaps: contributions.reduce((n, c) => n + c.swaps, 0n),
      wallets: BigInt(s.wallets[bucket]),
      coverage: Object.fromEntries(
        Object.entries(values).map(([k, vs]) => [
          k,
          {
            includedPools: vs.filter((v) => v !== null).length,
            omittedPools: vs.filter((v) => v === null).length,
            historyComplete: s.pools.every(
              (p) => BigInt(p.historyStart) <= now - (bucket === "current" ? 86400n : 172800n)
            ),
          },
        ])
      ),
    };
  }
  const tokenList = [
    ...new Map(
      s.pools.flatMap((p) => [p.token0, p.token1]).map((t) => [t.address.toLowerCase(), t])
    ).values(),
  ];
  const tokens = tokenList.map((token) => {
    const p = price(token.address),
      units = token.decimals === null ? null : 10n ** BigInt(token.decimals);
    const exact = p && units !== null ? multiply(p.price, ratio(units)) : null;
    const relevant = s.pools.filter(
      (pool) =>
        pool.token0.address.toLowerCase() === token.address.toLowerCase() ||
        pool.token1.address.toLowerCase() === token.address.toLowerCase()
    );
    return {
      token,
      price: exact ? value(1n, exact) : null,
      priceNumerator: exact?.n ?? null,
      priceDenominator: exact?.d ?? null,
      change24hBps:
        p && !p.fallback
          ? priceChange(
              p.price,
              routePrice(token.address, p.route, s.pools, s.prices, now - 86400n, config)
            )
          : null,
      volume24h: p
        ? sumAvailable(relevant.map((pool) => aggregate(pool, metric(pool, "current")).volume))
        : null,
      route: p?.route ?? [],
      priceFallback: p?.fallback ?? false,
    };
  });
  const statics = tokens.find((t) => t.token.address.toLowerCase() === staticsAsset?.toLowerCase());
  const days = Array.from({ length: 90 }, (_, i) => {
    const d = day - BigInt(89 - i),
      end = d === day ? now : (d + 1n) * 86400n - 1n;
    const historical = priceGraph(s.pools, historicalRanges(s, end), s.prices, end, config).prices;
    const rows = s.daily.filter((m) => BigInt(m.bucket) === d),
      values = rows.map((m) => {
        const p = s.pools.find((p) => p.poolId === m.poolId);
        return p ? aggregate(p, m, historical).volume : null;
      });
    return {
      day: new Date(Number(d) * 86400000).toISOString().slice(0, 10),
      volume: sumAvailable(values),
      swaps: rows.reduce((n, m) => n + BigInt(m.swaps), 0n),
      provisional: d === day,
      coverage: {
        includedPools: values.filter((v) => v !== null).length,
        omittedPools: values.filter((v) => v === null).length,
        historyComplete: s.pools
          .filter((p) => BigInt(p.createdAtTimestamp) <= end)
          .every((p) => BigInt(p.historyStart) <= d * 86400n),
      },
    };
  });
  const distribution = pools
    .filter((p) => p.emissionShareBps > 0)
    .map((p) => ({
      poolId: p.poolId,
      token0: p.token0,
      token1: p.token1,
      shareBps: p.emissionShareBps,
    }))
    .sort((a, b) => b.shareBps - a.shareBps || a.poolId.localeCompare(b.poolId));
  const shares = distribution.reduce((n, p) => n + p.shareBps, 0);
  if (shares > 10000) throw new Error("Inconsistent indexed allocation denominator");
  const period = s.reserve
    ? {
        budget: BigInt(s.reserve.periodBudget),
        start: BigInt(s.reserve.periodStart),
        finish: BigInt(s.reserve.periodFinish),
        emitted: BigInt(s.reserve.periodAccounted),
        accounted: BigInt(s.reserve.periodAccounted),
        activated: s.reserve.activated,
        expired: BigInt(s.reserve.periodFinish) > 0n && BigInt(s.reserve.periodFinish) <= now,
        observedAtBlock: s.reserve.updatedAtBlock,
        observedAtTimestamp: s.reserve.updatedAtTimestamp,
        totalAllocatedWeight: s.reserve.totalAllocatedWeight,
      }
    : null;
  const trades = s.trades.map((t) => {
    const p = s.pools.find((p) => p.poolId === t.poolId);
    if (!p) throw new Error("Unknown indexed market");
    const [tokenIn, tokenOut] = t.input0 ? [p.token0, p.token1] : [p.token1, p.token0];
    const v = pricedValue(tokenIn.address, BigInt(t.amountIn));
    return {
      ...t,
      tokenIn,
      tokenOut,
      amountIn: BigInt(t.amountIn),
      amountOut: BigInt(t.amountOut),
      value: v,
      sender: t.transactionSender,
      priced: v !== null,
      timestamp: BigInt(t.timestamp),
      source: p.source,
    };
  });
  return {
    observed,
    pools,
    summary: {
      ...observed,
      current: totals("current"),
      previous: totals("previous"),
      activePools: pools.filter((p) => p.active).length,
      unpricedPools: pools.filter((p) => !p.priced).length,
      statics: {
        price: statics?.price ?? null,
        change24hBps: statics?.change24hBps ?? null,
        priceFallback: statics?.priceFallback ?? false,
      },
    },
    tokens: { ...observed, items: tokens },
    volume: { ...observed, days },
    emissions: { ...observed, period, pools: distribution, othersBps: 10000 - shares },
    trades: { ...observed, items: trades },
  };
}
export type BuiltMarket = ReturnType<typeof buildMarket>;
