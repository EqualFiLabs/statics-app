import { beforeEach, describe, expect, it } from "vitest";

import { describeCollectionNfts } from "@/lib/wallet/nfts";
import { loadNftCollections, nftCollectionStorageKey } from "@/lib/wallet/nft-contracts";
import type { NftCollectionHoldings } from "@/lib/wallet/nft-contracts";

const address = "0x5555555555555555555555555555555555555555" as const;

function holdings(overrides: Partial<NftCollectionHoldings> = {}): NftCollectionHoldings {
  return {
    collection: { address, name: "Test Collection", symbol: "TEST", standard: "erc721" },
    balance: 2n,
    tokenIds: [1n, 2n],
    enumerable: true,
    ...overrides,
  };
}

describe("added collections", () => {
  beforeEach(() => window.localStorage.clear());

  it("loads only complete collections stored for the selected chain", () => {
    window.localStorage.setItem(
      nftCollectionStorageKey(8_453),
      JSON.stringify([
        { address, name: "Test Collection", symbol: "TEST", standard: "erc721" },
        { address, name: "Editions", symbol: "ED", standard: "erc1155", tokenId: "7" },
        { address, name: "Missing standard", symbol: "BAD" },
        { address, name: "Missing token id", symbol: "BAD", standard: "erc1155" },
      ])
    );
    window.localStorage.setItem(
      nftCollectionStorageKey(42_161),
      JSON.stringify([
        { address, name: "Other chain", symbol: "OTHER", standard: "erc721" },
      ])
    );

    expect(loadNftCollections(8_453)).toEqual([
      { address, name: "Test Collection", symbol: "TEST", standard: "erc721" },
      { address, name: "Editions", symbol: "ED", standard: "erc1155", tokenId: "7" },
    ]);
  });

  it("rejects stored ERC-1155 token ids outside uint256", () => {
    window.localStorage.setItem(
      nftCollectionStorageKey(8_453),
      JSON.stringify([
        {
          address,
          name: "Editions",
          symbol: "ED",
          standard: "erc1155",
          tokenId: (1n << 256n).toString(),
        },
      ])
    );

    expect(loadNftCollections(8_453)).toEqual([]);
  });

  it("lists one entry per token when the contract can enumerate", () => {
    const nfts = describeCollectionNfts(holdings());
    expect(nfts.map((nft) => nft.name)).toEqual(["Test Collection #1", "Test Collection #2"]);
    expect(nfts.every((nft) => nft.blockedReason === null)).toBe(true);
  });

  it("still lists a collection that cannot enumerate, with its balance", () => {
    // Knowing you hold three of something beats the app implying you hold none.
    const nfts = describeCollectionNfts(holdings({ enumerable: false, balance: 3n, tokenIds: [] }));
    expect(nfts).toHaveLength(1);
    expect(nfts[0].summary).toBe("3 owned");
    expect(nfts[0].blockedReason).toMatch(/cannot list which tokens/);
  });

  it("says when more are held than are shown, rather than implying the list is complete", () => {
    const nfts = describeCollectionNfts(holdings({ balance: 60n, tokenIds: [1n, 2n] }));
    expect(nfts).toHaveLength(3);
    expect(nfts.at(-1)!.summary).toBe("58 more not shown");
  });

  it("shows nothing for a collection the wallet has none of", () => {
    expect(describeCollectionNfts(holdings({ balance: 0n, tokenIds: [] }))).toEqual([]);
  });

  it("reports an ERC-1155 balance and refuses to send it", () => {
    // 1155 transfer takes an amount as well as an id, which the send dialog
    // does not ask for, so offering it would build a call it cannot complete.
    const nfts = describeCollectionNfts(
      holdings({
        collection: {
          address,
          name: "Editions",
          symbol: "ED",
          standard: "erc1155",
          tokenId: "7",
        },
        balance: 5n,
        tokenIds: [7n],
      })
    );

    expect(nfts).toHaveLength(1);
    expect(nfts[0].name).toBe("Editions #7");
    expect(nfts[0].summary).toBe("5 held · ED");
    expect(nfts[0].blockedReason).toMatch(/not supported here yet/);
  });
});
