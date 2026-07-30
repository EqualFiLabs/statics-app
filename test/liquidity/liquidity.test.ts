import { describe, expect, it } from "vitest";

import { lpStakeEligibility, resolveLiquidityPool } from "@/components/liquidity/LiquidityPage";
import {
  basketLiquiditySnapshot,
  borrowedLiquidityReadiness,
  canonicalFullRange,
  canonicalStatusLabel,
  v4PoolId,
  type CanonicalPoolRecord,
  type LpPositionRecord,
} from "@/lib/liquidity/liquidity";
import type { BasketRecord } from "@/lib/baskets/baskets";

describe("canonical liquidity identifiers", () => {
  it("derives a stable pool ID from the complete canonical key", () => {
    const key = {
      currency0: "0x0000000000000000000000000000000000000001" as const,
      currency1: "0x0000000000000000000000000000000000000002" as const,
      fee: 0,
      tickSpacing: 10,
      hooks: "0x0000000000000000000000000000000000000003" as const,
    };
    expect(v4PoolId(key)).toBe(v4PoolId({ ...key }));
    expect(v4PoolId({ ...key, tickSpacing: 20 })).not.toBe(v4PoolId(key));
  });

  it("keeps warmup and active pool states distinct", () => {
    expect(canonicalStatusLabel(1)).toBe("warmup");
    expect(canonicalStatusLabel(2)).toBe("active");
    expect(canonicalStatusLabel(0)).toBe("unconfigured");
    expect(canonicalStatusLabel(2, true)).toBe("exit-only");
  });

  it("requires an active unsubscribed full-range NFT before staking", () => {
    const pool = {
      poolId: `0x${"11".repeat(32)}`,
      status: 2,
      decommissioned: false,
      managerSynced: true,
      key: { tickSpacing: 10 },
    } as CanonicalPoolRecord;
    const [tickLower, tickUpper] = canonicalFullRange(10);
    const position = {
      poolId: pool.poolId,
      tickLower,
      tickUpper,
      hasSubscriber: false,
      liquidity: 1n,
    } as LpPositionRecord;
    expect(lpStakeEligibility(position, pool)).toBeNull();
    expect(lpStakeEligibility({ ...position, hasSubscriber: true }, pool)).toMatch(/Subscribed/);
    expect(lpStakeEligibility({ ...position, tickLower: tickLower + 10 }, pool)).toMatch(
      /full-range/
    );
    expect(lpStakeEligibility(position, { ...pool, decommissioned: true })).toMatch(/available/);
  });

  it("derives defaults and keeps management on the selected NFT's pool", () => {
    const firstPool = {
      poolId: `0x${"11".repeat(32)}`,
    } as CanonicalPoolRecord;
    const positionPool = {
      poolId: `0x${"22".repeat(32)}`,
    } as CanonicalPoolRecord;
    const position = {
      poolId: positionPool.poolId,
    } as LpPositionRecord;

    expect(resolveLiquidityPool("create", [firstPool, positionPool], "", position)).toBe(firstPool);
    expect(resolveLiquidityPool("stake", [firstPool, positionPool], "", position)).toBe(
      positionPool
    );
  });

  it("builds the borrow quote snapshot from chain-reconciled basket data", () => {
    const basket = {
      basketId: 7n,
      status: 1,
      totalSupply: 1_000n,
      token: { address: "0x0000000000000000000000000000000000000001" },
      mintFeeTiers: [],
      redemptionFeeTiers: [],
      originationFeeBps: 100,
      extensionFeeBps: 25,
      ltvBps: 7_500,
      recoveryPenaltyBps: 500,
      constituents: [
        {
          token: { address: "0x0000000000000000000000000000000000000002" },
          bundleAmount: 5n,
          vaultBalance: 9n,
        },
      ],
    } as unknown as BasketRecord;
    expect(basketLiquiditySnapshot(basket)).toMatchObject({
      basketId: 7n,
      totalSupply: 1_000n,
      originationFeeBps: 100n,
      extensionFeeBps: 25n,
      ltvBps: 7_500n,
      recoveryPenaltyBps: 500n,
      constituents: [
        {
          asset: "0x0000000000000000000000000000000000000002",
          bundleAmount: 5n,
          vaultBalance: 9n,
        },
      ],
    });
  });

  it("requires every canonical pool and a bounded positive liquidity input", () => {
    const basket = {
      constituents: [{}, {}],
    } as unknown as BasketRecord;
    const readyPool = {
      poolId: `0x${"11".repeat(32)}`,
      status: 2,
      decommissioned: false,
      managerSynced: true,
      observationCardinality: 2,
      spotTick: 99,
      referenceTick: 0,
    } as CanonicalPoolRecord;
    const secondPool = {
      ...readyPool,
      poolId: `0x${"22".repeat(32)}`,
    } as CanonicalPoolRecord;

    expect(borrowedLiquidityReadiness(basket, [readyPool], {})).toMatch(/Every basket/);
    expect(
      borrowedLiquidityReadiness(basket, [readyPool, secondPool], {
        [readyPool.poolId]: "1",
        [secondPool.poolId]: "0",
      })
    ).toMatch(/positive raw liquidity/);
    expect(
      borrowedLiquidityReadiness(basket, [{ ...readyPool, spotTick: 100 }, secondPool], {
        [readyPool.poolId]: "1",
        [secondPool.poolId]: "1",
      })
    ).toMatch(/price bound/);
    expect(
      borrowedLiquidityReadiness(basket, [readyPool, secondPool], {
        [readyPool.poolId]: "1",
        [secondPool.poolId]: "2",
      })
    ).toBeNull();
  });
});
