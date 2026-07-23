import { describe, expect, it } from "vitest";

import { canonicalFullRange, lpStakeEligibility } from "@/components/liquidity/LiquidityPage";
import {
  canonicalStatusLabel,
  v4PoolId,
  type CanonicalPoolRecord,
  type LpPositionRecord,
} from "@/lib/liquidity/liquidity";

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
});
