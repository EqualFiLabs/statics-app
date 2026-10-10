import { describe, expect, it } from "vitest";
import type { EarnPositionRow } from "@/lib/rewards/position-table";
import {
  defaultStakeTarget,
  previewStake,
  earningWindow,
  previewUnstake,
  unstakeAvailable,
} from "@/lib/rewards/stake-preview";

const asset = `0x${"a".repeat(40)}` as const;
const rules = {
  now: 1_000n,
  eligibilityDelay: 86_400n,
  eligibilityBucketSize: 3_600n,
  allocationCooldown: 14_400n,
};
const row = (overrides: Partial<EarnPositionRow> = {}): EarnPositionRow => ({
  positionId: 7n,
  stakedBalance: 1_000n,
  liquidityLegs: 0n,
  selectedAssets: [asset],
  rewardSelections: [{ asset, pendingStake: 0n, eligibleAt: 0n }],
  maximumRewardAssets: 12n,
  maturingAssets: [],
  allocation: { totalAllocated: 300n, lockedStake: 200n, nextAllocationAt: 0n, poolCount: 2 },
  unavailable: false,
  ...overrides,
});

describe("stake preview", () => {
  it("puts added stake into the eligibility delay and extends the allocation cooldown", () => {
    expect(previewStake({ amount: 50n, target: row(), newAssetCount: 0 }, rules)).toEqual({
      kind: "stake",
      positionId: 7n,
      total: 1_050n,
      assetCount: 1,
      earning: [{ asset, earliest: 90_000n, latest: 90_000n, pendingStake: 0n }],
      cooldownUntil: 15_400n,
    });
  });

  it("keeps a later existing cooldown deadline and omits a zero cooldown", () => {
    const later = row({
      allocation: { totalAllocated: 0n, lockedStake: 0n, nextAllocationAt: 99_999n, poolCount: 0 },
    });
    expect(previewStake({ amount: 1n, target: later, newAssetCount: 0 }, rules)).toMatchObject({
      cooldownUntil: 99_999n,
    });
    expect(
      previewStake(
        { amount: 1n, target: row(), newAssetCount: 0 },
        { ...rules, allocationCooldown: 0n }
      )
    ).toMatchObject({ cooldownUntil: null });
  });

  it("previews a new position with its chosen asset count", () => {
    expect(previewStake({ amount: 1n, target: null, newAssetCount: 3 }, rules)).toEqual({
      kind: "create",
      assetCount: 3,
      earningFrom: 90_000n,
      cooldownUntil: 15_400n,
    });
  });

  it("locks only valid allocations and unstakes maturing stake first", () => {
    const target = row({ rewardSelections: [{ asset, pendingStake: 100n, eligibleAt: 90_000n }] });
    expect(unstakeAvailable(target)).toBe(800n);
    expect(previewUnstake({ amount: 60n, target })).toMatchObject({
      assets: [{ asset, fromMaturing: 60n, fromEarning: 0n }],
      remaining: 940n,
      exceedsAvailable: false,
    });
    expect(previewUnstake({ amount: 250n, target })).toMatchObject({
      assets: [{ asset, fromMaturing: 100n, fromEarning: 150n }],
    });
    expect(previewUnstake({ amount: 801n, target })).toMatchObject({
      exceedsAvailable: true,
      locked: 200n,
    });
  });

  it("preselects the requested position, else the largest stake, else a new position", () => {
    const rows = [
      row({ positionId: 1n, stakedBalance: 5n }),
      row({ positionId: 2n, stakedBalance: 9n }),
    ];
    expect(defaultStakeTarget(rows, 1n)).toBe("1");
    expect(defaultStakeTarget(rows, 99n)).toBe("2");
    expect(defaultStakeTarget([], undefined)).toBe("new");
  });
});

