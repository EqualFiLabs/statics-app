import { getSqrtPriceAtTick } from "@statics-protocol/sdk/phase-one";
import { Q96, rangeAmounts, type MarketPool, type MarketRange } from "./dex-domain";

// Rational arithmetic keeps sub-unit prices and different token decimals exact.
export type Ratio = { n: bigint; d: bigint };
export const ratio = (n: bigint, d = 1n): Ratio => {
  if (d <= 0n || n < 0n) throw new Error("Invalid price ratio");
  const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? a : gcd(b, a % b));
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
};
export const multiply = (a: Ratio, b: Ratio) => ratio(a.n * b.n, a.d * b.d);
export const invert = (a: Ratio) => ratio(a.d, a.n);
export const value = (units: bigint, price: Ratio) => (units * price.n) / price.d;
export function decimal(r: Ratio, digits = 24) {
  const scaled = (r.n * 10n ** BigInt(digits)) / r.d;
  const text = scaled.toString().padStart(digits + 1, "0");
  return `${text.slice(0, -digits)}.${text.slice(-digits)}`.replace(/\.?0+$/, "") || "0";
}
export type PricePoint = {
  poolId: string;
  timestamp: string;
  tick: number;
  cumulative: string;
  sqrtPriceX96: string;
};
export type PoolPrice = {
  tick: number;
  sqrt: bigint;
  fallback: boolean;
  spot: bigint;
  spotTick: number;
};
const floorDiv = (n: bigint, d: bigint) => n / d - (n < 0n && n % d !== 0n ? 1n : 0n);
export function poolPrice(
  pool: MarketPool,
  points: readonly PricePoint[],
  at: bigint
): PoolPrice | null {
  if (at < BigInt(pool.priceHistoryStart ?? pool.createdAtTimestamp)) return null;
  const before = (time: bigint) =>
    points
      .filter((p) => p.poolId === pool.poolId && BigInt(p.timestamp) <= time)
      .sort((a, b) =>
        BigInt(a.timestamp) < BigInt(b.timestamp)
          ? 1
          : BigInt(a.timestamp) > BigInt(b.timestamp)
            ? -1
            : 0
      )[0];
  const end = before(at),
    start = before(at - 1800n);
  if (!end || BigInt(end.sqrtPriceX96) === 0n) return null;
  const extrapolate = (p: PricePoint, time: bigint) =>
    BigInt(p.cumulative) + BigInt(p.tick) * (time - BigInt(p.timestamp));
  const tick = start
    ? Number(floorDiv(extrapolate(end, at) - extrapolate(start, at - 1800n), 1800n))
    : end.tick;
  return {
    tick,
    sqrt: getSqrtPriceAtTick(tick),
    fallback: !start,
    spot: BigInt(end.sqrtPriceX96),
    spotTick: end.tick,
  };
}
export type PricingConfig = {
  kind: "usdg" | "weth";
  address: string;
  decimals: number;
  symbol: string;
  floor: bigint;
  wrappedNative: string | null;
};
export type TokenPrice = { price: Ratio; route: string[]; fallback: boolean; depth: bigint };
const native = "0x0000000000000000000000000000000000000000";
export const currency = (asset: string, config: PricingConfig) =>
  asset.toLowerCase() === native && config.wrappedNative
    ? config.wrappedNative.toLowerCase()
    : asset.toLowerCase();
