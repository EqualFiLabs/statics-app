import type { Address, PublicClient } from "viem";

import { staticsAbi } from "@statics-protocol/sdk";

const POSITION_PAGE_SIZE = 100n;

/**
 * Reads the Position owner index at one block so pagination cannot drift while
 * the wallet's positions are being assembled.
 */
export async function loadOwnedPositionIds(
  publicClient: PublicClient,
  diamond: Address,
  owner: Address,
  atBlock?: bigint
): Promise<bigint[]> {
  const blockNumber = atBlock ?? (await publicClient.getBlockNumber());
  const [erc721Balance, indexedCount] = await Promise.all([
    publicClient.readContract({
      address: diamond,
      abi: staticsAbi,
      functionName: "balanceOf",
      args: [owner],
      blockNumber,
    }),
    publicClient.readContract({
      address: diamond,
      abi: staticsAbi,
      functionName: "positionCount",
      args: [owner],
      blockNumber,
    }),
  ]);

  if (indexedCount !== erc721Balance) {
    throw new Error(
      `Position owner index is incomplete for this wallet (indexed ${indexedCount.toString()} of ${erc721Balance.toString()}).`
    );
  }
  if (indexedCount > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("The Position owner index is too large for this client.");
  }

  const positionIds: bigint[] = [];
  let cursor = 0n;
  while (cursor < indexedCount) {
    const [page, nextCursor] = await publicClient.readContract({
      address: diamond,
      abi: staticsAbi,
      functionName: "positionsOfOwner",
      args: [owner, cursor, POSITION_PAGE_SIZE],
      blockNumber,
    });
    if (
      nextCursor <= cursor ||
      nextCursor > indexedCount ||
      page.length > Number(POSITION_PAGE_SIZE)
    ) {
      throw new Error("The Position owner index returned an invalid page.");
    }
    positionIds.push(...page);
    cursor = nextCursor;
  }

  if (BigInt(positionIds.length) !== indexedCount) {
    throw new Error("The Position owner index returned an incomplete result.");
  }
  if (new Set(positionIds.map((positionId) => positionId.toString())).size !== positionIds.length) {
    throw new Error("The Position owner index returned duplicate Positions.");
  }
  return positionIds;
}
