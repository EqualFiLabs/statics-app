import { describe, expect, it } from "vitest";
import { poolPrice, priceGraph, value, ratio, decimal, routePrice } from "../src/dex-pricing";
import { Q96 } from "../src/dex-domain";
import { pool, range, points, token } from "./dex-fixtures";
const config = {
  kind: "weth" as const,
  address: token(2).address,
  decimals: 18,
  symbol: "WETH",
  floor: 1n,
  wrappedNative: null,
};
describe("indexed rational pricing", () => {
  it("does not imply inherited price coverage before the fork boundary", () => {
    const p = { ...pool(), source: "genesis" as const, priceHistoryStart: "2000" };
    const ps = [{ ...points(p)[0]!, timestamp: "2000" }];
    expect(poolPrice(p, ps, 1999n)).toBeNull();
    expect(poolPrice(p, ps, 2001n)?.fallback).toBe(true);
    expect(poolPrice(p, ps, 3800n)?.fallback).toBe(false);
  });
  it("interpolates/extrapolates TWAP and floors negative ticks", () => {
    const p = pool();
    const ps = [
      ...points(p),
      { poolId: p.poolId, timestamp: "1801", tick: -1, cumulative: "0", sqrtPriceX96: String(Q96) },
    ];
    expect(poolPrice(p, ps, 1800n)).toMatchObject({ tick: 0, fallback: false });
    expect(poolPrice(p, ps, 1802n)?.tick).toBe(-1);
    expect(poolPrice(p, ps, 5n)?.fallback).toBe(true);
  });
  it("cannot anchor disconnected cycles or inventories under independent floors", () => {
    const a = pool(1),
      b = pool(2, 3, 4),
      c = pool(3, 4, 3);
    let graph = priceGraph(
      [a, b, c],
      [range(a), range(b), range(c)],
      [...points(a), ...points(b), ...points(c)],
      2000n,
      config
    );
    expect(graph.prices.has(token(1).address)).toBe(true);
    expect(graph.prices.has(token(3).address)).toBe(false);
    graph = priceGraph([a], [range(a)], points(a), 2000n, { ...config, floor: 10n ** 30n });
    expect(graph.prices.size).toBe(1);
  });
  it("uses quote-valued inventory, deterministic pool ties and no raw liquidity comparison", () => {
    const a = pool(2),
      b = pool(1);
    const g = priceGraph([a, b], [range(a), range(b)], [...points(a), ...points(b)], 2000n, config);
    expect(g.prices.get(token(1).address)?.route).toEqual([b.poolId]);
  });
  it("chooses fewer hops after a downstream bottleneck equalizes intermediate routes", () => {
    const ps = [pool(1, 2, 3), pool(2, 3, 4), pool(3, 4, 5), pool(4, 2, 5), pool(5, 5, 6)];
    const rs = ps.map((p, i) => range(p, String(BigInt([100, 100, 100, 90, 50][i]!) * 10n ** 18n)));
    const g = priceGraph(ps, rs, ps.flatMap(points), 2000n, config);
    expect(g.prices.get(token(6).address)?.route).toEqual([ps[3]!.poolId, ps[4]!.poolId]);
  });
  it("preserves tiny positive prices and adjusts mixed decimals at the whole-token boundary", () => {
    expect(value(10n ** 18n, ratio(1n, 10n ** 12n))).toBe(10n ** 6n);
    expect(decimal(ratio(1n, 10n ** 20n))).toBe("0.00000000000000000001");
    const p = pool();
    p.token0.decimals = null;
    expect(priceGraph([p], [range(p)], points(p), 2000n, config).prices.size).toBe(1);
  });
  it("requires explicit native wrapping and historical route coverage", () => {
    const p = pool();
    p.token0.address = token(0).address;
    const g = priceGraph([p], [range(p)], points(p), 2000n, {
      ...config,
      wrappedNative: token(1).address,
    });
    expect(g.prices.has(token(1).address)).toBe(true);
    expect(
      routePrice(token(1).address, [p.poolId], [p], points(p), 5n, {
        ...config,
        wrappedNative: token(1).address,
      })
    ).toBeNull();
  });
});
