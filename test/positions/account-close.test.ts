import { describe, expect, it } from "vitest";
import type { Hex } from "viem";
import { closeChecklist } from "@/lib/positions/account-close";

const pool = `0x${"a".repeat(64)}` as Hex;
const empty = {
  activeLegCount: 0n,
  unresolvedObligationCount: 0n,
  stakedBalance: 0n,
  totalAllocated: 0n,
  selectedAssets: 0,
  liquidityPools: [],
  rewardsClaimable: false,
  loaded: true,
};

describe("close checklist", () => {
  it("is ready only when the contract's counts are clear", () => {
    expect(closeChecklist(empty)).toEqual({ items: [], ready: true });
    expect(closeChecklist({ ...empty, unresolvedObligationCount: 1n }).ready).toBe(false);
  });
  it("lists blockers in the order they can be cleared", () => {
    const { items, ready } = closeChecklist({
      ...empty,
      activeLegCount: 3n,
      stakedBalance: 10n,
      totalAllocated: 4n,
      selectedAssets: 2,
      liquidityPools: [pool],
      rewardsClaimable: true,
    });
    expect(ready).toBe(false);
    expect(items.map((item) => item.kind)).toEqual([
      "withdraw-liquidity",
      "remove-allocations",
      "unstake",
      "collect-rewards",
      "stop-earning",
    ]);
  });
  it("keeps a pool-specific resolution for exited LP reward dust", () => {
    expect(
      closeChecklist({ ...empty, activeLegCount: 1n, unresolvedLiquidityPools: [pool] })
    ).toEqual({
      items: [{ kind: "resolve-liquidity", poolId: pool }],
      ready: false,
    });
  });
  it("names an unexplained attachment once everything has loaded", () => {
    expect(closeChecklist({ ...empty, activeLegCount: 1n }).items).toEqual([
      { kind: "other", count: 1n },
    ]);
    expect(closeChecklist({ ...empty, activeLegCount: 1n, loaded: false }).items).toEqual([]);
  });
});
