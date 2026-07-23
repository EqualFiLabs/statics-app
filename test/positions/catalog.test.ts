import type { Address, PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";

import type { DollarDeployment } from "@/lib/dollar/deployment";

vi.mock("@/lib/baskets/baskets", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/baskets/baskets")>();
  return {
    ...actual,
    loadBasketCatalog: vi.fn().mockResolvedValue({ baskets: [] }),
    loadTokenMetadata: vi.fn().mockImplementation((_client, address: Address) =>
      Promise.resolve({
        address,
        name: "Wrapped Ether",
        symbol: "WETH",
        decimals: 18,
        metadataAvailable: true,
      })
    ),
  };
});

import { loadPositionCatalog } from "@/lib/positions/positions";

const wallet = "0x0000000000000000000000000000000000000001" as Address;
const otherWallet = "0x0000000000000000000000000000000000000002" as Address;
const diamond = "0x0000000000000000000000000000000000000010" as Address;
const dollar = "0x0000000000000000000000000000000000000011" as Address;
const weth = "0x0000000000000000000000000000000000000012" as Address;

describe("PositionNFT catalog discovery", () => {
  it("reconciles inbound transfer events against current owner state", async () => {
    const publicClient = {
      getContractEvents: vi
        .fn()
        .mockImplementation(({ eventName }: { eventName: string }) =>
          Promise.resolve(
            eventName === "Transfer"
              ? [1n, 2n, 3n].map((tokenId) => ({ args: { tokenId } }))
              : eventName === "RewardAssetOptedIn"
                ? [{ args: { positionId: 1n, asset: dollar } }]
                : []
          )
        ),
      getBlock: vi.fn().mockResolvedValue({ number: 50n, timestamp: 1_000n }),
      readContract: vi.fn().mockImplementation(({ functionName, args }) => {
        if (functionName === "ownerOf") {
          if (args[0] === 1n) return Promise.resolve(wallet);
          if (args[0] === 2n) return Promise.resolve(otherWallet);
          return Promise.reject(new Error("burned"));
        }
        if (functionName === "activeLegCount") return Promise.resolve(0n);
        if (functionName === "positionInitializing") return Promise.resolve(false);
        if (functionName === "stakePosition") {
          return Promise.resolve({
            stakedBalance: 0n,
            unstakeAvailableAt: 0n,
            claimAssetCount: 0n,
            optedInAssetCount: 0n,
          });
        }
        if (functionName === "positionRewardAssets") return Promise.resolve([]);
        if (functionName === "pendingRewards") return Promise.resolve([5n]);
        if (functionName === "stakingToken") return Promise.resolve(weth);
        if (functionName === "totalStaked") return Promise.resolve(0n);
        if (functionName === "maxRewardAssetsPerPosition") return Promise.resolve(64n);
        if (functionName === "balanceOf" || functionName === "allowance") {
          return Promise.resolve(0n);
        }
        throw new Error(`Unexpected read: ${functionName}`);
      }),
    } as unknown as PublicClient;
    const deployment = {
      chainId: 31_337,
      deploymentStartBlock: 1n,
      protocolCommit: "f82f3a7e4ba4c9bfbf749c3208f68bb18fd4afa1",
      contracts: { diamond, dollar, weth },
    } as DollarDeployment;

    const catalog = await loadPositionCatalog(publicClient, deployment, wallet);

    expect(catalog.positions.map((position) => position.positionId)).toEqual([1n]);
    expect(catalog.currentBlock).toBe(50n);
    expect(catalog.currentTimestamp).toBe(1_000n);
    expect(catalog.maximumRewardAssets).toBe(64n);
    expect(catalog.positions[0]?.selectedRewardAssets).toEqual([]);
    expect(catalog.positions[0]?.rewards).toEqual([
      expect.objectContaining({
        pending: 5n,
        token: expect.objectContaining({ address: dollar }),
      }),
    ]);
  });
});
