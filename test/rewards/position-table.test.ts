import { describe, expect, it } from "vitest";
import {
  earnPositionStatus,
  freeStake,
  matchesSearch,
  matchesStatusFilter,
  sortEarnRows,
  staleAllocation,
  type EarnPositionRow,
} from "@/lib/rewards/position-table";

const usdc = `0x${"a".repeat(40)}` as const,
  weth = `0x${"b".repeat(40)}` as const;
const now = 1_000_000n;
const row = (overrides: Partial<EarnPositionRow> = {}): EarnPositionRow => ({
  positionId: 1n,
  stakedBalance: 100n,
  liquidityLegs: 0n,
  selectedAssets: [usdc],
  maximumRewardAssets: 12n,
  maturingAssets: [],
  allocation: { totalAllocated: 40n, lockedStake: 40n, nextAllocationAt: 0n, poolCount: 1 },
  unavailable: false,
  ...overrides,
});

describe("Earn position table", () => {
  it("ranks the most urgent status first", () => {
    expect(earnPositionStatus(row({ unavailable: true }), now)).toBe("unavailable");
    expect(earnPositionStatus(row({ stakedBalance: 0n, selectedAssets: [] }), now)).toBe("empty");
    expect(earnPositionStatus(row({ selectedAssets: undefined }), now)).toBe("loading");
    // A staked position with no assets earns nothing, even while also cooling down.
    expect(
      earnPositionStatus(
        row({
          selectedAssets: [],
          allocation: {
            totalAllocated: 0n,
            lockedStake: 0n,
            nextAllocationAt: now + 1n,
            poolCount: 0,
          },
        }),
        now
      )
    ).toBe("earning-nothing");
    expect(
      earnPositionStatus(
        row({
          allocation: { totalAllocated: 40n, lockedStake: 10n, nextAllocationAt: 0n, poolCount: 2 },
        }),
        now
      )
    ).toBe("stale-allocation");
    expect(
      earnPositionStatus(
        row({
          allocation: {
            totalAllocated: 40n,
            lockedStake: 40n,
            nextAllocationAt: now + 60n,
            poolCount: 1,
          },
        }),
        now
      )
    ).toBe("cooldown");
    expect(earnPositionStatus(row({ maturingAssets: [weth] }), now)).toBe("maturing");
    expect(earnPositionStatus(row(), now)).toBe("earning");
  });

  it("keeps clock-dependent statuses loading until chain time is available", () => {
    expect(
      earnPositionStatus(
        row({
          allocation: {
            totalAllocated: 40n,
            lockedStake: 40n,
            nextAllocationAt: now + 60n,
            poolCount: 1,
          },
        }),
        undefined
      )
    ).toBe("loading");
    expect(matchesStatusFilter(row(), "cooldown", undefined)).toBe(false);
  });

  it("separates stale allocation from free stake", () => {
    const stale = row({
      stakedBalance: 100n,
      allocation: { totalAllocated: 70n, lockedStake: 30n, nextAllocationAt: 0n, poolCount: 2 },
    });
    expect(staleAllocation(stale)).toBe(40n);
    expect(freeStake(stale)).toBe(30n);
    expect(freeStake(row({ allocation: undefined }))).toBe(100n);
  });

  it("filters by status without hiding unread rows from All", () => {
    const unread = row({ selectedAssets: undefined, allocation: undefined });
    expect(matchesStatusFilter(unread, "all", now)).toBe(true);
    expect(matchesStatusFilter(unread, "attention", now)).toBe(false);
    expect(matchesStatusFilter(row({ selectedAssets: [] }), "attention", now)).toBe(true);
    expect(matchesStatusFilter(row({ liquidityLegs: 2n }), "liquidity", now)).toBe(true);
    expect(matchesStatusFilter(row({ maturingAssets: [weth] }), "earning", now)).toBe(true);
  });

  it("searches by position ID and reward asset", () => {
    const symbol = (asset: string) => (asset === usdc ? "USDC" : undefined);
    expect(matchesSearch(row({ positionId: 1042n }), "#104", symbol)).toBe(true);
    expect(matchesSearch(row(), "usd", symbol)).toBe(true);
    expect(matchesSearch(row(), usdc.toUpperCase().replace("0X", "0x"), symbol)).toBe(true);
    expect(matchesSearch(row(), "weth", symbol)).toBe(false);
    expect(matchesSearch(row(), "  ", symbol)).toBe(true);
  });

  it("sorts stably by the chosen field, unread allocations last when descending", () => {
    const rows = [
      row({ positionId: 3n, stakedBalance: 5n }),
      row({ positionId: 1n, stakedBalance: 50n, allocation: undefined }),
      row({ positionId: 2n, stakedBalance: 50n }),
    ];
    expect(
      sortEarnRows(rows, { field: "staked", direction: "desc" }).map((r) => r.positionId)
    ).toEqual([1n, 2n, 3n]);
    expect(
      sortEarnRows(rows, { field: "allocated", direction: "desc" }).map((r) => r.positionId)
    ).toEqual([2n, 3n, 1n]);
    expect(sortEarnRows(rows, { field: "id", direction: "asc" }).map((r) => r.positionId)).toEqual([
      1n,
      2n,
      3n,
    ]);
  });
});
