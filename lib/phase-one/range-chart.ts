import { usableTickBounds } from "@/lib/phase-one/liquidity";

/**
 * Display-only geometry for the liquidity range chart. Prices here are floating point and only
 * position pixels or choose ticks; transaction amounts are always derived from ticks in bigint.
 *
 * A "canonical" price is token1 per token0. The display price is canonical, or its inverse when
 * the viewer flips the pair. Ticks are always canonical and aligned to the pool's spacing.
 */
export type Ticks = readonly [lower: number, upper: number];
export type Bound = "min" | "max";
export type PresetId = "full" | "narrow" | "common" | "wide" | "below" | "above";

const LOG_BASE = Math.log(1.0001);

export function tickToPrice(tick: number, decimals0: number, decimals1: number): number {
  return Math.exp(tick * LOG_BASE) * 10 ** (decimals0 - decimals1);
}

export function priceToTick(price: number, decimals0: number, decimals1: number): number {
  return Math.log(price / 10 ** (decimals0 - decimals1)) / LOG_BASE;
}

function align(tick: number, spacing: number, round: (x: number) => number = Math.round) {
  const [minimum, maximum] = usableTickBounds(spacing);
  return Math.min(maximum, Math.max(minimum, round(tick / spacing) * spacing));
}

/** The canonical tick a display bound edits: flipping the pair swaps which end is which. */
const canonicalSide = (bound: Bound, inverted: boolean) => ((bound === "min") !== inverted ? 0 : 1);

export function isFullRange(ticks: Ticks, spacing: number) {
  const [minimum, maximum] = usableTickBounds(spacing);
  return ticks[0] === minimum && ticks[1] === maximum;
}

/** Display [min, max] for a tick range; a full range shows as 0 and ∞. */
export function displayBounds(
  ticks: Ticks,
  spacing: number,
  decimals: readonly [number, number],
  inverted: boolean
): readonly [number, number] {
  if (isFullRange(ticks, spacing)) return [0, Infinity];
  const prices = ticks.map((tick) => tickToPrice(tick, decimals[0], decimals[1]));
  return inverted ? [1 / prices[1]!, 1 / prices[0]!] : [prices[0]!, prices[1]!];
}

/** Moves one display bound to a price, snapping to the nearest usable tick and keeping order. */
export function moveBound(
  ticks: Ticks,
  bound: Bound,
  displayPrice: number,
  spacing: number,
  decimals: readonly [number, number],
  inverted: boolean
): Ticks {
  if (!(displayPrice > 0) || !Number.isFinite(displayPrice)) return ticks;
  const canonical = inverted ? 1 / displayPrice : displayPrice;
  const tick = align(priceToTick(canonical, decimals[0], decimals[1]), spacing);
  return withSide(ticks, canonicalSide(bound, inverted), tick, spacing);
}

/** Moves one display bound by one tick spacing; up raises the displayed price. */
export function stepBound(
  ticks: Ticks,
  bound: Bound,
  direction: 1 | -1,
  spacing: number,
  inverted: boolean
): Ticks {
  const side = canonicalSide(bound, inverted);
  return withSide(
    ticks,
    side,
    ticks[side] + (inverted ? -direction : direction) * spacing,
    spacing
  );
}

function withSide(ticks: Ticks, side: 0 | 1, tick: number, spacing: number): Ticks {
  const [minimum, maximum] = usableTickBounds(spacing);
  if (side === 0) return [Math.max(minimum, Math.min(tick, ticks[1] - spacing)), ticks[1]];
  return [ticks[0], Math.min(maximum, Math.max(tick, ticks[0] + spacing))];
}

/**
 * Strategy ranges around the current tick. "below" and "above" are in display terms, so each
 * holds one token: a range wholly below the canonical price holds token1, above holds token0.
 */
