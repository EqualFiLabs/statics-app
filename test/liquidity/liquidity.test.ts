import { describe, expect, it } from "vitest";

import { canonicalStatusLabel, v4PoolId } from "@/lib/liquidity/liquidity";

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
});
