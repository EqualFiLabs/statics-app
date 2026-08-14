/**
 * The NFTs a Statics wallet holds, and moving them.
 *
 * Two kinds exist and they are not interchangeable:
 *
 *   Position  -- the container everything else hangs off. Transferring one
 *                hands over its collateral, loans, staking, rewards and
 *                liquidity legs with it. This is the most consequential
 *                transfer in the app and the UI has to say so.
 *   Liquidity -- a Uniswap v4 LP NFT. Transferring one hands over that pool
 *                position and any fees it has accrued.
 *
 * The protocol registers transferFrom and both safeTransferFrom selectors on
 * the diamond (see StaticsSelectors), so a Position is a fully transferable
 * ERC-721 even though the vendored SDK ABI omits those entries. That is why
 * this module carries its own minimal ERC-721 ABI rather than waiting on the
 * SDK: the capability is on-chain today.
 */

import { getAddress, parseAbi, type Address, type Hex, type PublicClient } from "viem";

import type { DollarDeployment } from "@/lib/dollar/deployment";
import type { LpPositionRecord } from "@/lib/liquidity/liquidity";
import type { PositionRecord } from "@/lib/positions/positions";

/** Only what is needed to move a token and confirm it moved. */
export const erc721TransferAbi = parseAbi([
  "function safeTransferFrom(address from, address to, uint256 tokenId)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
]);

export type WalletNftKind = "position" | "liquidity" | "collection";

export type WalletNft = Readonly<{
  kind: WalletNftKind;
  tokenId: bigint;
  /** The ERC-721 the token lives on: the diamond, or the v4 position manager. */
  contract: Address;
  name: string;
  /** What the holder actually owns, in one line. */
  summary: string;
  /**
   * What leaves with it. Empty when the token carries nothing, which is the
   * only case where transferring is a low-stakes action.
   */
  carries: readonly string[];
  /** Set when the token cannot be moved, with the reason. */
  blockedReason: string | null;
}>;

function plural(count: number | bigint, one: string, many = `${one}s`): string {
  return `${count.toString()} ${count === 1 || count === 1n ? one : many}`;
}

/**
 * Describes a position for the wallet.
 *
 * `carries` is the safety-critical part: a position with legs attached takes
 * all of them to the new owner, and nothing else in the app makes that
 * consequence visible at the point of transfer.
 */
export function describePositionNft(position: PositionRecord, diamond: Address): WalletNft {
  const carries: string[] = [];
  if (position.collateral.length > 0) {
    carries.push(plural(position.collateral.length, "deposited basket"));
  }
  if (position.stakedBalance > 0n) carries.push("staked Statics");
  const claimable = position.rewards.filter((reward) => reward.pending > 0n).length;
  if (claimable > 0) carries.push(`${plural(claimable, "unclaimed reward")}`);
  if (position.unresolvedObligationCount > 0n) {
    carries.push(plural(position.unresolvedObligationCount, "unresolved obligation"));
  }

  return {
    kind: "position",
    tokenId: position.positionId,
    contract: diamond,
    name: `Position #${position.positionId.toString()}`,
    summary:
      position.activeLegCount > 0n
        ? `${plural(position.activeLegCount, "active leg")}`
        : position.unresolvedObligationCount > 0n
          ? `${plural(position.unresolvedObligationCount, "unresolved obligation")}`
          : "Empty position",
    carries,
    blockedReason:
      position.linkedGenesisId !== 0n
        ? `Unlink Genesis #${position.linkedGenesisId.toString()} before transferring this PositionNFT.`
        : null,
  };
}

export function describeLiquidityNft(
  position: LpPositionRecord,
  positionManager: Address
): WalletNft {
  const carries: string[] = [];
  if (position.claimable0 > 0n || position.claimable1 > 0n) carries.push("unclaimed fees");

  return {
    kind: "liquidity",
    tokenId: position.tokenId,
    contract: positionManager,
    name: `Liquidity position #${position.tokenId.toString()}`,
    summary: position.liquidity > 0n ? "Supplying liquidity" : "Empty position",
    carries,
    // Staked LP NFTs are custodied by the protocol, so the wallet does not hold
    // them and cannot move them until they are unstaked.
    blockedReason: position.staked
      ? "This is staked. Unstake it on the Liquidity page before moving it."
      : null,
  };
}

