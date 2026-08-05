import type { Address, PublicClient } from "viem";

import { POSITION_PORTFOLIO_MAX_PAGE_SIZE, staticsAbi } from "@statics-protocol/sdk";

export type PositionPortfolio = Readonly<{
  basketIds: readonly bigint[];
  loanIds: readonly bigint[];
  liquidityPositionIds: readonly bigint[];
  globalRewardAssets: readonly Address[];
  riskSeriesIds: readonly bigint[];
}>;

type PortfolioPageFunction =
  | "basketIdsOfPosition"
  | "loanIdsOfPosition"
  | "liquidityPositionIdsOfPosition"
  | "riskSeriesIdsOfPosition";

async function loadUintPages(
  publicClient: PublicClient,
  diamond: Address,
  functionName: PortfolioPageFunction,
  positionId: bigint,
  expectedCount: bigint,
  blockNumber: bigint
): Promise<bigint[]> {
  if (expectedCount > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`Position #${positionId.toString()} has too many portfolio records.`);
  }
  const values: bigint[] = [];
  let cursor = 0n;
  while (cursor < expectedCount) {
    const [page, nextCursor] = await publicClient.readContract({
      address: diamond,
      abi: staticsAbi,
      functionName,
      args: [positionId, cursor, POSITION_PORTFOLIO_MAX_PAGE_SIZE],
      blockNumber,
    });
    if (
      nextCursor <= cursor ||
      nextCursor > expectedCount ||
      page.length > Number(POSITION_PORTFOLIO_MAX_PAGE_SIZE)
    ) {
      throw new Error(`Position #${positionId.toString()} returned an invalid portfolio page.`);
    }
    values.push(...page);
    cursor = nextCursor;
  }
  validateComplete(values, expectedCount, positionId);
  return values;
}

async function loadAddressPages(
  publicClient: PublicClient,
  diamond: Address,
  positionId: bigint,
  expectedCount: bigint,
  blockNumber: bigint
): Promise<Address[]> {
  if (expectedCount > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`Position #${positionId.toString()} has too many portfolio records.`);
  }
  const values: Address[] = [];
  let cursor = 0n;
  while (cursor < expectedCount) {
    const [page, nextCursor] = await publicClient.readContract({
      address: diamond,
      abi: staticsAbi,
      functionName: "globalRewardAssetsOfPosition",
      args: [positionId, cursor, POSITION_PORTFOLIO_MAX_PAGE_SIZE],
      blockNumber,
    });
    if (
      nextCursor <= cursor ||
      nextCursor > expectedCount ||
      page.length > Number(POSITION_PORTFOLIO_MAX_PAGE_SIZE)
    ) {
      throw new Error(`Position #${positionId.toString()} returned an invalid portfolio page.`);
    }
    values.push(...page);
    cursor = nextCursor;
  }
  validateComplete(values, expectedCount, positionId);
  return values;
}

function validateComplete(
  values: readonly (bigint | Address)[],
  expectedCount: bigint,
  positionId: bigint
): void {
  const identities = values.map((value) => value.toString().toLowerCase());
  if (BigInt(values.length) !== expectedCount || new Set(identities).size !== identities.length) {
    throw new Error(`Position #${positionId.toString()} returned an incomplete portfolio.`);
  }
}

/** Reads every portfolio page at one block so swap-pop pagination cannot drift. */
export async function loadPositionPortfolio(
  publicClient: PublicClient,
  diamond: Address,
  positionId: bigint,
  blockNumber: bigint
): Promise<PositionPortfolio> {
  const counts = await publicClient.readContract({
    address: diamond,
    abi: staticsAbi,
    functionName: "positionPortfolioCounts",
    args: [positionId],
    blockNumber,
  });

  const [basketIds, loanIds, liquidityPositionIds, globalRewardAssets, riskSeriesIds] =
    await Promise.all([
      loadUintPages(
        publicClient,
        diamond,
        "basketIdsOfPosition",
        positionId,
        counts.basketCount,
        blockNumber
      ),
      loadUintPages(
        publicClient,
        diamond,
        "loanIdsOfPosition",
        positionId,
        counts.loanCount,
        blockNumber
      ),
      loadUintPages(
        publicClient,
        diamond,
        "liquidityPositionIdsOfPosition",
        positionId,
        counts.liquidityPositionCount,
        blockNumber
      ),
      loadAddressPages(
        publicClient,
        diamond,
        positionId,
        counts.globalRewardAssetCount,
        blockNumber
      ),
      loadUintPages(
        publicClient,
        diamond,
        "riskSeriesIdsOfPosition",
        positionId,
        counts.riskSeriesCount,
        blockNumber
      ),
    ]);

  return { basketIds, loanIds, liquidityPositionIds, globalRewardAssets, riskSeriesIds };
}