export function priceGraph(
  pools: readonly MarketPool[],
  ranges: readonly MarketRange[],
  points: readonly PricePoint[],
  at: bigint,
  config: PricingConfig
) {
  const unit = 10n ** BigInt(config.decimals);
  const quote = currency(config.address, config);
  const edges = pools.flatMap((pool) => {
    const p = poolPrice(pool, points, at);
    if (
      !p ||
      !pool.liquidityComplete ||
      pool.token0.decimals === null ||
      pool.token1.decimals === null
    )
      return [];
    const [a, b] = [currency(pool.token0.address, config), currency(pool.token1.address, config)];
    if (a === b) return [];
    const inventory = ranges
      .filter(
        (r) => r.poolId === pool.poolId && r.tickLower <= p.spotTick && p.spotTick < r.tickUpper
      )
      .reduce(
        (sum, r) => {
          const v = rangeAmounts(r, p.spot);
          return { a: sum.a + v.amount0, b: sum.b + v.amount1 };
        },
        { a: 0n, b: 0n }
      );
    return [
      {
        id: pool.poolId,
        a,
        b,
        ratio: ratio(p.sqrt * p.sqrt, Q96 * Q96),
        inventory,
        fallback: p.fallback,
        depth: 0n,
      },
    ];
  });
  // Ratios here price a base unit, not a whole token. Decimal normalization occurs at display boundaries.
  const anchored = new Map<string, TokenPrice>([
    [quote, { price: ratio(1n), route: [], fallback: false, depth: 1n << 512n }],
  ]);
  const admitted: typeof edges = [];
  const pending = [...edges];
  while (pending.length) {
    const candidates = pending
      .map((e) => {
        const a = anchored.get(e.a),
          b = anchored.get(e.b);
        if (!a && !b) return { e, depth: 0n };
        const pa = a?.price ?? multiply(b!.price, e.ratio),
          pb = b?.price ?? multiply(a!.price, invert(e.ratio));
        return { e, depth: value(e.inventory.a, pa) + value(e.inventory.b, pb) };
      })
      .filter((c) => c.depth >= config.floor && (anchored.has(c.e.a) || anchored.has(c.e.b)))
      .sort((a, b) =>
        a.depth === b.depth ? a.e.id.localeCompare(b.e.id) : a.depth > b.depth ? -1 : 1
      );
    if (!candidates.length) break;
    const { e, depth } = candidates[0]!;
    // Both sides must be normalized using the same anchored price; never raw liquidity units.
    const a = anchored.get(e.a),
      b = anchored.get(e.b);
    const pa = a?.price ?? multiply(b!.price, e.ratio),
      pb = b?.price ?? multiply(a!.price, invert(e.ratio));
    e.depth = value(e.inventory.a, pa) + value(e.inventory.b, pb);
    admitted.push(e);
    if (!a)
      anchored.set(e.a, {
        price: pa,
        route: [...b!.route, e.id],
        fallback: b!.fallback || e.fallback,
        depth,
      });
    if (!b)
      anchored.set(e.b, {
        price: pb,
        route: [...a!.route, e.id],
        fallback: a!.fallback || e.fallback,
        depth,
      });
    pending.splice(pending.indexOf(e), 1);
  }
  // Freeze admitted depths, then select widest simple routes with deterministic ties.
  const selected = new Map<string, TokenPrice>([
    [quote, { price: ratio(1n), route: [], fallback: false, depth: 1n << 512n }],
  ]);
  const finalized = new Set<string>();
  const better = (a: TokenPrice, b: TokenPrice) =>
    a.depth > b.depth ||
    (a.depth === b.depth &&
      (a.route.length < b.route.length ||
        (a.route.length === b.route.length && a.route.join(":") < b.route.join(":"))));
  while (true) {
    const next = [...selected]
      .filter(([a]) => !finalized.has(a))
      .sort((a, b) =>
        better(a[1], b[1]) ? -1 : better(b[1], a[1]) ? 1 : a[0].localeCompare(b[0])
      )[0];
    if (!next) break;
    const [asset, p] = next;
    finalized.add(asset);
    for (const e of admitted) {
      const to = e.a === asset ? e.b : e.b === asset ? e.a : null;
      if (!to || finalized.has(to)) continue;
      const candidate = {
        price: multiply(p.price, e.a === asset ? invert(e.ratio) : e.ratio),
        route: [...p.route, e.id],
        depth: p.depth < e.depth ? p.depth : e.depth,
        fallback: p.fallback || e.fallback,
      };
      if (!selected.has(to) || better(candidate, selected.get(to)!)) selected.set(to, candidate);
    }
  }
  return { prices: selected, quoteUnits: unit };
}
export function routePrice(
  asset: string,
  route: readonly string[],
  pools: readonly MarketPool[],
  points: readonly PricePoint[],
  at: bigint,
  config: PricingConfig
): Ratio | null {
  let current = currency(config.address, config),
    result = ratio(1n);
  for (const id of route) {
    const pool = pools.find((p) => p.poolId === id),
      p = pool && poolPrice(pool, points, at);
    if (!pool || !p || p.fallback) return null;
    const a = currency(pool.token0.address, config),
      b = currency(pool.token1.address, config),
      r = ratio(p.sqrt * p.sqrt, Q96 * Q96);
    if (current === a) {
      current = b;
      result = multiply(result, invert(r));
    } else if (current === b) {
      current = a;
      result = multiply(result, r);
    } else return null;
  }
  return current === currency(asset, config) ? result : null;
}
export function priceChange(current: Ratio, previous: Ratio | null): number | null {
  if (!previous || previous.n === 0n) return null;
  const change = (current.n * previous.d * 10000n) / (current.d * previous.n) - 10000n;
  return change > BigInt(Number.MAX_SAFE_INTEGER) || change < BigInt(Number.MIN_SAFE_INTEGER)
    ? null
    : Number(change);
}
