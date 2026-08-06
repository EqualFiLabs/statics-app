import {
  BaseError,
  ContractFunctionRevertedError,
  decodeErrorResult,
  getAddress,
  isAddress,
  zeroAddress,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";

import {
  basketTokenAbi,
  staticsAbi,
  staticsBasketErrorAbi,
  staticsCollateralErrorAbi,
  staticsPositionErrorAbi,
  staticsRewardsErrorAbi,
  staticsTokenErrorAbi,
} from "@statics-protocol/sdk";

import {
  loadBasketCatalog,
  loadTokenMetadata,
  type BasketRecord,
  type TokenMetadata,
} from "@/lib/baskets/baskets";
import type { DollarDeployment } from "@/lib/dollar/deployment";
import { loadOwnedPositionIds } from "@/lib/positions/owner-index";
import { loadPositionPortfolio } from "@/lib/positions/portfolio";
import { describeTransportFailure } from "@/lib/protocol/errors";

export type PositionCollateral = Readonly<{
  basket: BasketRecord;
  depositedShares: bigint;
  lockedShares: bigint;
  withdrawableAfterBlock: bigint;
}>;

export type PositionReward = Readonly<{
  token: TokenMetadata;
  pending: bigint;
}>;

export type PositionRecord = Readonly<{
  positionId: bigint;
  owner: Address;
  stateNonce: bigint;
  activeLegCount: bigint;
  unresolvedObligationCount: bigint;
  closable: boolean;
  collateral: readonly PositionCollateral[];
  stakedBalance: bigint;
  claimAssetCount: bigint;
  selectedRewardAssets: readonly Address[];
  rewards: readonly PositionReward[];
  loanIds: readonly bigint[];
  liquidityPositionIds: readonly bigint[];
  riskSeriesIds: readonly bigint[];
}>;

export function claimablePositionRewards(
  rewards: PositionRecord["rewards"],
  selectedAssets?: readonly Address[]
): PositionRecord["rewards"] {
  const selected =
    selectedAssets ??
    rewards.filter((reward) => reward.pending > 0n).map((reward) => reward.token.address);
  return rewards.filter((reward) => reward.pending > 0n && selected.includes(reward.token.address));
}

export type RewardCandidate = Readonly<{
  token: TokenMetadata;
  sources: readonly string[];
}>;

export type PositionCatalog = Readonly<{
  positions: readonly PositionRecord[];
  baskets: readonly BasketRecord[];
  basketTokenAllowances: Readonly<Record<string, bigint>>;
  rewardCandidates: readonly RewardCandidate[];
  stakingToken: TokenMetadata;
  stakingTokenBalance: bigint;
  stakingTokenAllowance: bigint;
  totalStaked: bigint;
  maximumRewardAssets: bigint;
  positionCreationFee: bigint;
  currentBlock: bigint;
  currentTimestamp: bigint;
}>;

function addCandidate(
  candidates: Map<Address, Set<string>>,
  address: Address,
  source: string
): void {
  const current = candidates.get(address) ?? new Set<string>();
  current.add(source);
  candidates.set(address, current);
}

async function readOwnedPosition(
  publicClient: PublicClient,
  deployment: DollarDeployment,
  wallet: Address,
  positionId: bigint,
  baskets: readonly BasketRecord[],
  blockNumber: bigint
): Promise<PositionRecord> {
  const [state, closable, stake, selectedRewardAssets, portfolio] = await Promise.all([
    publicClient.readContract({
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "positionState",
      args: [positionId],
      blockNumber,
    }),
    publicClient.readContract({
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "isPositionClosable",
      args: [positionId],
      blockNumber,
    }),
    publicClient.readContract({
      account: wallet,
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "stakePosition",
      args: [positionId],
      blockNumber,
    }),
    publicClient.readContract({
      account: wallet,
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "positionRewardAssets",
      args: [positionId],
      blockNumber,
    }),
    loadPositionPortfolio(publicClient, deployment.contracts.diamond, positionId, blockNumber),
  ]);
  if (!state.exists) {
    throw new Error(`Position #${positionId.toString()} disappeared from the owner index.`);
  }

  const normalizedSelectedRewardAssets = selectedRewardAssets.map((asset) => getAddress(asset));
  const rewardAssets = [...new Set(portfolio.globalRewardAssets.map((asset) => getAddress(asset)))];
  const [collateral, pending, rewardMetadata] = await Promise.all([
    Promise.all(
      portfolio.basketIds.map(async (basketId): Promise<PositionCollateral | null> => {
        const basket = baskets.find((candidate) => candidate.basketId === basketId);
        if (!basket) {
          throw new Error(
            `Position #${positionId.toString()} references unavailable basket #${basketId.toString()}.`
          );
        }
        const state = await publicClient.readContract({
          address: deployment.contracts.diamond,
          abi: staticsAbi,
          functionName: "basketCollateralPosition",
          args: [positionId, basket.basketId],
          blockNumber,
        });
        if (state.depositedShares === 0n && state.lockedShares === 0n) return null;
        return {
          basket,
          depositedShares: state.depositedShares,
          lockedShares: state.lockedShares,
          withdrawableAfterBlock: state.withdrawableAfterBlock,
        };
      })
    ),
    rewardAssets.length
      ? publicClient.readContract({
          account: wallet,
          address: deployment.contracts.diamond,
          abi: staticsAbi,
          functionName: "pendingRewards",
          args: [positionId, rewardAssets],
          blockNumber,
        })
      : Promise.resolve([] as readonly bigint[]),
    Promise.all(
      rewardAssets.map((asset) => loadTokenMetadata(publicClient, asset, undefined, blockNumber))
    ),
  ]);

  return {
    positionId,
    owner: wallet,
    stateNonce: state.stateNonce,
    activeLegCount: state.activeLegCount,
    unresolvedObligationCount: state.unresolvedObligationCount,
    closable,
    collateral: collateral.filter((item): item is PositionCollateral => item !== null),
    stakedBalance: stake.stakedBalance,
    claimAssetCount: stake.claimAssetCount,
    selectedRewardAssets: normalizedSelectedRewardAssets,
    rewards: rewardMetadata.map((token, index) => ({
      token,
      pending: pending[index] ?? 0n,
    })),
    loanIds: portfolio.loanIds,
    liquidityPositionIds: portfolio.liquidityPositionIds,
    riskSeriesIds: portfolio.riskSeriesIds,
  };
}

export async function loadPositionCatalog(
  publicClient: PublicClient,
  deployment: DollarDeployment,
  wallet: Address,
  atBlock?: bigint
): Promise<PositionCatalog> {
  const latestBlock = atBlock
    ? await publicClient.getBlock({ blockNumber: atBlock })
    : await publicClient.getBlock({ blockTag: "latest" });
  const basketCatalog = await loadBasketCatalog(
    publicClient,
    deployment,
    wallet,
    latestBlock.number
  );
  const [positionIds, stakingToken, totalStaked, maximumRewardAssets, positionCreationFee] =
    await Promise.all([
      loadOwnedPositionIds(publicClient, deployment.contracts.diamond, wallet, latestBlock.number),
      publicClient.readContract({
        address: deployment.contracts.diamond,
        abi: staticsAbi,
        functionName: "stakingToken",
        blockNumber: latestBlock.number,
      }),
      publicClient.readContract({
        address: deployment.contracts.diamond,
        abi: staticsAbi,
        functionName: "totalStaked",
        blockNumber: latestBlock.number,
      }),
      publicClient.readContract({
        address: deployment.contracts.diamond,
        abi: staticsAbi,
        functionName: "maxRewardAssetsPerPosition",
        blockNumber: latestBlock.number,
      }),
      publicClient.readContract({
        address: deployment.contracts.diamond,
        abi: staticsAbi,
        functionName: "positionCreationFee",
        blockNumber: latestBlock.number,
      }),
    ]);

  const positions = (
    await Promise.all(
      positionIds.map((positionId) =>
        readOwnedPosition(
          publicClient,
          deployment,
          wallet,
          positionId,
          basketCatalog.baskets,
          latestBlock.number
        )
      )
    )
  ).sort((left, right) =>
    left.positionId === right.positionId ? 0 : left.positionId > right.positionId ? -1 : 1
  );

  const candidateSources = new Map<Address, Set<string>>();
  addCandidate(candidateSources, deployment.contracts.dollar, "Statics deployment");
  addCandidate(candidateSources, deployment.contracts.weth, "Statics deployment");
  for (const basket of basketCatalog.baskets) {
    addCandidate(candidateSources, basket.token.address, `Basket ${basket.symbol}`);
    for (const constituent of basket.constituents) {
      addCandidate(candidateSources, constituent.token.address, `${basket.symbol} underlying`);
    }
  }
  for (const position of positions) {
    for (const reward of position.rewards) {
      addCandidate(
        candidateSources,
        reward.token.address,
        `Position #${position.positionId.toString()}`
      );
    }
  }

  const [
    candidateMetadata,
    basketTokenAllowances,
    stakingTokenMetadata,
    stakingTokenBalance,
    stakingTokenAllowance,
  ] = await Promise.all([
    Promise.all(
      [...candidateSources.keys()].map((address) =>
        loadTokenMetadata(publicClient, address, undefined, latestBlock.number)
      )
    ),
    Promise.all(
      basketCatalog.baskets.map(
        async (basket) =>
          [
            basket.basketId.toString(),
            await publicClient.readContract({
              address: basket.token.address,
              abi: basketTokenAbi,
              functionName: "allowance",
              args: [wallet, deployment.contracts.diamond],
              blockNumber: latestBlock.number,
            }),
          ] as const
      )
    ),
    loadTokenMetadata(publicClient, stakingToken, undefined, latestBlock.number),
    publicClient.readContract({
      address: stakingToken,
      abi: basketTokenAbi,
      functionName: "balanceOf",
      args: [wallet],
      blockNumber: latestBlock.number,
    }),
    publicClient.readContract({
      address: stakingToken,
      abi: basketTokenAbi,
      functionName: "allowance",
      args: [wallet, deployment.contracts.diamond],
      blockNumber: latestBlock.number,
    }),
  ]);

  const rewardCandidates = candidateMetadata
    .map((token) => ({
      token,
      sources: [...(candidateSources.get(token.address) ?? [])].sort(),
    }))
    .sort((left, right) => left.token.symbol.localeCompare(right.token.symbol));

  return {
    positions,
    baskets: basketCatalog.baskets,
    basketTokenAllowances: Object.fromEntries(basketTokenAllowances),
    rewardCandidates,
    stakingToken: stakingTokenMetadata,
    stakingTokenBalance,
    stakingTokenAllowance,
    totalStaked,
    maximumRewardAssets,
    positionCreationFee,
    currentBlock: latestBlock.number,
    currentTimestamp: latestBlock.timestamp,
  };
}

/**
 * Reloads the complete position catalog at the transaction's confirmed block
 * and rejects until the requested reward membership is authoritative there.
 */
export async function loadConfirmedRewardSelection(
  publicClient: PublicClient,
  deployment: DollarDeployment,
  wallet: Address,
  positionId: bigint,
  asset: Address,
  expectedSelected: boolean,
  blockNumber: bigint
): Promise<PositionCatalog> {
  const catalog = await loadPositionCatalog(publicClient, deployment, wallet, blockNumber);
  const position = catalog.positions.find((candidate) => candidate.positionId === positionId);
  if (!position) {
    throw new Error("This PositionNFT is no longer owned by the connected wallet.");
  }
  if (position.selectedRewardAssets.includes(asset) !== expectedSelected) {
    throw new Error("The confirmed reward selection is not yet available from the read RPC.");
  }
  return catalog;
}

export async function validateCustomRewardAsset(
  publicClient: PublicClient,
  value: string,
  selectedAssets: readonly Address[],
  maximumRewardAssets: bigint
): Promise<TokenMetadata> {
  if (!isAddress(value)) throw new Error("Enter a valid EVM contract address.");
  const address = getAddress(value);
  if (address === zeroAddress) throw new Error("The zero address cannot be a reward asset.");
  if (selectedAssets.some((asset) => asset === address)) {
    throw new Error("This reward asset is already selected.");
  }
  if (BigInt(selectedAssets.length) >= maximumRewardAssets) {
    throw new Error(`This position already selected the ${maximumRewardAssets} asset maximum.`);
  }
  const code = await publicClient.getCode({ address });
  if (!code || code === "0x") throw new Error("The reward asset address has no contract code.");
  const metadata = await loadTokenMetadata(publicClient, address);
  if (!metadata.metadataAvailable) {
    throw new Error("The reward asset must expose readable ERC-20 metadata.");
  }
  return metadata;
}

const positionErrorMessages: Readonly<Record<string, string>> = {
  IncorrectPositionCreationFee:
    "The Position account fee changed. Refresh the current fee and try again.",
  PositionCreationFeeTransferFailed:
    "The protocol could not forward the Position account fee to treasury.",
  PositionHasActiveLegs: "Remove every active position leg before closing this PositionNFT.",
  PositionHasUnresolvedObligations:
    "Resolve every outstanding position obligation before closing this PositionNFT.",
  NotPositionOwnerOrApproved: "This wallet is not authorized to manage the PositionNFT.",
  InvalidModuleAuthority: "The protocol module reporting this position state is not authorized.",
  InvalidModuleType: "The protocol module reported an invalid position leg type.",
  NoUnresolvedPositionObligation: "This position has no unresolved obligation to clear.",
  ERC721NonexistentToken: "This PositionNFT no longer exists.",
  PositionSharesLocked: "Loan-locked basket collateral cannot be removed.",
  PositionDepositTooRecent: "Basket collateral becomes withdrawable in the next block.",
  InsufficientPositionShares: "The position does not contain that many basket shares.",
  InsufficientStake: "The position does not contain that much staked balance.",
  RewardAssetAlreadyOptedIn: "This reward asset is already selected.",
  RewardAssetNotOptedIn: "This reward asset is not selected.",
  RewardAssetLimitExceeded: "This position already selected the maximum 64 reward assets.",
  ERC20InsufficientBalance: "The wallet does not have enough of the required token.",
  ERC20InsufficientAllowance: "The current token approval is below the required amount.",
  MaximumInputExceeded: "An underlying input moved above the selected slippage limit.",
  MinimumOutputNotMet: "An underlying output moved below the selected slippage limit.",
};

function findHexData(error: unknown): Hex | null {
  if (!(error instanceof BaseError)) return null;
  const revert = error.walk(
    (candidate) => candidate instanceof ContractFunctionRevertedError
  ) as ContractFunctionRevertedError | null;
  return revert?.raw ?? null;
}

export function describePositionError(error: unknown): string {
  const data = findHexData(error);
  if (data) {
    for (const abi of [
      staticsPositionErrorAbi,
      staticsCollateralErrorAbi,
      staticsRewardsErrorAbi,
      staticsTokenErrorAbi,
      staticsBasketErrorAbi,
    ]) {
      try {
        const decoded = decodeErrorResult({ abi, data });
        const message =
          positionErrorMessages[decoded.errorName] ?? "The protocol rejected this action.";
        return `${message} (${decoded.errorName})`;
      } catch {
        // Continue through the authoritative error surfaces.
      }
    }
  }
  const message = error instanceof Error ? error.message : "The wallet request failed.";
  const transportFailure = describeTransportFailure(message);
  if (transportFailure) return transportFailure;
  const known = Object.entries(positionErrorMessages).find(([name]) => message.includes(name));
  if (known) return `${known[1]} (${known[0]})`;
  if (/rejected|denied|4001/i.test(message)) return "The wallet request was rejected.";
  return message;
}

export function unlockedCollateral(collateral: PositionCollateral): bigint {
  return collateral.depositedShares - collateral.lockedShares;
}

export function canClosePosition(position: Pick<PositionRecord, "closable">) {
  return position.closable;
}
