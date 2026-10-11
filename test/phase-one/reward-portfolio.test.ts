import { describe, expect, it, vi } from "vitest";
import { getAddress, zeroAddress, type PublicClient } from "viem";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import {
  discoverPositionRewardPools,
  loadPositionRewardPortfolio,
  mapRewardReads,
  totalPortfolioRewards,
  type PoolRewards,
} from "@/lib/phase-one/reward-portfolio";

const address = getAddress(`0x${"1".repeat(40)}`);
const pool = (digit: string) => `0x${digit.repeat(64)}` as const;
const deployment = { contracts: { diamond: address } } as PhaseOneDeployment;
const rewards: PoolRewards = {
  lp: {
    slotCount: 2,
    assets: [address, address, zeroAddress, zeroAddress, zeroAddress],
    amounts: [10n, 20n, 0n, 0n, 0n],
  },
  allocator: [{ slot: 1, asset: address, allocation: 30n, amount: 40n }],
};

describe("wallet-wide reward discovery", () => {
  it("paginates retained LP and allocator portfolios without scanning configured pools", async () => {
    const read = vi.fn(async ({ functionName, args }) => {
      if (functionName === "positionGaugePools")
        return args[1] === 0n ? [Array(100).fill(pool("1")), 100n] : [[pool("2")], 101n];
      if (functionName === "positionGaugeAllocatorPools") return [[pool("3")], 1n];
      throw Error("Unnecessary RPC");
    });
    const result = await discoverPositionRewardPools({
      publicClient: { readContract: read } as unknown as PublicClient,
      deployment,
      positionId: 30n,
      account: address,
    });
    expect(result).toEqual({ lp: [pool("1"), pool("2")], allocator: [pool("3")] });
    expect(read).toHaveBeenCalledTimes(3);
    expect(read.mock.calls.find(([input]) => input.args[1] === 100n)).toBeDefined();
  });
  it("rejects stalled cursors instead of dropping later rewards", async () => {
    const read = vi.fn(async () => [Array(100).fill(pool("1")), 0n]);
    await expect(
      discoverPositionRewardPools({
        publicClient: { readContract: read } as unknown as PublicClient,
        deployment,
        positionId: 30n,
        account: address,
      })
    ).rejects.toThrow("stalled cursor");
  });
  it("keeps LP, bribe, allocator and global totals separate even for the same asset", async () => {
    const load = vi.fn().mockResolvedValue(rewards);
    const position = await loadPositionRewardPortfolio({
      positionId: 30n,
      global: async () => ({ claimAssets: [address], pendingRewards: [5n] }),
      discovery: async () => ({ lp: [pool("1")], allocator: [pool("1"), pool("2")] }),
      pool: load,
    });
    expect(load.mock.calls).toEqual([
      [pool("1"), true],
      [pool("2"), false],
    ]);
    expect(totalPortfolioRewards([position], "global")).toEqual([{ asset: address, amount: 5n }]);
    expect(totalPortfolioRewards([position], "gauge")).toEqual([{ asset: address, amount: 10n }]);
    expect(totalPortfolioRewards([position], "lp-bribe")).toEqual([
      { asset: address, amount: 20n },
    ]);
    expect(totalPortfolioRewards([position], "allocator")).toEqual([
      { asset: address, amount: 80n },
    ]);
  });
  it("retains successful positions and pools when another reward read fails", async () => {
    const position = await loadPositionRewardPortfolio({
      positionId: 31n,
      global: async () => {
        throw Error("offline");
      },
      discovery: async () => ({ lp: [pool("1"), pool("2")], allocator: [] }),
      pool: async (id) => {
        if (id === pool("2")) throw Error("offline");
        return rewards;
      },
    });
    expect(position.globalUnavailable).toBe(true);
    expect(position.discoveryUnavailable).toBe(false);
    expect(position.pools[1].rewards).toBeNull();
    expect(totalPortfolioRewards([position], "gauge")).toEqual([{ asset: address, amount: 10n }]);
  });
  it("keeps staking rewards visible when pool discovery fails", async () => {
    const position = await loadPositionRewardPortfolio({
      positionId: 32n,
      global: async () => ({ claimAssets: [address], pendingRewards: [7n] }),
      discovery: async () => {
        throw Error("offline");
      },
      pool: vi.fn(),
    });
    expect(position.discoveryUnavailable).toBe(true);
    expect(totalPortfolioRewards([position], "global")).toEqual([{ asset: address, amount: 7n }]);
  });
  it("bounds parallel work and preserves position order", async () => {
    let active = 0,
      maximum = 0;
    const result = await mapRewardReads(
      Array.from({ length: 21 }, (_, i) => i),
      async (id) => {
        active++;
        maximum = Math.max(maximum, active);
        await Promise.resolve();
        active--;
        return id;
      }
    );
    expect(result).toEqual(Array.from({ length: 21 }, (_, i) => i));
    expect(maximum).toBe(4);
  });
});
