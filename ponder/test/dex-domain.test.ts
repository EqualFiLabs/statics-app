import { describe, expect, it } from "vitest";
import {
  activeLiquidity,
  advanceStreams,
  changeRange,
  fundLp,
  rangeAmounts,
  segmentAmount,
  settleTrade,
  updatePrice,
  type MarketPool,
  type MarketTrade,
} from "../src/dex-domain";
const pool = (): MarketPool => ({
  poolId: "pool",
  source: "phase-one",
  sourceDeploymentId: "test",
  token0: { address: "a", symbol: null, name: null, decimals: 18 },
  token1: { address: "b", symbol: null, name: null, decimals: 6 },
  creator: null,
  hook: "h",
  lpFee: 3000,
  tickSpacing: 60,
  createdAtBlock: "1",
  createdAtTimestamp: "0",
  initialized: true,
  liquidityComplete: true,
  historyStart: "1",
  sqrtPriceX96: String(1n << 96n),
  tick: 0,
  cumulative: "0",
  priceTime: "0",
  decommissioned: false,
  stopped: false,
  quarantined: false,
  legs: [{ positionId: "1", tickLower: -60, tickUpper: 60, liquidity: "100" }],
  streams: [],
});
const range = {
  poolId: "p",
  sender: "s",
  tickLower: -60,
  tickUpper: 60,
  salt: "salt",
  liquidity: "0",
};
describe("DEX range inventory and LP accounting", () => {
  it("includes arbitrary senders and salts and never clamps missing withdrawals", () => {
    const r = changeRange(null, range, 100n);
    expect(r.liquidity).toBe("100");
    expect(changeRange(r, range, -100n).liquidity).toBe("0");
    expect(() => changeRange(null, range, -1n)).toThrow(/history/);
  });
  it("uses principal burn rounding and handles empty and out-of-range inventory", () => {
    expect(rangeAmounts(range, 1n << 96n)).toEqual({ amount0: 0n, amount1: 0n });
    const a = rangeAmounts({ ...range, liquidity: "1000000000000000000" }, 1n << 96n);
    expect(a.amount0).toBeGreaterThan(0n);
    expect(a.amount1).toBeGreaterThan(0n);
    expect(
      rangeAmounts({ ...range, tickLower: 60, tickUpper: 120, liquidity: "1000" }, 1n << 96n)
        .amount1
    ).toBe(0n);
  });
  it("tracks earned rewards and exact fractional interval rounding", () => {
    const p = pool();
    fundLp(p, 1, "asset", 101n, 0n, 100n);
    const first = advanceStreams(p, 30n);
    expect(segmentAmount(first[0], 0n, 30n)).toBe(30n);
    const last = advanceStreams(p, 100n);
    expect(segmentAmount(last[0], 30n, 100n)).toBe(71n);
    expect(segmentAmount(last[0], 50n, 70n)).toBe(20n);
  });
  it("pauses zero-liquidity schedules without losing funding", () => {
    const p = pool();
    fundLp(p, 1, "asset", 100n, 0n, 100n);
    p.legs = [];
    expect(advanceStreams(p, 40n)).toEqual([]);
    expect(p.streams[0].finish).toBe("140");
    p.legs = pool().legs;
    expect(segmentAmount(advanceStreams(p, 90n)[0], 40n, 90n)).toBe(50n);
  });
  it("preserves remaining funding and excludes stopping sweeps", () => {
    const p = pool();
    fundLp(p, 1, "asset", 100n, 0n, 100n);
    advanceStreams(p, 40n);
    fundLp(p, 1, "asset", 50n, 40n, 100n);
    expect(p.streams[0].budget).toBe("110");
    const segments = advanceStreams(p, 50n);
    expect(segmentAmount(segments[0], 40n, 50n)).toBe(18n);
    p.stopped = true;
    expect(advanceStreams(p, 500n)).toEqual([]);
    expect(p.streams[0].emitted).toBe("18");
  });
  it("uses lower-inclusive upper-exclusive managed gauge liquidity", () => {
    const p = pool();
    expect(activeLiquidity(p)).toBe(100n);
    p.tick = 60;
    expect(activeLiquidity(p)).toBe(0n);
  });
  it("integrates the preceding tick, including negative ticks and same-block swaps", () => {
    const p = pool();
    p.tick = -10;
    updatePrice(p, 20, 2n << 96n, 100n);
    expect(p.cumulative).toBe("-1000");
    updatePrice(p, 5, 1n << 96n, 100n);
    expect(p.cumulative).toBe("-1000");
    updatePrice(p, 7, 1n << 96n, 110n);
    expect(p.cumulative).toBe("-950");
  });
});
describe("core-pool versus wallet settlement", () => {
  const trade = { coreAmount0: "-99", coreAmount1: "101", input0: true } as MarketTrade;
  it("adds input hook fees and subtracts output fees", () => {
    expect(settleTrade(trade, 1n, 2n, false)).toMatchObject({
      amountIn: "100",
      amountOut: "99",
      settlement: "wallet",
      internal: false,
    });
  });
  it("supports reverse direction and internal flags", () => {
    expect(
      settleTrade({ ...trade, coreAmount0: "101", coreAmount1: "-99" }, 2n, 1n, true)
    ).toMatchObject({ amountIn: "100", amountOut: "99", input0: false, internal: true });
  });
  it("rejects inconsistent signs and fees", () => {
    expect(() => settleTrade({ ...trade, coreAmount1: "-1" }, 0n, 0n, false)).toThrow();
    expect(() => settleTrade(trade, 0n, 102n, false)).toThrow();
  });
});
