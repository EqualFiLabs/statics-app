import { describe, expect, it, vi } from "vitest";
import { getAddress, type Hex } from "viem";
import {
  executeBatchRewardClaims,
  freezeBatchRewardClaims,
  planBatchRewardClaims,
  reviewedBatchRewardAmounts,
} from "@/lib/phase-one/batch-rewards";
import type { PositionRewardPortfolio } from "@/lib/phase-one/reward-portfolio";

const address = (id: number) => getAddress(`0x${id.toString(16).padStart(40, "0")}`);
const poolId = `0x${"a".repeat(64)}` as Hex;
const receiver = address(99);
const diamond = address(100);
const row = (positionId = 1n): PositionRewardPortfolio => ({
  positionId,
  globalUnavailable: false,
  discoveryUnavailable: false,
  global: { claimAssets: [address(1), address(2)], pendingRewards: [3n, 0n] },
  pools: [
    {
      poolId,
      hasLp: true,
      hasAllocator: true,
      rewards: {
        lp: {
          slotCount: 3,
          assets: [address(1), address(2), address(3), address(0), address(0)],
          amounts: [4n, 0n, 5n, 0n, 0n],
        },
        allocator: [{ slot: 2, asset: address(3), amount: 6n, allocation: 1n }],
      },
    },
  ],
});
describe("batch reward planning", () => {
  it("combines gauge and LP bribes, includes allocator bribes, and omits zero assets", () => {
    const [batch] = planBatchRewardClaims([row()], receiver, diamond);
    expect(batch.globalClaims[0].assets).toEqual([address(1)]);
    expect(batch.lpClaims[0].slots).toEqual([0, 2]);
    expect(batch.allocatorClaims[0].slots).toEqual([2]);
    expect(batch.receiver).toBe(receiver);
    expect(batch.lpClaims[0].minimumAmounts).toEqual([0n, 0n]);
  });
  it("discovers retained rewards without claiming non-LP slots", () => {
    const value = row();
    const [batch] = planBatchRewardClaims(
      [{ ...value, pools: [{ ...value.pools[0], hasLp: false }] }],
      receiver,
      diamond
    );
    expect(batch.lpClaims).toEqual([]);
    expect(batch.allocatorClaims).toHaveLength(1);
  });
  it("rejects incomplete discovery instead of claiming a partial wallet portfolio", () => {
    expect(() =>
      planBatchRewardClaims([{ ...row(), discoveryUnavailable: true }], receiver, diamond)
    ).toThrow("Load all");
    expect(() =>
      planBatchRewardClaims(
        [{ ...row(), pools: [{ ...row().pools[0], rewards: null }] }],
        receiver,
        diamond
      )
    ).toThrow("Load all");
  });
  it("packs larger wallets within both limits without losing entries", () => {
    const rows = Array.from({ length: 30 }, (_, id) => row(BigInt(id + 1)));
    const batches = planBatchRewardClaims(rows, receiver, diamond);
    expect(batches).toHaveLength(6);
    expect(batches.flatMap((batch) => batch.globalClaims)).toHaveLength(30);
    expect(batches.flatMap((batch) => batch.lpClaims)).toHaveLength(30);
    expect(batches.flatMap((batch) => batch.allocatorClaims)).toHaveLength(30);
    for (const batch of batches) {
      const groups = [...batch.globalClaims, ...batch.lpClaims, ...batch.allocatorClaims];
      expect(groups.length).toBeLessThanOrEqual(16);
      expect(
        groups.reduce((sum, group) => sum + group.minimumAmounts.length, 0)
      ).toBeLessThanOrEqual(64);
    }
  });
  it("freezes actual complete-batch payouts without mutating the plan", () => {
    const [batch] = planBatchRewardClaims([row()], receiver, diamond);
    const frozen = freezeBatchRewardClaims(batch, {
      globalReceived: [[7n]],
      lpReceived: [[8n, 9n]],
      allocatorReceived: [[10n]],
    });
    expect(batch.lpClaims[0].minimumAmounts).toEqual([0n, 0n]);
    expect(frozen.lpClaims[0].minimumAmounts).toEqual([8n, 9n]);
    expect(reviewedBatchRewardAmounts([frozen], [row()])).toEqual([
      { asset: address(1), amount: 15n },
      { asset: address(3), amount: 19n },
    ]);
    expect(() =>
      freezeBatchRewardClaims(batch, { globalReceived: [], lpReceived: [], allocatorReceived: [] })
    ).toThrow("Invalid");
  });
  it("returns no batches for an empty or zero portfolio", () => {
    expect(planBatchRewardClaims([], receiver, diamond)).toEqual([]);
    expect(
      planBatchRewardClaims(
        [{ ...row(), pools: [], global: { claimAssets: [address(1)], pendingRewards: [0n] } }],
        receiver,
        diamond
      )
    ).toEqual([]);
  });
});
describe("batch transaction sequencing", () => {
  const batches = planBatchRewardClaims(
    Array.from({ length: 20 }, (_, id) => row(BigInt(id + 1))),
    receiver,
    diamond
  );
  it("stops after failure, keeping the confirmed count without replay", async () => {
    const send = vi.fn().mockResolvedValueOnce(poolId).mockRejectedValueOnce(new Error("Rejected"));
    const confirmed = vi.fn();
    await expect(
      executeBatchRewardClaims({ batches, send, onConfirmed: confirmed, assertCurrent: vi.fn() })
    ).rejects.toThrow("Rejected");
    expect(send).toHaveBeenCalledTimes(2);
    expect(confirmed).toHaveBeenCalledExactlyOnceWith(poolId, 1);
  });
  it("checks wallet/network context before every subsequent transaction", async () => {
    const send = vi.fn().mockResolvedValue(poolId);
    const assertCurrent = vi
      .fn()
      .mockImplementationOnce(() => {})
      .mockImplementationOnce(() => {
        throw new Error("Wallet changed");
      });
    await expect(
      executeBatchRewardClaims({ batches, send, onConfirmed: vi.fn(), assertCurrent })
    ).rejects.toThrow("Wallet changed");
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe("typed reward scopes", () => {
  it("claims gauge slot zero without unrelated failed global or allocator reads", () => {
    const [batch] = planBatchRewardClaims(
      [
        {
          ...row(),
          globalUnavailable: true,
          pools: [{ ...row().pools[0], allocatorUnavailable: true }],
        },
      ],
      receiver,
      diamond,
      { sources: ["gauge"] }
    );
    expect(batch.globalClaims).toEqual([]);
    expect(batch.allocatorClaims).toEqual([]);
    expect(batch.lpClaims[0].slots).toEqual([0]);
  });
  it("excludes hidden assets and pools and supports narrower checked position rows", () => {
    const [batch] = planBatchRewardClaims([row(1n), row(2n)], receiver, diamond, {
      sources: ["lp-bribe"],
      asset: address(3),
      selectedRows: [`2:${poolId}`],
    });
    expect(batch.lpClaims).toEqual([{ positionId: 2n, poolId, slots: [2], minimumAmounts: [0n] }]);
    expect(batch.globalClaims).toEqual([]);
    expect(batch.allocatorClaims).toEqual([]);
  });
  it("deduplicates the same selected parent/child reward group", () => {
    const [batch] = planBatchRewardClaims([row(), row()], receiver, diamond, {
      sources: ["gauge", "lp-bribe"],
      selectedRows: [`1:${poolId}`, `1:${poolId}`],
    });
    expect(batch.lpClaims).toHaveLength(1);
    expect(batch.lpClaims[0].slots).toEqual([0, 2]);
  });
});
