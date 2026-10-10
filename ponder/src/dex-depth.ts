import type { DexSnapshot } from "./dex-snapshot";

export type PoolDepth = {
  poolId: string;
  liquidityComplete: boolean;
  tickSpacing: number;
  tick: number;
  sqrtPriceX96: string;
  /** Liquidity active at the current tick. */
  liquidity: string;
  /** Net liquidity entering at each initialized tick, ascending; zero nets are omitted. */
  ticks: { tick: number; liquidityNet: string }[];
};

/** Initialized-tick liquidity for one pool, from the indexed ranges in a market snapshot. */
export function poolDepth(snapshot: DexSnapshot, poolId: string): PoolDepth | null {
  const id = poolId.toLowerCase();
  const pool = snapshot.pools.find((p) => p.poolId.toLowerCase() === id);
  if (!pool || !pool.initialized) return null;
  const net = new Map<number, bigint>();
  let liquidity = 0n;
  for (const range of snapshot.ranges) {
    if (range.poolId.toLowerCase() !== id) continue;
    const l = BigInt(range.liquidity);
    if (
      l < 0n ||
      range.tickLower >= range.tickUpper ||
      range.tickLower % pool.tickSpacing !== 0 ||
      range.tickUpper % pool.tickSpacing !== 0
    )
      throw new Error("Invalid indexed depth range");
    if (l === 0n) continue;
    net.set(range.tickLower, (net.get(range.tickLower) ?? 0n) + l);
    net.set(range.tickUpper, (net.get(range.tickUpper) ?? 0n) - l);
    if (range.tickLower <= pool.tick && pool.tick < range.tickUpper) liquidity += l;
  }
  return {
    poolId: pool.poolId,
    liquidityComplete: pool.liquidityComplete,
    tickSpacing: pool.tickSpacing,
    tick: pool.tick,
    sqrtPriceX96: pool.sqrtPriceX96,
    liquidity: String(liquidity),
    ticks: [...net]
      .filter(([, l]) => l !== 0n)
      .sort(([a], [b]) => a - b)
      .map(([tick, l]) => ({ tick, liquidityNet: String(l) })),
  };
}
