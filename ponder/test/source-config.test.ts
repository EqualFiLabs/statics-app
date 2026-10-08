import { getAddress } from "viem";
import { describe, expect, it } from "vitest";

import { configuredAddress, configuredCanonicalPool } from "../src/source-config";

const poolManager = getAddress("0x1111111111111111111111111111111111111111");
const poolId = `0x${"12".repeat(32)}` as const;

describe("Ponder source configuration", () => {
  it("omits empty and zero-address sources", () => {
    expect(configuredAddress("SOURCE", {})).toBeUndefined();
    expect(
      configuredAddress("SOURCE", { SOURCE: "0x0000000000000000000000000000000000000000" })
    ).toBeUndefined();
  });

  it("normalizes configured source addresses", () => {
    expect(
      configuredAddress("SOURCE", { SOURCE: "0x1111111111111111111111111111111111111111" })
    ).toBe(poolManager);
  });

  it("requires PoolManager and canonical PoolId together", () => {
    expect(() => configuredCanonicalPool(poolManager, {})).toThrow("must be configured together");
    expect(() => configuredCanonicalPool(undefined, { PONDER_CANONICAL_POOL_ID: poolId })).toThrow(
      "must be configured together"
    );
  });

  it("accepts only a 32-byte canonical PoolId", () => {
    expect(configuredCanonicalPool(poolManager, { PONDER_CANONICAL_POOL_ID: poolId })).toBe(poolId);
    expect(() =>
      configuredCanonicalPool(poolManager, { PONDER_CANONICAL_POOL_ID: "0x1234" })
    ).toThrow("32-byte hex value");
  });
});

describe("configured log block ranges", () => {
  it("uses defaults when unset or whitespace", async () => {
    const { configuredLogBlockRange } = await import("../src/source-config");
    expect(configuredLogBlockRange({})).toBeUndefined();
    expect(configuredLogBlockRange({ PONDER_LOG_BLOCK_RANGE: "  " })).toBeUndefined();
    expect(configuredLogBlockRange({ PONDER_LOG_BLOCK_RANGE: " 1000000 " })).toBe(1000000);
  });
  it.each(["0", "-1", "1.5", "NaN", "1000001", "9007199254740992"])(
    "rejects unsafe range %s before Ponder chunking",
    async (value) => {
      const { configuredLogBlockRange } = await import("../src/source-config");
      expect(() => configuredLogBlockRange({ PONDER_LOG_BLOCK_RANGE: value })).toThrow(
        "from 1 through 1000000"
      );
    }
  );
});