it("tracks pending and earning reductions independently for each reward asset", () => {
  const other = `0x${"b".repeat(40)}` as const;
  const target = row({
    rewardSelections: [
      { asset, pendingStake: 100n, eligibleAt: 90_000n },
      { asset: other, pendingStake: 0n, eligibleAt: 0n },
    ],
  });
  expect(previewUnstake({ amount: 60n, target })).toMatchObject({
    assets: [
      { asset, fromMaturing: 60n, fromEarning: 0n },
      { asset: other, fromMaturing: 0n, fromEarning: 60n },
    ],
  });
});
it("bounds weighted top-up maturity using every possible unrounded start time", () => {
  const selection = { asset, pendingStake: 100n, eligibleAt: 90_000n };
  const testRules = { ...rules, now: 45_000n };
  const window = earningWindow(selection, 37n, testRules);
  expect(window).toMatchObject({ earliest: 100_800n, latest: 104_400n });
  for (let start = 1n; start <= 3600n; start += 31n) {
    const credit = (100n * (testRules.now - start)) / 137n;
    const raw = testRules.now - credit + testRules.eligibilityDelay;
    const exact = ((raw + 3599n) / 3600n) * 3600n;
    expect(exact >= window.earliest && exact <= window.latest).toBe(true);
  }
});
it("uses a fresh hourly boundary once existing pending stake has matured", () => {
  expect(earningWindow({ asset, pendingStake: 100n, eligibleAt: 1000n }, 5n, rules)).toMatchObject({
    earliest: 90_000n,
    latest: 90_000n,
    pendingStake: 0n,
  });
});
it("uses the stored weighted start to select one exact top-up maturity", () => {
  const selection = { asset, pendingStake: 100n, eligibleAt: 90_000n, pendingStartTime: 3_600n };
  expect(earningWindow(selection, 37n, { ...rules, now: 45_000n })).toEqual({
    asset,
    earliest: 104_400n,
    latest: 104_400n,
    pendingStake: 100n,
  });
  // Two starts sharing the same rounded deadline can lead to different top-up deadlines.
  expect(
    earningWindow({ ...selection, pendingStartTime: 1n }, 37n, { ...rules, now: 45_000n })
  ).toMatchObject({ earliest: 100_800n, latest: 100_800n });
});
it("caps the stored pending age and floors weighted credit as the contract does", () => {
  const selection = { asset, pendingStake: 100n, eligibleAt: 90_000n, pendingStartTime: 1n };
  const now = 89_999n;
  const credit = (100n * rules.eligibilityDelay) / 137n;
  const raw = now - credit + rules.eligibilityDelay;
  const exact = ((raw + 3599n) / 3600n) * 3600n;
  expect(earningWindow(selection, 37n, { ...rules, now })).toMatchObject({
    earliest: exact,
    latest: exact,
  });
});
it("ignores cleared timing after maturity and keeps each asset's start independent", () => {
  const other = `0x${"b".repeat(40)}` as const;
  const target = row({
    rewardSelections: [
      { asset, pendingStake: 100n, eligibleAt: 90_000n, pendingStartTime: 1n },
      { asset: other, pendingStake: 100n, eligibleAt: 90_000n, pendingStartTime: 3_600n },
    ],
  });
  expect(
    previewStake({ amount: 37n, target, newAssetCount: 0 }, { ...rules, now: 45_000n })
  ).toMatchObject({
    earning: [
      { asset, earliest: 100_800n, latest: 100_800n },
      { asset: other, earliest: 104_400n, latest: 104_400n },
    ],
  });
  expect(
    earningWindow({ asset, pendingStake: 0n, eligibleAt: 0n, pendingStartTime: 0n }, 5n, rules)
  ).toMatchObject({ earliest: 90_000n, latest: 90_000n, pendingStake: 0n });
});
it("keeps an existing future cooldown even when the configured ingress cooldown is zero", () => {
  const target = row({
    allocation: { lockedStake: 0n, totalAllocated: 0n, nextAllocationAt: 5000n, poolCount: 0 },
  });
  expect(
    previewStake({ amount: 1n, target, newAssetCount: 0 }, { ...rules, allocationCooldown: 0n })
  ).toMatchObject({ cooldownUntil: 5000n });
});
