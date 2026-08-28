import { describe, expect, it } from "vitest";
import { decodeFunctionData, getAddress } from "viem";
import {
  buildClaimAllGenesisLaunchRewardsCall,
  genesisLaunchDistributorAbi,
} from "@statics-protocol/sdk";

import {
  GENESIS_CLAIM_BATCH_SIZE,
  batchGenesisIds,
  claimableGenesisIds,
  summariseGenesisRewards,
  type OwnedGenesis,
  type OwnedGenesisPortfolio,
} from "@/lib/genesis/owned";

function item(id: bigint, pendingStatics = 0n, pendingWeth = 0n): OwnedGenesis {
  return {
    id,
    tier: 0,
    multiplierBps: 10_000,
    registered: true,
    rewardWeight: 10_000n,
    pendingStatics,
    pendingWeth,
    creditActive: false,
    creditPrincipal: 0n,
    creditMaturity: 0,
  };
}

function portfolio(
  items: readonly OwnedGenesis[],
  ownerStatics = 0n,
  ownerWeth = 0n
): OwnedGenesisPortfolio {
  return {
    items,
    tierCosts: [],
    rewardShareBps: 5_000,
    totalWeight: items.reduce((total, entry) => total + entry.rewardWeight, 0n),
    ownerStatics,
    ownerWeth,
    indexedBlock: 1n,
    chainHead: 1n,
    stale: false,
  };
}

describe("Genesis reward batching", () => {
  it("filters zero-reward NFTs and deduplicates IDs", () => {
    expect(
      claimableGenesisIds([item(4n), item(7n, 1n), item(7n, 2n, 3n), item(9n, 0n, 4n)])
    ).toEqual([7n, 9n]);
  });

  it("splits IDs at the 64-NFT transaction boundary", () => {
    const ids = Array.from({ length: GENESIS_CLAIM_BATCH_SIZE * 2 + 1 }, (_, index) =>
      BigInt(index + 1)
    );
    const batches = batchGenesisIds(ids);

    expect(batches.map((batch) => batch.length)).toEqual([64, 64, 1]);
    expect(batches.flat()).toEqual(ids);
  });

  it("counts batch transactions, including owner-only rewards", () => {
    const sixtyFour = Array.from({ length: 64 }, (_, index) => item(BigInt(index + 1), 1n));
    const sixtyFive = [...sixtyFour, item(65n, 1n)];

    expect(summariseGenesisRewards(portfolio(sixtyFour)).claimTransactionCount).toBe(1);
    expect(summariseGenesisRewards(portfolio(sixtyFive)).claimTransactionCount).toBe(2);
    expect(summariseGenesisRewards(portfolio([], 1n)).claimTransactionCount).toBe(1);
    expect(summariseGenesisRewards(portfolio([])).claimTransactionCount).toBe(0);
  });

  it("encodes the launch distributor batch entry point", () => {
    const receiver = getAddress("0x1111111111111111111111111111111111111111");
    expect(
      decodeFunctionData({
        abi: genesisLaunchDistributorAbi,
        data: buildClaimAllGenesisLaunchRewardsCall([41n, 42n], receiver),
      })
    ).toEqual({ functionName: "claimAllGenesisRewards", args: [[41n, 42n], receiver] });
  });
});
