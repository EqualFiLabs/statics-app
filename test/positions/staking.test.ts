import { describe, expect, it } from "vitest";

import {
  checkpointRewardAssetBatches,
  formatMaturity,
  groupByMaturity,
  rankRewardCandidates,
  rewardSelectionActionPlan,
  rewardSelectionChanges,
  toggleRewardSelection,
  type RewardSelection,
} from "@/lib/positions/staking";

const token = (symbol: string, last: string) => ({
  address: `0x${"0".repeat(39)}${last}` as `0x${string}`,
  name: symbol,
  symbol,
  decimals: 18,
  metadataAvailable: true,
});

const wbtc = token("WBTC", "1");
const weth = token("WETH", "2");
const usdc = token("USDC", "3");

function selection(overrides: Partial<RewardSelection> = {}): RewardSelection {
  return {
    token: wbtc,
    selected: true,
    actualEligibleStake: 0n,
    actualPendingStake: 100n,
    effectiveEligibleWeight: 0n,
    effectivePendingWeight: 100n,
    eligibleAt: 1_000n,
    ...overrides,
  };
}

describe("staking maturity", () => {
  it("bounds explicit reward checkpoints to eight assets per transaction", () => {
    const assets = Array.from(
      { length: 17 },
      (_, index) => token(`T${index}`, ((index % 9) + 1).toString()).address
    );
    expect(checkpointRewardAssetBatches(assets).map((batch) => batch.length)).toEqual([8, 8, 1]);
  });
  it("collapses assets that start earning at the same moment into one line", () => {
    // Opting into several assets at once produces one maturity, not three.
    const groups = groupByMaturity([
      selection({ token: wbtc }),
      selection({ token: weth }),
      selection({ token: usdc }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].tokens.map((item) => item.symbol)).toEqual(["WBTC", "WETH", "USDC"]);
  });

  it("reports the stake maturing, not the sum across its assets", () => {
    // Pending stake is recorded per asset, so the same 100 appears against each
    // one. Summing would tell a staker that 300 is on its way.
    const groups = groupByMaturity([
      selection({ token: wbtc, actualPendingStake: 100n }),
      selection({ token: weth, actualPendingStake: 100n }),
    ]);

    expect(groups[0].pendingStake).toBe(100n);
  });

  it("keeps separate maturities apart and orders them soonest first", () => {
    const groups = groupByMaturity([
      selection({ token: usdc, eligibleAt: 3_000n }),
      selection({ token: wbtc, eligibleAt: 1_000n }),
      selection({ token: weth, eligibleAt: 2_000n }),
    ]);

    expect(groups.map((group) => group.eligibleAt)).toEqual([1_000n, 2_000n, 3_000n]);
  });

  it("ignores selections that are already earning", () => {
    expect(
      groupByMaturity([selection({ actualPendingStake: 0n, actualEligibleStake: 100n })])
    ).toEqual([]);
  });

  it("says nothing is maturing when nothing is", () => {
    expect(groupByMaturity([])).toEqual([]);
  });

  it("shows a clock time today and a date beyond it", () => {
    // "3:00 PM" reads as today, so anything further has to carry its date.
    const now = BigInt(Math.floor(Date.parse("2026-07-26T09:00:00Z") / 1_000));
    const laterToday = BigInt(Math.floor(Date.parse("2026-07-26T15:00:00Z") / 1_000));
    const tomorrow = BigInt(Math.floor(Date.parse("2026-07-27T15:00:00Z") / 1_000));

    expect(formatMaturity(laterToday, now)).not.toMatch(/2026/);
    expect(formatMaturity(tomorrow, now)).toMatch(/2026/);
  });
});

describe("reward selection drafts", () => {
  it("computes additions and removals without duplicating assets", () => {
    expect(
      rewardSelectionChanges(
        [wbtc.address, weth.address],
        [weth.address, usdc.address, usdc.address]
      )
    ).toEqual({ additions: [usdc.address], removals: [wbtc.address] });
  });

  it("toggles locally and permits a replacement at the selection cap", () => {
    const withoutWbtc = toggleRewardSelection([wbtc.address, weth.address], wbtc.address, 2n);
    expect(withoutWbtc).toEqual([weth.address]);
    expect(toggleRewardSelection(withoutWbtc, usdc.address, 2n)).toEqual([
      weth.address,
      usdc.address,
    ]);
  });

  it("plans removals before additions so a full position can replace assets", () => {
    expect(
      rewardSelectionActionPlan([wbtc.address, weth.address], [weth.address, usdc.address])
    ).toEqual([
      { kind: "remove", assets: [wbtc.address] },
      { kind: "add", assets: [usdc.address] },
    ]);
  });

  it("recomputes only unfinished work after a partially confirmed batch", () => {
    expect(rewardSelectionActionPlan([weth.address], [weth.address, usdc.address])).toEqual([
      { kind: "add", assets: [usdc.address] },
    ]);
  });

  it("rejects additions beyond the selection cap", () => {
    expect(() => toggleRewardSelection([wbtc.address, weth.address], usdc.address, 2n)).toThrow(
      "2 asset maximum"
    );
  });
});

describe("reward candidate ranking", () => {
  const candidate = (symbol: string, sources: string[]) => ({ symbol, sources });

  it("puts assets that have actually paid rewards first", () => {
    // The picker hides everything past the first few, so what surfaces has to
    // be justified. Proven payers are the strongest evidence available.
    const ranked = rankRewardCandidates([
      candidate("AAA", ["MAJ underlying"]),
      candidate("BBB", ["Fee history"]),
      candidate("CCC", ["Statics deployment"]),
    ]);

    expect(ranked.map((item) => item.symbol)).toEqual(["BBB", "CCC", "AAA"]);
  });

  it("ranks a payer above a core asset even when it is also an underlying", () => {
    const ranked = rankRewardCandidates([
      candidate("CORE", ["Statics deployment"]),
      candidate("PAID", ["MAJ underlying", "Fee history"]),
    ]);

    expect(ranked[0].symbol).toBe("PAID");
  });

  it("preserves the catalog's alphabetical order inside a tier", () => {
    const ranked = rankRewardCandidates([
      candidate("AAA", ["MAJ underlying"]),
      candidate("BBB", ["MAJ underlying"]),
      candidate("CCC", ["MAJ underlying"]),
    ]);

    expect(ranked.map((item) => item.symbol)).toEqual(["AAA", "BBB", "CCC"]);
  });

  it("does not drop or duplicate candidates", () => {
    const input = [
      candidate("AAA", ["Fee history"]),
      candidate("BBB", []),
      candidate("CCC", ["Statics deployment"]),
    ];
    expect(rankRewardCandidates(input)).toHaveLength(3);
    expect(rankRewardCandidates(input)).not.toBe(input);
  });
});
