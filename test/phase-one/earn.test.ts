import { describe, expect, it } from "vitest";
import { maxUint256 } from "viem";
import {
  readEarnFilters,
  earnHref,
  earnViews,
  rewardDisplay,
  rewardRowKey,
} from "@/lib/rewards/earn";
import { parseIndexedAllocationSnapshot } from "@/lib/indexer/phase-one";
const owner = `0x${"1".repeat(40)}` as const,
  pool = `0x${"2".repeat(64)}` as const,
  asset = `0x${"3".repeat(40)}` as const;
describe("Earn navigation and amounts", () => {
  it("rejects malformed, duplicate and out-of-range filters", () => {
    for (const filter of [
      "positionId=-1",
      "positionId=0x30",
      `positionId=${maxUint256 + 1n}`,
      "positionId=1&positionId=2",
      "poolId=abc",
      "asset=no",
      "share=both",
    ])
      expect(readEarnFilters(new URLSearchParams(filter)).invalid).toBe(true);
    expect(readEarnFilters(new URLSearchParams("positionId=0")).positionId).toBe(0n);
    expect(readEarnFilters(new URLSearchParams("positionId=1&unlock=5")).unlock).toBe(5n);
    expect(readEarnFilters(new URLSearchParams("unlock=0")).unlock).toBeUndefined();
    for (const unlock of ["unlock=-1", "unlock=1.5", "unlock=1&unlock=2"])
      expect(readEarnFilters(new URLSearchParams(unlock)).invalid).toBe(true);
    expect(earnHref("allocations", { positionId: 1n, unlock: 5n })).toBe(
      "/app/rewards/allocations?positionId=1&unlock=5"
    );
    expect(earnHref("gauge", { positionId: 1n, unlock: 5n })).toBe(
      "/app/rewards/gauge?positionId=1"
    );
  });
  it("preserves only applicable filters between features", () => {
    const filters = readEarnFilters(
      new URLSearchParams(`positionId=30&poolId=${pool}&asset=${asset}&share=allocator`)
    );
    expect(earnHref("overview", filters)).toBe("/app/rewards");
    expect(earnHref("staking", filters)).toBe(`/app/rewards/staking?positionId=30&asset=${asset}`);
    expect(earnHref("allocations", filters)).toBe(
      `/app/rewards/allocations?positionId=30&poolId=${pool}`
    );
    expect(earnViews).not.toContain("bribes");
  });
  it("never rounds tiny positive rewards to zero and retains exact values", () => {
    expect(rewardDisplay(1n, 18)).toEqual({ display: "<0.000001", exact: "0.000000000000000001" });
    expect(rewardDisplay(123456789n, 6)).toEqual({ display: "123.456789", exact: "123.456789" });
    expect(rewardDisplay(0n, 18).display).toBe("0");
    expect(rewardRowKey(30n, pool.toUpperCase().replace("0X", "0x") as `0x${string}`)).toBe(
      `30:${pool}`
    );
  });
});
describe("indexed allocation snapshots", () => {
  const response = () => ({
    deploymentId: "fork",
    indexedAtBlock: "100",
    position: { positionId: "30", owner },
    allocations: {
      nextAllocationAt: "120",
      totalAllocated: "10",
      lockedStake: "10",
      poolIds: [pool],
      amounts: ["10"],
      eligibilityVersions: [pool],
      updatedAtBlock: "99",
    },
  });
  it("reads typed amounts and bytes32 eligibility versions without RPCs", () => {
    expect(parseIndexedAllocationSnapshot(response(), 30n, "fork", owner)).toMatchObject({
      totalAllocated: 10n,
      allocations: [{ poolId: pool, amount: 10n, eligibilityVersion: pool }],
    });
  });
  it("treats an absent allocation record as a valid empty snapshot", () => {
    expect(
      parseIndexedAllocationSnapshot({ ...response(), allocations: null }, 30n, "fork", owner)
        .totalAllocated
    ).toBe(0n);
  });
  it("rejects foreign owners, deployments, malformed arrays and inconsistent totals", () => {
    expect(() => parseIndexedAllocationSnapshot(response(), 30n, "other", owner)).toThrow(
      "deployment"
    );
    expect(() => parseIndexedAllocationSnapshot(response(), 31n, "fork", owner)).toThrow("wallet");
    expect(() =>
      parseIndexedAllocationSnapshot(
        { ...response(), allocations: { ...response().allocations, amounts: [] } },
        30n,
        "fork",
        owner
      )
    ).toThrow("arrays");
    expect(() =>
      parseIndexedAllocationSnapshot(
        { ...response(), allocations: { ...response().allocations, totalAllocated: "11" } },
        30n,
        "fork",
        owner
      )
    ).toThrow("inconsistent");
  });
});
