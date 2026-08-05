import type { Address, PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";

import { loadPositionPortfolio } from "@/lib/positions/portfolio";

const diamond = "0x0000000000000000000000000000000000000010" as Address;
const reward = "0x0000000000000000000000000000000000000020" as Address;

describe("position portfolio reads", () => {
  it("loads every collection at one pinned block", async () => {
    const readContract = vi.fn(async ({ functionName, blockNumber }) => {
      expect(blockNumber).toBe(50n);
      if (functionName === "positionPortfolioCounts") {
        return {
          basketCount: 1n,
          loanCount: 1n,
          liquidityPositionCount: 1n,
          globalRewardAssetCount: 1n,
          riskSeriesCount: 1n,
        };
      }
      if (functionName === "basketIdsOfPosition") return [[2n], 1n];
      if (functionName === "loanIdsOfPosition") return [[3n], 1n];
      if (functionName === "liquidityPositionIdsOfPosition") return [[4n], 1n];
      if (functionName === "globalRewardAssetsOfPosition") return [[reward], 1n];
      if (functionName === "riskSeriesIdsOfPosition") return [[5n], 1n];
      throw new Error(`Unexpected read ${functionName}`);
    });

    await expect(
      loadPositionPortfolio({ readContract } as unknown as PublicClient, diamond, 1n, 50n)
    ).resolves.toEqual({
      basketIds: [2n],
      loanIds: [3n],
      liquidityPositionIds: [4n],
      globalRewardAssets: [reward],
      riskSeriesIds: [5n],
    });
  });

  it("rejects stalled pagination instead of looping", async () => {
    const readContract = vi.fn(async ({ functionName }) => {
      if (functionName === "positionPortfolioCounts") {
        return {
          basketCount: 1n,
          loanCount: 0n,
          liquidityPositionCount: 0n,
          globalRewardAssetCount: 0n,
          riskSeriesCount: 0n,
        };
      }
      return [[], 0n];
    });

    await expect(
      loadPositionPortfolio({ readContract } as unknown as PublicClient, diamond, 1n, 50n)
    ).rejects.toThrow("invalid portfolio page");
  });
});