export function presetTicks(
  preset: PresetId,
  currentTick: number,
  spacing: number,
  inverted: boolean
): Ticks {
  const [minimum, maximum] = usableTickBounds(spacing);
  const bounded = (lower: number, upper: number): Ticks => {
    const lo = Math.max(minimum, Math.min(maximum - spacing, lower));
    return [lo, Math.min(maximum, Math.max(lo + spacing, upper))];
  };
  const offset = (ratio: number) => Math.log(ratio) / LOG_BASE;
  const around = (down: number, up: number): Ticks => {
    const floor = align(currentTick, spacing, Math.floor);
    return bounded(
      Math.min(align(currentTick + offset(down), spacing, Math.floor), floor),
      Math.max(align(currentTick + offset(up), spacing, Math.ceil), floor + spacing)
    );
  };
  if (preset === "full") return usableTickBounds(spacing);
  if (preset === "narrow") return around(1 / 1.01, 1.01);
  if (preset === "common") return around(1 / 1.1, 1.1);
  if (preset === "wide") return around(0.5, 2);
  const belowCanonical = (preset === "below") !== inverted;
  const floor = align(currentTick, spacing, Math.floor);
  if (belowCanonical) {
    // tick >= upper: the range holds token1 only.
    const upper = floor;
    return bounded(
      Math.min(align(currentTick + offset(0.5), spacing, Math.floor), upper - spacing),
      upper
    );
  }
  // tick < lower: the range holds token0 only.
  const lower = floor + spacing;
  return bounded(
    lower,
    Math.max(align(currentTick + offset(2), spacing, Math.ceil), lower + spacing)
  );
}

/** The token a one-sided range holds, or null when it needs both. */
export function singleSidedToken(ticks: Ticks, currentTick: number): 0 | 1 | null {
  if (currentTick < ticks[0]) return 0;
  if (currentTick >= ticks[1]) return 1;
  return null;
}

/**
 * Liquidity per unit of deposited value, relative to full range, while the price stays in range:
 * 2√P / (2√P − P/√Pb − √Pa). Returns null when out of range.
 */
export function feeShareMultiplier(ticks: Ticks, sqrtPriceX96: bigint, spacing: number) {
  if (isFullRange(ticks, spacing)) return 1;
  const p = Number(sqrtPriceX96) / 2 ** 96;
  const a = Math.exp((ticks[0] * LOG_BASE) / 2);
  const b = Math.exp((ticks[1] * LOG_BASE) / 2);
  if (!(p > a && p < b)) return null;
  return (2 * p) / (2 * p - (p * p) / b - a);
}

/**
 * Relative active liquidity in `count` equal display-price buckets from `high` down to `low`,
 * each scaled to the largest bucket. Ticks are net liquidity at initialized ticks, ascending.
 */
export function depthBuckets(
  ticks: readonly Readonly<{ tick: number; liquidityNet: bigint }>[],
  low: number,
  high: number,
  count: number,
  decimals: readonly [number, number],
  inverted: boolean
): number[] {
  const cumulative: bigint[] = [];
  let running = 0n;
  for (const entry of ticks) cumulative.push((running += entry.liquidityNet));
  const activeAt = (tick: number) => {
    let lo = 0,
      hi = ticks.length - 1,
      found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (ticks[mid]!.tick <= tick) {
        found = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return found < 0 ? 0n : cumulative[found]!;
  };
  const values = Array.from({ length: count }, (_, index) => {
    const display = high - ((index + 0.5) / count) * (high - low);
    if (!(display > 0)) return 0;
    const canonical = inverted ? 1 / display : display;
    const active = activeAt(Math.floor(priceToTick(canonical, decimals[0], decimals[1])));
    return active > 0n ? Number(active) : 0;
  });
  const largest = Math.max(0, ...values);
  return largest > 0 ? values.map((value) => value / largest) : values;
}

export type PricePoint = Readonly<{ time: number; price: number }>;

/**
 * A step series of display prices from `from` to `to`. Prices only move on swaps, so before the
 * first candle the price is that candle's open, and after the last it is the current price.
 */
export function priceSeries(
  candles: readonly Readonly<{ timestamp: bigint; open: number; close: number }>[],
  current: number,
  from: number,
  to: number,
  inverted: boolean
): PricePoint[] {
  const display = (price: number) => (inverted ? 1 / price : price);
  const inside = candles.filter((c) => Number(c.timestamp) >= from && Number(c.timestamp) <= to);
  const points: PricePoint[] = [
    {
      time: inside[0] ? Math.max(from, Number(inside[0].timestamp)) : to,
      price: display(inside[0]?.open ?? current),
    },
  ];
  for (const candle of inside)
    points.push({ time: Number(candle.timestamp), price: display(candle.close) });
  points.push({ time: to, price: display(current) });
  return points;
}
