import type { Address, PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";

import {
  canClosePosition,
  claimablePositionRewards,
  describePositionError,
  isUnstakeAvailable,
  unlockedCollateral,
  validateCustomRewardAsset,
  type PositionCollateral,
} from "@/lib/positions/positions";

const rewardAsset = "0x0000000000000000000000000000000000000011" as Address;

function metadataClient(
  overrides: {
    code?: `0x${string}` | undefined;
    name?: string | null;
    symbol?: string | null;
    decimals?: number | null;
  } = {}
): PublicClient {
  const values = {
    code: "0x6000" as const,
    name: "Reward Token",
    symbol: "RWD",
    decimals: 18,
    ...overrides,
  };
  return {
    getCode: vi.fn().mockResolvedValue(values.code),
    readContract: vi.fn().mockImplementation(({ functionName }: { functionName: string }) => {
      if (functionName === "name") return Promise.resolve(values.name);
      if (functionName === "symbol") return Promise.resolve(values.symbol);
      if (functionName === "decimals") return Promise.resolve(values.decimals);
      throw new Error(`Unexpected read: ${functionName}`);
    }),
  } as unknown as PublicClient;
}

describe("position action guards", () => {
  it("defaults claims to every nonzero reward and honors a selected subset", () => {
    const second = "0x0000000000000000000000000000000000000022" as Address;
    const rewards = [
      {
        token: {
          address: rewardAsset,
          name: "Reward",
          symbol: "RWD",
          decimals: 18,
          metadataAvailable: true,
        },
        pending: 5n,
      },
      {
        token: {
          address: second,
          name: "Second",
          symbol: "TWO",
          decimals: 6,
          metadataAvailable: true,
        },
        pending: 7n,
      },
      {
        token: {
          address: "0x0000000000000000000000000000000000000033" as Address,
          name: "Empty",
          symbol: "ZERO",
          decimals: 18,
          metadataAvailable: true,
        },
        pending: 0n,
      },
    ];
    expect(claimablePositionRewards(rewards).map((reward) => reward.token.address)).toEqual([
      rewardAsset,
      second,
    ]);
    expect(claimablePositionRewards(rewards, [second])).toEqual([rewards[1]]);
  });

  it("computes unlocked collateral and blocks close while any leg is active", () => {
    const collateral = {
      depositedShares: 15n,
      lockedShares: 4n,
    } as PositionCollateral;
    expect(unlockedCollateral(collateral)).toBe(11n);
    expect(canClosePosition({ activeLegCount: 0n, initializing: false })).toBe(true);
    expect(canClosePosition({ activeLegCount: 1n, initializing: false })).toBe(false);
    expect(canClosePosition({ activeLegCount: 0n, initializing: true })).toBe(false);
  });

  it("uses authoritative chain time for the unstaking threshold", () => {
    expect(isUnstakeAvailable({ unstakeAvailableAt: 1_000n }, 999n)).toBe(false);
    expect(isUnstakeAvailable({ unstakeAvailableAt: 1_000n }, 1_000n)).toBe(true);
  });

  it("keeps protocol error names in actionable messages", () => {
    expect(describePositionError(new Error("execution reverted: PositionHasActiveLegs"))).toBe(
      "Remove every active position leg before closing this PositionNFT. (PositionHasActiveLegs)"
    );
    expect(describePositionError(new Error("User denied transaction signature"))).toBe(
      "The wallet request was rejected."
    );
  });
});

describe("custom reward asset validation", () => {
  it("requires a valid, deployed, metadata-readable ERC-20", async () => {
    await expect(
      validateCustomRewardAsset(metadataClient(), "not-an-address", [], 64n)
    ).rejects.toThrow("valid EVM");
    await expect(
      validateCustomRewardAsset(metadataClient({ code: "0x" }), rewardAsset, [], 64n)
    ).rejects.toThrow("no contract code");
    await expect(
      validateCustomRewardAsset(metadataClient({ symbol: null }), rewardAsset, [], 64n)
    ).rejects.toThrow("readable ERC-20 metadata");
  });

  it("rejects duplicate and over-limit selections before reading token metadata", async () => {
    const client = metadataClient();
    await expect(
      validateCustomRewardAsset(client, rewardAsset, [rewardAsset], 64n)
    ).rejects.toThrow("already selected");
    await expect(
      validateCustomRewardAsset(
        client,
        rewardAsset,
        Array.from({ length: 64 }, () => "0x0000000000000000000000000000000000000022" as Address),
        64n
      )
    ).rejects.toThrow("64 asset maximum");
    expect(client.getCode).not.toHaveBeenCalled();
  });

  it("returns canonical metadata for a valid custom reward contract", async () => {
    await expect(
      validateCustomRewardAsset(metadataClient(), rewardAsset, [], 64n)
    ).resolves.toEqual({
      address: rewardAsset,
      name: "Reward Token",
      symbol: "RWD",
      decimals: 18,
      metadataAvailable: true,
    });
  });
});