export function collectWalletNfts({
  positions,
  liquidityPositions,
  deployment,
  wallet,
}: Readonly<{
  positions: readonly PositionRecord[];
  liquidityPositions: readonly LpPositionRecord[];
  deployment: DollarDeployment;
  wallet: Address;
}>): readonly WalletNft[] {
  const owner = getAddress(wallet);
  const positionManager = deployment.liquidity?.contracts.positionManager ?? null;

  const owned = positions
    .filter((position) => getAddress(position.owner) === owner)
    .map((position) => describePositionNft(position, deployment.contracts.diamond));

  const lp = positionManager
    ? liquidityPositions
        .filter((position) => getAddress(position.owner) === owner)
        .map((position) => describeLiquidityNft(position, positionManager))
    : [];

  return [...owned, ...lp];
}

/**
 * Confirms the token actually moved, rather than trusting a successful
 * transaction. A transfer that silently did nothing would leave someone
 * believing they had handed over a position they still hold.
 */
export async function verifyNftTransfer(
  publicClient: PublicClient,
  nft: WalletNft,
  recipient: Address
): Promise<void> {
  const owner = await publicClient.readContract({
    address: nft.contract,
    abi: erc721TransferAbi,
    functionName: "ownerOf",
    args: [nft.tokenId],
  });

  if (getAddress(owner) !== getAddress(recipient)) {
    throw new Error(`${nft.name} is still held by ${owner} after the transfer.`);
  }
}

export function buildNftTransferCall(
  nft: WalletNft,
  from: Address,
  to: Address
): Readonly<{
  to: Address;
  abi: typeof erc721TransferAbi;
  args: readonly [Address, Address, bigint];
}> {
  return {
    to: nft.contract,
    abi: erc721TransferAbi,
    args: [getAddress(from), getAddress(to), nft.tokenId] as const,
  };
}

/** Rejects anything that is not a plausible recipient before a signature is asked for. */
export function validateRecipient(value: string, sender: Address): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Enter the address to send to.";
  let recipient: Address;
  try {
    recipient = getAddress(trimmed);
  } catch {
    return "That is not a valid address.";
  }
  if (recipient === getAddress(sender)) return "That is your own address.";
  return null;
}

export type NftTransferRequest = Readonly<{
  nft: WalletNft;
  from: Address;
  to: Address;
  data?: Hex;
}>;

/**
 * Turns an added collection's holdings into wallet entries.
 *
 * A collection that cannot enumerate yields one summary entry rather than
 * nothing, because the balance is real information even when the individual
 * token ids are not reachable. That entry cannot be transferred: without an id
 * there is nothing to send.
 */
export function describeCollectionNfts(
  holdings: import("@/lib/wallet/nft-contracts").NftCollectionHoldings
): readonly WalletNft[] {
  const { collection, balance, tokenIds, enumerable } = holdings;
  if (balance === 0n) return [];

  if (!enumerable || tokenIds.length === 0) {
    return [
      {
        kind: "collection",
        tokenId: 0n,
        contract: collection.address,
        name: collection.name,
        summary: `${balance.toString()} owned`,
        carries: [],
        blockedReason:
          "This collection cannot list which tokens you own, so they cannot be sent from here.",
      },
    ];
  }

  const shown = tokenIds.map((tokenId) => ({
    kind: "collection" as const,
    tokenId,
    contract: collection.address,
    name: `${collection.name} #${tokenId.toString()}`,
    summary:
      collection.standard === "erc1155"
        ? `${balance.toString()} held · ${collection.symbol}`
        : collection.symbol,
    carries: [] as readonly string[],
    // ERC-1155 transfer takes an amount as well as an id, which the send
    // dialog does not ask for. Offering it would build a call that cannot be
    // completed honestly.
    blockedReason:
      collection.standard === "erc1155"
        ? "Sending ERC-1155 balances is not supported here yet."
        : null,
  }));

  // Only meaningful for ERC-721, where balance counts distinct tokens and the
  // reader caps enumeration. For ERC-1155 the balance is the quantity of a
  // single id, so "4 more not shown" would be nonsense.
  if (collection.standard !== "erc1155" && BigInt(tokenIds.length) < balance) {
    return [
      ...shown,
      {
        kind: "collection",
        tokenId: 0n,
        contract: collection.address,
        name: collection.name,
        summary: `${(balance - BigInt(tokenIds.length)).toString()} more not shown`,
        carries: [],
        blockedReason: "Only the first 50 tokens in a collection are listed.",
      },
    ];
  }

  return shown;
}
