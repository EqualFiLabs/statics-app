import fs from "node:fs";
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
const diamond = "0x0000000000000000000000000000000000000010" as Address;
const dollar = "0x0000000000000000000000000000000000000011" as Address;
const weth = "0x0000000000000000000000000000000000000012" as Address;
const maximumPositionId = (1n << 256n) - 1n;

describe("PositionNFT catalog discovery", () => {
  it("does not reconstruct current ownership from Transfer history", () => {
    const catalogReader = fs.readFileSync("lib/positions/positions.ts", "utf8");
    expect(catalogReader).not.toContain('eventName: "Transfer"');
  });

  it("loads Positions from the current owner index", async () => {
    const publicClient = {
      getContractEvents: vi.fn(),
      getBlockNumber: vi.fn().mockResolvedValue(50n),
      getBlock: vi.fn().mockResolvedValue({ number: 50n, timestamp: 1_000n }),
      readContract: vi.fn().mockImplementation(({ functionName, args }) => {
        if (functionName === "balanceOf" || functionName === "positionCount") {
          return Promise.resolve(2n);
        }
        if (functionName === "positionsOfOwner") {
          return Promise.resolve([[1n, maximumPositionId], 2n]);
        }
        if (functionName === "positionState") {
          return Promise.resolve({
            exists: true,
            stateNonce: 3n,
            activeLegCount: 0n,
            unresolvedObligationCount: 0n,
          });
        }
        if (functionName === "isPositionClosable") return Promise.resolve(true);
        if (functionName === "stakePosition") {
          return Promise.resolve({
            stakedBalance: 0n,
            claimAssetCount: 0n,
            optedInAssetCount: 0n,
          });
        }
        if (functionName === "positionRewardAssets") return Promise.resolve([]);
        if (functionName === "positionPortfolioCounts") {
          return Promise.resolve({
            basketCount: 0n,
            loanCount: 0n,
            liquidityPositionCount: 0n,
            globalRewardAssetCount: args?.[0] === 1n ? 1n : 0n,
            riskSeriesCount: 0n,
          });
        }
        if (functionName === "globalRewardAssetsOfPosition") {
          return Promise.resolve([[dollar], 1n]);
        }
        if (functionName === "pendingRewards") return Promise.resolve([5n]);
        if (functionName === "stakingToken") return Promise.resolve(weth);
        if (functionName === "totalStaked") return Promise.resolve(0n);
        if (functionName === "maxRewardAssetsPerPosition") return Promise.resolve(64n);
        if (functionName === "positionCreationFee") return Promise.resolve(123n);
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

    expect(catalog.positions.map((position) => position.positionId)).toEqual([
      maximumPositionId,
      1n,
    ]);
    expect(catalog.currentBlock).toBe(50n);
    expect(catalog.currentTimestamp).toBe(1_000n);
    expect(catalog.maximumRewardAssets).toBe(64n);
    expect(catalog.positionCreationFee).toBe(123n);
    const firstPosition = catalog.positions.find((position) => position.positionId === 1n);
    expect(firstPosition?.selectedRewardAssets).toEqual([]);
    expect(firstPosition?.stateNonce).toBe(3n);
    expect(firstPosition?.closable).toBe(true);
    expect(firstPosition?.rewards).toEqual([
      expect.objectContaining({
        pending: 5n,
        token: expect.objectContaining({ address: dollar }),
      }),
    ]);
    expect(publicClient.getContractEvents).not.toHaveBeenCalled();
  });
});
