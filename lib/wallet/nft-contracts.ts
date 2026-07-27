"use client";

import { getAddress, isAddress, parseAbi, type Address, type PublicClient } from "viem";

/**
 * ERC-721 collections a person has added by address.
 *
 * There is no way to ask a plain RPC "what NFTs does this wallet hold" -- no
 * such call exists, and enumerating it would mean scanning every Transfer log
 * on the chain. Indexers solve that; adding a contract by address solves it
 * without one, and mirrors how ERC-20s are already added to this wallet.
 *
 * Two levels of answer are possible per collection, and the difference is
 * visible to the user rather than hidden:
 *
 *   - every contract can report how many you own, through balanceOf
 *   - only contracts implementing ERC721Enumerable can say *which*, through
 *     tokenOfOwnerByIndex
 *
 * A collection that cannot enumerate still earns its place: knowing you hold
 * three of something is worth more than the app pretending it holds nothing.
 */

export const erc721CollectionAbi = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function supportsInterface(bytes4 interfaceId) view returns (bool)",
]);

/** ERC-165 identifiers. Enumerable is optional and most collections omit it. */
const ERC721_INTERFACE_ID = "0x80ac58cd";
const ERC721_ENUMERABLE_INTERFACE_ID = "0x780e9d63";

export type NftCollection = Readonly<{
  address: Address;
  name: string;
  symbol: string;
}>;

export type NftCollectionHoldings = Readonly<{
  collection: NftCollection;
  balance: bigint;
  /** Token ids owned, when the contract can enumerate them. */
  tokenIds: readonly bigint[];
  /** True when balance is known but the individual tokens are not. */
  enumerable: boolean;
}>;

const storageEvent = "statics-wallet-nfts-changed";

export function nftCollectionStorageKey(chainId: number) {
  return `statics:wallet:nfts:${chainId}`;
}

export function loadNftCollections(chainId: number): NftCollection[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(nftCollectionStorageKey(chainId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is NftCollection =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as NftCollection).address === "string" &&
        isAddress((entry as NftCollection).address)
    );
  } catch {
    return [];
  }
}

export function saveNftCollections(chainId: number, collections: readonly NftCollection[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(nftCollectionStorageKey(chainId), JSON.stringify(collections));
  window.dispatchEvent(new Event(storageEvent));
}

export function subscribeNftCollections(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(storageEvent, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(storageEvent, listener);
    window.removeEventListener("storage", listener);
  };
}

/**
 * Confirms an address is actually an ERC-721 before it is added.
 *
 * Adding an ERC-20 here would otherwise produce a collection that reports a
 * balance in wei and offers to transfer token id 1000000000000000000.
 */
export async function readNftCollection(
  publicClient: PublicClient,
  address: string
): Promise<NftCollection> {
  if (!isAddress(address)) throw new Error("That is not a valid contract address.");
  const contract = getAddress(address);

  const code = await publicClient.getCode({ address: contract });
  if (!code || code === "0x") throw new Error("No contract is deployed at that address.");

  let isErc721 = false;
  try {
    isErc721 = await publicClient.readContract({
      address: contract,
      abi: erc721CollectionAbi,
      functionName: "supportsInterface",
      args: [ERC721_INTERFACE_ID],
    });
  } catch {
    throw new Error("That contract does not answer as an NFT collection.");
  }
  if (!isErc721) throw new Error("That contract is not an ERC-721 collection.");

  const [name, symbol] = await Promise.all([
    publicClient
      .readContract({ address: contract, abi: erc721CollectionAbi, functionName: "name" })
      .catch(() => "Unnamed collection"),
    publicClient
      .readContract({ address: contract, abi: erc721CollectionAbi, functionName: "symbol" })
      .catch(() => "NFT"),
  ]);

  return { address: contract, name, symbol };
}

/**
 * Reads what a wallet holds in one collection.
 *
 * Enumeration is attempted only when the contract advertises support, and a
 * failure part-way through returns the ids gathered so far rather than losing
 * the balance too.
 */
export async function readCollectionHoldings(
  publicClient: PublicClient,
  collection: NftCollection,
  owner: Address
): Promise<NftCollectionHoldings> {
  const balance = await publicClient.readContract({
    address: collection.address,
    abi: erc721CollectionAbi,
    functionName: "balanceOf",
    args: [owner],
  });

  if (balance === 0n) {
    return { collection, balance, tokenIds: [], enumerable: true };
  }

  const enumerable = await publicClient
    .readContract({
      address: collection.address,
      abi: erc721CollectionAbi,
      functionName: "supportsInterface",
      args: [ERC721_ENUMERABLE_INTERFACE_ID],
    })
    .catch(() => false);

  if (!enumerable) return { collection, balance, tokenIds: [], enumerable: false };

  // Capped: a wallet holding thousands of one collection should not issue
  // thousands of sequential reads to render a list nobody will scroll.
  const limit = balance > 50n ? 50n : balance;
  const tokenIds: bigint[] = [];
  for (let index = 0n; index < limit; index += 1n) {
    try {
      tokenIds.push(
        await publicClient.readContract({
          address: collection.address,
          abi: erc721CollectionAbi,
          functionName: "tokenOfOwnerByIndex",
          args: [owner, index],
        })
      );
    } catch {
      break;
    }
  }

  return { collection, balance, tokenIds, enumerable: true };
}
