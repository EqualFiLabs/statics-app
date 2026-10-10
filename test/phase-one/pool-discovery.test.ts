import { describe, expect, it } from "vitest";
import { getAddress, type Address } from "viem";
import { v4PoolId } from "@statics-protocol/sdk/phase-one";
import type { SupportedPublicPool } from "@/lib/deployments/types";
import {
  type IndexedSwapPool,
  mergePhaseOnePools,
  precheckDiscoveredPool,
  discoverPhaseOnePool,
} from "@/lib/phase-one/pool-discovery";

const a = (n: string) => getAddress(`0x${n.repeat(40)}`) as Address;
const hook = a("4");
const key = { currency0: a("1"), currency1: a("2"), fee: 3000, tickSpacing: 60, hooks: hook };
const indexed = (overrides: Partial<IndexedSwapPool> = {}) =>
  ({
    poolId: v4PoolId(key),
    poolKey: key,
    gaugeInitialized: true,
    gaugeStopped: false,
    quarantined: false,
    decommissioned: false,
    ...overrides,
    token0: { address: key.currency0, symbol: "NEW", name: "New token", decimals: 18 },
    token1: { address: key.currency1, symbol: "OTH", name: "Other token", decimals: 18 },
    decommissionStarted: false,
    decommissionFinalized: false,
  }) as unknown as IndexedSwapPool;
describe("pool discovery", () => {
  it("rejects records whose id, order or hook do not match a Statics public pool", () => {
    expect(precheckDiscoveredPool(indexed(), hook)).toBeNull();
    expect(precheckDiscoveredPool(indexed({ poolId: `0x${"f".repeat(64)}` }), hook)).toBe(
      "pool-id"
    );
    expect(precheckDiscoveredPool(indexed(), a("5"))).toBe("hook");
    const swapped = { ...key, currency0: key.currency1, currency1: key.currency0 };
    expect(
      precheckDiscoveredPool(indexed({ poolKey: swapped, poolId: v4PoolId(swapped) }), hook)
    ).toBe("token-order");
  });
  it("uses indexed metadata and rejects inconsistent currencies or unknown decimals", () => {
    expect(discoverPhaseOnePool(indexed(), hook)).toMatchObject({
      reviewed: false,
      swappable: true,
    });
    expect(
      discoverPhaseOnePool({ ...indexed(), token0: { ...indexed().token0, address: a("8") } }, hook)
    ).toBe("key-mismatch");
    expect(
      discoverPhaseOnePool({ ...indexed(), token0: { ...indexed().token0, decimals: null } }, hook)
    ).toBe("decimals");
  });
  it("keeps quarantined or decommissioned pools out of trading", () => {
    expect(discoverPhaseOnePool(indexed({ quarantined: true }), hook)).toMatchObject({
      swappable: false,
    });
    expect(discoverPhaseOnePool(indexed({ decommissioned: true }), hook)).toMatchObject({
      swappable: false,
    });
  });
  it("uses refreshed lifecycle flags even for reviewed pools with missing indexed decimals", () => {
    const record = {
      ...indexed(),
      token0: { ...indexed().token0, decimals: null },
      quarantined: true,
    };
    const reviewed = {
      poolId: record.poolId,
      poolKey: record.poolKey,
      token0: { ...record.token0, decimals: 18, metadataSource: "reviewed-manifest" },
      token1: { ...record.token1, metadataSource: "reviewed-manifest" },
      enabled: true,
    } as SupportedPublicPool;
    expect(mergePhaseOnePools([reviewed], [], [record])[0]?.swappable).toBe(false);
    expect(
      mergePhaseOnePools(
        [reviewed],
        [],
        [{ ...record, quarantined: false, decommissionStarted: true }]
      )[0]?.swappable
    ).toBe(false);
  });
  it("labels missing metadata by address and caps what a token can claim", () => {
    const pool = discoverPhaseOnePool(
      { ...indexed(), token0: { ...indexed().token0, symbol: "   ", name: null, decimals: 18 } },
      hook
    );
    expect(typeof pool === "object" && pool.token0.symbol).toBe(
      `${a("1").slice(0, 6)}…${a("1").slice(-4)}`
    );
  });
  it("merges reviewed pools first and gives shared tokens their reviewed identity", () => {
    const reviewedToken = {
      address: a("1"),
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
      metadataSource: "reviewed-manifest" as const,
    };
    const reviewed = {
      poolId: `0x${"9".repeat(64)}`,
      poolKey: { ...key, currency1: a("3") },
      token0: reviewedToken,
      token1: { ...reviewedToken, address: a("3"), symbol: "USDG" },
      enabled: true,
    } as unknown as SupportedPublicPool;
    const discovered = discoverPhaseOnePool(indexed(), hook);
    if (typeof discovered !== "object") throw new Error("expected a pool");
    const merged = mergePhaseOnePools([reviewed, { ...reviewed, enabled: false }], [discovered]);
    expect(merged.map((pool) => pool.reviewed)).toEqual([true, false]);
    expect(merged[1]!.token0.symbol).toBe("WETH");
    expect(merged[1]!.token1.metadataSource).toBe("onchain-import");
    expect(
      mergePhaseOnePools([reviewed], [{ ...discovered, poolId: reviewed.poolId }])
    ).toHaveLength(1);
  });
});

