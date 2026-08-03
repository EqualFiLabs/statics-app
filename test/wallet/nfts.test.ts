import { describe, expect, it } from "vitest";

import {
  collectWalletNfts,
  describeLiquidityNft,
  describePositionNft,
  validateRecipient,
} from "@/lib/wallet/nfts";
import type { LpPositionRecord } from "@/lib/liquidity/liquidity";
import type { PositionRecord } from "@/lib/positions/positions";

const wallet = "0x1111111111111111111111111111111111111111" as const;
const other = "0x2222222222222222222222222222222222222222" as const;
const diamond = "0x3333333333333333333333333333333333333333" as const;
const positionManager = "0x4444444444444444444444444444444444444444" as const;

function position(overrides: Partial<PositionRecord> = {}): PositionRecord {
  return {
    positionId: 7n,
    owner: wallet,
    stateNonce: 1n,
    activeLegCount: 0n,
    unresolvedObligationCount: 0n,
    closable: true,
    collateral: [],
    stakedBalance: 0n,
    unstakeAvailableAt: 0n,
    claimAssetCount: 0n,
    selectedRewardAssets: [],
    rewards: [],
    ...overrides,
  } as PositionRecord;
}

function lp(overrides: Partial<LpPositionRecord> = {}): LpPositionRecord {
  return {
    tokenId: 12n,
    owner: wallet,
    liquidity: 100n,
    claimable0: 0n,
    claimable1: 0n,
    staked: false,
    ...overrides,
  } as LpPositionRecord;
}

describe("position NFT description", () => {
  it("names everything that would leave with the position", () => {
    // The safety case: a position is a container, and transferring it hands
    // over its contents. Nothing else in the app says so at the point of
    // transfer.
    const nft = describePositionNft(
      position({
        activeLegCount: 3n,
        collateral: [{}, {}] as unknown as PositionRecord["collateral"],
        stakedBalance: 500n,
        rewards: [{ pending: 5n }] as unknown as PositionRecord["rewards"],
      }),
      diamond
    );

    expect(nft.carries).toEqual(["2 deposited baskets", "staked Statics", "1 unclaimed reward"]);
  });

  it("singularises so one basket does not read as a list", () => {
    const nft = describePositionNft(
      position({ collateral: [{}] as unknown as PositionRecord["collateral"] }),
      diamond
    );
    expect(nft.carries).toEqual(["1 deposited basket"]);
  });

  it("carries nothing when the position is empty, which is the safe case", () => {
    const nft = describePositionNft(position(), diamond);
    expect(nft.carries).toEqual([]);
    expect(nft.summary).toBe("Empty position");
    expect(nft.blockedReason).toBeNull();
  });

  it("warns when unresolved obligations transfer with a position", () => {
    const nft = describePositionNft(position({ unresolvedObligationCount: 2n }), diamond);
    expect(nft.carries).toContain("2 unresolved obligations");
    expect(nft.summary).toBe("2 unresolved obligations");
    expect(nft.blockedReason).toBeNull();
  });

  it("addresses the diamond, where the position ERC-721 lives", () => {
    expect(describePositionNft(position(), diamond).contract).toBe(diamond);
  });
});

describe("liquidity NFT description", () => {
  it("refuses to move a staked position, which the protocol custodies", () => {
    // A staked LP NFT is held by the protocol, so the wallet cannot move it.
    // Offering the action would produce a confusing revert.
    const nft = describeLiquidityNft(lp({ staked: true }), positionManager);
    expect(nft.blockedReason).toMatch(/Unstake it/);
  });

  it("warns when unclaimed fees would leave with it", () => {
    const nft = describeLiquidityNft(lp({ claimable0: 0n, claimable1: 9n }), positionManager);
    expect(nft.carries).toEqual(["unclaimed fees"]);
  });

  it("addresses the position manager rather than the diamond", () => {
    expect(describeLiquidityNft(lp(), positionManager).contract).toBe(positionManager);
  });
});

describe("collecting a wallet's NFTs", () => {
  const deployment = {
    contracts: { diamond },
    liquidity: { contracts: { positionManager } },
  } as never;

  it("includes both kinds", () => {
    const nfts = collectWalletNfts({
      positions: [position()],
      liquidityPositions: [lp()],
      deployment,
      wallet,
    });
    expect(nfts.map((nft) => nft.kind)).toEqual(["position", "liquidity"]);
  });

  it("omits tokens the wallet does not own", () => {
    // The catalogs can carry records for other owners; listing one as movable
    // would offer a transfer that cannot succeed.
    const nfts = collectWalletNfts({
      positions: [position({ owner: other })],
      liquidityPositions: [lp({ owner: other })],
      deployment,
      wallet,
    });
    expect(nfts).toEqual([]);
  });

  it("omits liquidity entirely when no liquidity deployment is configured", () => {
    const nfts = collectWalletNfts({
      positions: [position()],
      liquidityPositions: [lp()],
      deployment: { contracts: { diamond }, liquidity: null } as never,
      wallet,
    });
    expect(nfts.map((nft) => nft.kind)).toEqual(["position"]);
  });
});

describe("recipient validation", () => {
  it("rejects an empty, malformed, or self address before asking for a signature", () => {
    expect(validateRecipient("", wallet)).toMatch(/Enter the address/);
    expect(validateRecipient("nonsense", wallet)).toMatch(/not a valid address/);
    expect(validateRecipient(wallet, wallet)).toMatch(/your own address/);
  });

  it("accepts a different valid address, in any case", () => {
    expect(validateRecipient(other, wallet)).toBeNull();
    expect(validateRecipient(other.toUpperCase().replace("0X", "0x"), wallet)).toBeNull();
  });
});

describe("degrading when one source fails", () => {
  // Regression: the panel used Promise.all, so a liquidity read that reverted
  // discarded every position the wallet held. On a deployment whose canonical
  // pools are not initialised, loadLiquidityCatalog reverts with
  // CanonicalPoolNotConfigured, which is a legitimate state rather than a
  // fault -- and it was blanking four real positions.
  const deployment = {
    contracts: { diamond },
    liquidity: { contracts: { positionManager } },
  } as never;

  it("still lists positions when the liquidity read rejected", async () => {
    const [positions, liquidity] = await Promise.allSettled([
      Promise.resolve([position({ positionId: 1n }), position({ positionId: 2n })]),
      Promise.reject(new Error("CanonicalPoolNotConfigured")),
    ]);

    expect(positions.status).toBe("fulfilled");
    expect(liquidity.status).toBe("rejected");

    const nfts = collectWalletNfts({
      positions: positions.status === "fulfilled" ? positions.value : [],
      liquidityPositions: [],
      deployment,
      wallet,
    });

    expect(nfts.map((nft) => nft.name)).toEqual(["Position #1", "Position #2"]);
  });
});
