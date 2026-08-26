"use client";

import { getAddress, isAddress, parseAbi, type Address, type PublicClient } from "viem";
import type { StaticsDeployment } from "@/lib/deployments/types";

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

/**
 * ERC-1155 balances are per token id, and the standard offers no way to list
 * the ids an address holds -- not even the partial enumeration ERC-721 has. So
 * a 1155 has to be added with the id, and this reads only that.
 */
export const erc1155CollectionAbi = parseAbi([
  "function balanceOf(address account, uint256 id) view returns (uint256)",
  "function uri(uint256 id) view returns (string)",
  "function supportsInterface(bytes4 interfaceId) view returns (bool)",
]);

/** ERC-165 identifiers. Enumerable is optional and most collections omit it. */
const ERC721_INTERFACE_ID = "0x80ac58cd";
const ERC721_ENUMERABLE_INTERFACE_ID = "0x780e9d63";
const ERC1155_INTERFACE_ID = "0xd9b67a26";

export type NftStandard = "erc721" | "erc1155";

export type NftCollection = Readonly<{
  address: Address;
  name: string;
  symbol: string;
  standard: NftStandard;
  /**
   * Required for ERC-1155 and absent for ERC-721. A 1155 balance is meaningless
   * without an id, and no call exists to discover which ids an address holds.
   */
  tokenId?: string;
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
const MAX_UINT256 = (1n << 256n) - 1n;

function isUint256TokenId(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return false;
  try {
    return BigInt(value) <= MAX_UINT256;
  } catch {
    return false;
  }
}

function parseStoredCollection(entry: unknown): NftCollection | null {
  if (typeof entry !== "object" || entry === null) return null;
  const candidate = entry as Record<string, unknown>;
  if (
    typeof candidate.address !== "string" ||
    !isAddress(candidate.address) ||
    typeof candidate.name !== "string" ||
    candidate.name.trim().length === 0 ||
    typeof candidate.symbol !== "string" ||
    candidate.symbol.trim().length === 0
  ) {
    return null;
  }

  const base = {
    address: getAddress(candidate.address),
    name: candidate.name,
    symbol: candidate.symbol,
  } as const;
  if (candidate.standard === "erc721") return { ...base, standard: "erc721" };
  if (candidate.standard === "erc1155" && isUint256TokenId(candidate.tokenId)) {
    return { ...base, standard: "erc1155", tokenId: candidate.tokenId };
  }
  return null;
}

export function nftCollectionStorageKey(chainId: number, deploymentId = "shared") {
  return `statics:wallet:nfts:${chainId}:${deploymentId}`;
}

function defaultNftCollections(
  chainId: number,
  deployment?: StaticsDeployment | null
): NftCollection[] {
  if (!deployment || deployment.descriptor.chainId !== chainId) return [];
  const address =
    deployment.kind === "launch"
      ? deployment.contracts.genesis
      : deployment.protocol.genesis?.collection;
  return address
    ? [{ address, name: "Statics Operators", symbol: "GENESIS", standard: "erc721" }]
    : [];
}

export function loadNftCollections(
  chainId: number,
  deployment?: StaticsDeployment | null
): NftCollection[] {
  const defaults = defaultNftCollections(chainId, deployment);
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(
      nftCollectionStorageKey(chainId, deployment?.descriptor.deploymentId)
    );
    if (!raw) return defaults;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const stored = parsed.flatMap((entry) => {
      const collection = parseStoredCollection(entry);
      return collection ? [collection] : [];
    });
    return [...defaults, ...stored].filter(
      (collection, index, collections) =>
        collections.findIndex(
          (candidate) =>
            candidate.address.toLowerCase() === collection.address.toLowerCase() &&
            candidate.standard === collection.standard &&
            candidate.tokenId === collection.tokenId
        ) === index
    );
  } catch {
    return defaults;
  }
}

export function saveNftCollections(
  chainId: number,
  collections: readonly NftCollection[],
  deploymentId = "shared"
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    nftCollectionStorageKey(chainId, deploymentId),
    JSON.stringify(collections)
  );
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
  address: string,
  tokenId?: string
): Promise<NftCollection> {
  if (!isAddress(address)) throw new Error("That is not a valid contract address.");
  const contract = getAddress(address);

  const code = await publicClient.getCode({ address: contract });
  if (!code || code === "0x") throw new Error("No contract is deployed at that address.");

  const supports = async (interfaceId: `0x${string}`) =>
    publicClient
      .readContract({
        address: contract,
        abi: erc721CollectionAbi,
        functionName: "supportsInterface",
        args: [interfaceId],
      })
      .catch(() => false);

  const [isErc721, isErc1155] = await Promise.all([
    supports(ERC721_INTERFACE_ID),
    supports(ERC1155_INTERFACE_ID),
  ]);

  if (!isErc721 && !isErc1155) {
    throw new Error("That contract is not an ERC-721 or ERC-1155 collection.");
  }

  if (isErc1155 && !isErc721) {
    // Without an id there is nothing to read: balanceOf takes one, and the
    // standard cannot tell us which ids an address holds.
    if (!isUint256TokenId(tokenId?.trim())) {
      throw new Error("This is an ERC-1155. Enter the token id you hold as well.");
    }
    const [name, symbol] = await Promise.all([
      publicClient
        .readContract({ address: contract, abi: erc721CollectionAbi, functionName: "name" })
        .catch(() => "Unnamed collection"),
      publicClient
        .readContract({ address: contract, abi: erc721CollectionAbi, functionName: "symbol" })
        .catch(() => "NFT"),
    ]);
    return { address: contract, name, symbol, standard: "erc1155", tokenId: tokenId.trim() };
  }

  const [name, symbol] = await Promise.all([
    publicClient
      .readContract({ address: contract, abi: erc721CollectionAbi, functionName: "name" })
      .catch(() => "Unnamed collection"),
    publicClient
      .readContract({ address: contract, abi: erc721CollectionAbi, functionName: "symbol" })
      .catch(() => "NFT"),
  ]);

  return { address: contract, name, symbol, standard: "erc721" };
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
  if (collection.standard === "erc1155") {
    const id = BigInt(collection.tokenId ?? "0");
    const balance = await publicClient.readContract({
      address: collection.address,
      abi: erc1155CollectionAbi,
      functionName: "balanceOf",
      args: [owner, id],
    });
    // The id is known because it was supplied, so this enumerates exactly one.
    return { collection, balance, tokenIds: balance > 0n ? [id] : [], enumerable: true };
  }

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