describe("discovered pools on liquidity screens", () => {
  it("adds unreviewed discovered pools to the deployment and keeps reviewed entries untouched", async () => {
    const { withDiscoveredPools, hasUnreviewedToken } =
      await import("@/lib/phase-one/pool-discovery");
    const reviewedToken = {
      address: getAddress(`0x${"1".repeat(40)}`),
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
      metadataSource: "reviewed-manifest" as const,
    };
    const reviewedPool = {
      poolId: `0x${"a".repeat(64)}`,
      poolKey: {} as never,
      token0: reviewedToken,
      token1: reviewedToken,
      enabled: true,
      provenance: { deploymentId: "d", protocolCommit: "c", registrationBlock: 1n },
    } as const;
    const deployment = { descriptor: { deploymentId: "d" }, supportedPools: [reviewedPool] };
    const discovered = {
      poolId: `0x${"b".repeat(64)}`,
      poolKey: {} as never,
      token0: reviewedToken,
      token1: { ...reviewedToken, symbol: "NEW", metadataSource: "onchain-import" as const },
      reviewed: false,
      swappable: false,
    } as const;
    expect(withDiscoveredPools(deployment, [])).toBe(deployment);
    const merged = withDiscoveredPools(deployment, [
      { ...reviewedPool, reviewed: true, swappable: false },
      discovered,
    ] as never);
    expect(merged.supportedPools).toHaveLength(2);
    expect(merged.supportedPools[0]).toBe(reviewedPool);
    expect(merged.supportedPools[1]).toMatchObject({
      enabled: true,
      provenance: { protocolCommit: "indexed-discovery" },
    });
    expect(hasUnreviewedToken(merged.supportedPools[1]!)).toBe(true);
    expect(hasUnreviewedToken(reviewedPool)).toBe(false);
  });
});

it("keeps paused pools manageable without making them deposit eligible", async () => {
  const { liquidityDepositsAllowed } = await import("@/lib/phase-one/pool-discovery");
  const id = `0x${"1".repeat(64)}` as const;
  const pools = [{ poolId: id, swappable: false }] as never;
  expect(liquidityDepositsAllowed(id, pools)).toBe(false);
  expect(liquidityDepositsAllowed(id, [{ poolId: id, swappable: true }] as never)).toBe(true);
});

it("distinguishes swap quarantine from new-liquidity gauge eligibility", async () => {
  const { liquidityDepositsAllowed } = await import("@/lib/phase-one/pool-discovery");
  const stopped = discoverPhaseOnePool(indexed({ gaugeStopped: true }), hook);
  const quarantined = discoverPhaseOnePool(indexed({ quarantined: true }), hook);
  expect(stopped).toMatchObject({ swappable: true, liquidityEnabled: false });
  expect(quarantined).toMatchObject({ swappable: false, liquidityEnabled: true });
  expect(liquidityDepositsAllowed(v4PoolId(key), [stopped] as never)).toBe(false);
  expect(liquidityDepositsAllowed(v4PoolId(key), [quarantined] as never)).toBe(true);
});
