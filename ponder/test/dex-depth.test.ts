import { describe, expect, it } from "vitest";
import { poolDepth } from "../src/dex-depth";
import type { DexSnapshot } from "../src/dex-snapshot";
import { pool, range } from "./dex-fixtures";

const snapshot = (pools: DexSnapshot["pools"], ranges: DexSnapshot["ranges"]) =>
  ({ pools, ranges }) as unknown as DexSnapshot;
const keyed = (r: ReturnType<typeof range>, key: string) => ({ ...r, rangeKey: key });

describe("pool depth", () => {
  it("nets range liquidity per tick and sums the liquidity active at the current tick", () => {
    const p = { ...pool(1), tick: 10, tickSpacing: 10 };
    const other = pool(2);
    const depth = poolDepth(
      snapshot(
        [p, other],
        [
          keyed({ ...range(p, "100"), tickLower: -100, tickUpper: 100 }, "a"),
          keyed({ ...range(p, "50"), tickLower: 0, tickUpper: 100 }, "b"),
          keyed({ ...range(p, "30"), tickLower: 100, tickUpper: 200 }, "c"),
          keyed({ ...range(p, "0"), tickLower: -500, tickUpper: 500 }, "closed"),
          keyed({ ...range(other, "999"), tickLower: -10, tickUpper: 10 }, "other"),
        ]
      ),
      p.poolId.toUpperCase().replace("0X", "0x")
    );
    expect(depth).toEqual({
      poolId: p.poolId,
      liquidityComplete: true,
      tickSpacing: 10,
      tick: 10,
      sqrtPriceX96: p.sqrtPriceX96,
      liquidity: "150",
      ticks: [
        { tick: -100, liquidityNet: "100" },
        { tick: 0, liquidityNet: "50" },
        { tick: 100, liquidityNet: "-120" },
        { tick: 200, liquidityNet: "-30" },
      ],
    });
  });

  it("omits ticks whose ranges cancel and returns null for unknown or uninitialized pools", () => {
    const p = pool(1);
    const depth = poolDepth(
      snapshot(
        [p],
        [
          keyed({ ...range(p, "40"), tickLower: -10, tickUpper: 0 }, "a"),
          keyed({ ...range(p, "40"), tickLower: 0, tickUpper: 10 }, "b"),
        ]
      ),
      p.poolId
    );
    expect(depth?.ticks).toEqual([
      { tick: -10, liquidityNet: "40" },
      { tick: 10, liquidityNet: "-40" },
    ]);
    expect(poolDepth(snapshot([p], []), pool(3).poolId)).toBeNull();
    expect(poolDepth(snapshot([{ ...p, initialized: false }], []), p.poolId)).toBeNull();
  });
});
