import { getSqrtPriceAtTick } from "@statics-protocol/sdk/phase-one";

export type DexMetadata = {
  address: string;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
};
export type DexLeg = {
  positionId: string;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
};
export type LpSchedule = {
  slot: number;
  asset: string;
  start: string;
  finish: string;
  last: string;
  budget: string;
  emitted: string;
};
export type MarketPool = {
  poolId: string;
  source: "genesis" | "phase-one";
  sourceDeploymentId: string;
  token0: DexMetadata;
  token1: DexMetadata;
  creator: string | null;
  hook: string;
  lpFee: number;
  tickSpacing: number;
  createdAtBlock: string;
  createdAtTimestamp: string;
  initialized: boolean;
  liquidityComplete: boolean;
  historyStart: string;
  priceHistoryStart: string;
  sqrtPriceX96: string;
  tick: number;
  cumulative: string;
  priceTime: string;
  decommissioned: boolean;
  stopped: boolean;
  quarantined: boolean;
  legs: DexLeg[];
  streams: LpSchedule[];
};
export type MarketRange = {
  poolId: string;
  sender: string;
  tickLower: number;
  tickUpper: number;
  salt: string;
  liquidity: string;
};
export type MarketTrade = {
  poolId: string;
  sender: string;
  transactionSender: string;
  transactionHash: string;
  coreAmount0: string;
  coreAmount1: string;
  fee0: string;
  fee1: string;
  amountIn: string;
  amountOut: string;
  input0: boolean;
  internal: boolean;
  complete: boolean;
  settlement: "wallet" | "core-pool";
  sqrtPriceX96: string;
  tick: number;
  lpFee: number;
};
export type AccrualSegment = {
  asset: string;
  slot: number;
  start: string;
  finish: string;
  budget: string;
  from: string;
  to: string;
};
export const wire = (value: unknown) =>
  JSON.stringify(value, (_, v: unknown) => (typeof v === "bigint" ? v.toString() : v));
export const abs = (x: bigint) => (x < 0n ? -x : x);
export const Q96 = 1n << 96n;
export function rangeAmounts(
  range: Pick<MarketRange, "tickLower" | "tickUpper" | "liquidity">,
  sqrt: bigint
) {
  const l = BigInt(range.liquidity);
  if (l < 0n || l > (1n << 128n) - 1n || range.tickLower >= range.tickUpper || sqrt <= 0n)
    throw new Error("Invalid market range");
  const a = getSqrtPriceAtTick(range.tickLower),
    b = getSqrtPriceAtTick(range.tickUpper),
    p = sqrt < a ? a : sqrt > b ? b : sqrt;
  return { amount0: ((l << 96n) * (b - p)) / b / p, amount1: (l * (p - a)) / Q96 };
}
export function changeRange(
  previous: MarketRange | null,
  range: MarketRange,
  delta: bigint
): MarketRange {
  const l = BigInt(previous?.liquidity ?? "0") + delta;
  if (l < 0n || l > (1n << 128n) - 1n)
    throw new Error("Incomplete or inconsistent DEX liquidity history");
  return { ...range, liquidity: String(l) };
}
export function activeLiquidity(pool: MarketPool): bigint {
  return pool.legs
    .filter((l) => l.tickLower <= pool.tick && pool.tick < l.tickUpper)
    .reduce((s, l) => s + BigInt(l.liquidity), 0n);
}
export function advanceStreams(pool: MarketPool, timestamp: bigint): AccrualSegment[] {
  const segments: AccrualSegment[] = [];
  if (pool.stopped) return segments;
  const active = activeLiquidity(pool);
  for (const stream of pool.streams) {
    const last = BigInt(stream.last),
      budget = BigInt(stream.budget),
      emitted = BigInt(stream.emitted);
    if (timestamp < last) throw new Error("LP schedule timestamp regression");
    if (timestamp === last || emitted === budget) continue;
    if (active === 0n) {
      stream.start = String(BigInt(stream.start) + timestamp - last);
      stream.finish = String(BigInt(stream.finish) + timestamp - last);
      stream.last = String(timestamp);
      continue;
    }
    const start = BigInt(stream.start),
      finish = BigInt(stream.finish),
      to = timestamp < finish ? timestamp : finish;
    if (finish <= start || to < last) throw new Error("Invalid LP schedule");
    const target = to === finish ? budget : (budget * (to - start)) / (finish - start);
    if (target > emitted)
      segments.push({
        asset: stream.asset,
        slot: stream.slot,
        start: stream.start,
        finish: stream.finish,
        budget: stream.budget,
        from: stream.last,
        to: String(to),
      });
    stream.emitted = String(target);
    stream.last = String(to);
  }
  return segments;
}
export function fundLp(
  pool: MarketPool,
  slot: number,
  asset: string,
  amount: bigint,
  timestamp: bigint,
  finish: bigint
) {
  if (slot < 1 || slot > 4 || amount < 0n) throw new Error("Invalid LP bribe funding");
  if (amount === 0n) return;
  const old = pool.streams.find((s) => s.slot === slot);
  if (old && old.asset.toLowerCase() !== asset.toLowerCase())
    throw new Error("LP stream asset changed");
  const remaining = old ? BigInt(old.budget) - BigInt(old.emitted) : 0n;
  if (finish <= timestamp) throw new Error("Invalid LP funding duration");
  const next = {
    slot,
    asset,
    start: String(timestamp),
    finish: String(finish),
    last: String(timestamp),
    budget: String(remaining + amount),
    emitted: "0",
  };
  pool.streams = [...pool.streams.filter((s) => s.slot !== slot), next];
}
export function segmentAmount(s: AccrualSegment, from: bigint, to: bigint) {
  const start = BigInt(s.start),
    finish = BigInt(s.finish),
    a = from > BigInt(s.from) ? from : BigInt(s.from),
    b = to < BigInt(s.to) ? to : BigInt(s.to);
  if (b <= a) return 0n;
  return (
    (BigInt(s.budget) * (b - start)) / (finish - start) -
    (BigInt(s.budget) * (a - start)) / (finish - start)
  );
}
export function settleTrade(
  trade: MarketTrade,
  fee0: bigint,
  fee1: bigint,
  internal: boolean
): MarketTrade {
  const a = BigInt(trade.coreAmount0),
    b = BigInt(trade.coreAmount1);
  const input0 = a < 0n;
  if (!((a < 0n && b >= 0n) || (b < 0n && a >= 0n))) throw new Error("Invalid DEX swap signs");
  const input = abs(input0 ? a : b),
    output = input0 ? b : a,
    outputFee = input0 ? fee1 : fee0;
  if (fee0 < 0n || fee1 < 0n || outputFee > output) throw new Error("Invalid hook fee settlement");
  return {
    ...trade,
    input0,
    fee0: String(fee0),
    fee1: String(fee1),
    amountIn: String(input + (input0 ? fee0 : fee1)),
    amountOut: String(output - outputFee),
    internal,
    complete: true,
    settlement: "wallet",
  };
}
export function updatePrice(pool: MarketPool, tick: number, sqrt: bigint, time: bigint) {
  if (time < BigInt(pool.priceTime)) throw new Error("Price timestamp regression");
  pool.cumulative = String(
    BigInt(pool.cumulative) + BigInt(pool.tick) * (time - BigInt(pool.priceTime))
  );
  pool.priceTime = String(time);
  pool.tick = tick;
  pool.sqrtPriceX96 = String(sqrt);
}
