import { Q96, type MarketPool, type MarketRange } from "../src/dex-domain";
export const token = (n: number, decimals = 18) => ({
  address: `0x${n.toString(16).padStart(40, "0")}`,
  name: null,
  symbol: null,
  decimals,
});
export function pool(n = 1, a = 1, b = 2): MarketPool {
  return {
    poolId: `0x${n.toString(16).padStart(64, "0")}`,
    source: "phase-one",
    sourceDeploymentId: "selected",
    token0: token(a),
    token1: token(b),
    creator: null,
    hook: token(9).address,
    lpFee: 3000,
    tickSpacing: 1,
    createdAtBlock: "1",
    createdAtTimestamp: "0",
    initialized: true,
    liquidityComplete: true,
    historyStart: "0",
    sqrtPriceX96: String(Q96),
    tick: 0,
    cumulative: "0",
    priceTime: "0",
    decommissioned: false,
    stopped: false,
    quarantined: false,
    legs: [],
    streams: [],
  };
}
export const range = (p: MarketPool, l = "10000000000000000000000"): MarketRange => ({
  poolId: p.poolId,
  sender: token(7).address,
  salt: "0x00",
  tickLower: -100,
  tickUpper: 100,
  liquidity: l,
});
export const points = (p: MarketPool) => [
  { poolId: p.poolId, timestamp: "0", tick: 0, cumulative: "0", sqrtPriceX96: String(Q96) },
];
