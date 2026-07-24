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
  activeLegCount: bigint;
  initializing: boolean;
  collateral: readonly PositionCollateral[];
  stakedBalance: bigint;
  unstakeAvailableAt: bigint;
  claimAssetCount: bigint;
  selectedRewardAssets: readonly Address[];
  rewards: readonly PositionReward[];
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
  knownRewardAssets: readonly Address[]
): Promise<PositionRecord | null> {
  const owner = await publicClient
    .readContract({
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "ownerOf",
      args: [positionId],
    })
    .catch(() => null);
  if (!owner || getAddress(owner) !== wallet) return null;

  const [activeLegCount, initializing, stake, selectedRewardAssets] = await Promise.all([
    publicClient.readContract({
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "activeLegCount",
      args: [positionId],
    }),
    publicClient.readContract({
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "positionInitializing",
      args: [positionId],
    }),
    publicClient.readContract({
      account: wallet,
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "stakePosition",
      args: [positionId],
    }),
    publicClient.readContract({
      account: wallet,
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "positionRewardAssets",
      args: [positionId],
    }),
  ]);

  const rewardAssets = [
    ...new Set([...selectedRewardAssets, ...knownRewardAssets].map((asset) => getAddress(asset))),
  ];
  const [collateral, pending, rewardMetadata] = await Promise.all([
    Promise.all(
      baskets.map(async (basket): Promise<PositionCollateral | null> => {
        const state = await publicClient.readContract({
          address: deployment.contracts.diamond,
          abi: staticsAbi,
          functionName: "basketCollateralPosition",
          args: [positionId, basket.basketId],
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
        })
      : Promise.resolve([] as readonly bigint[]),
    Promise.all(rewardAssets.map((asset) => loadTokenMetadata(publicClient, asset))),
  ]);

  return {
    positionId,
    owner: wallet,
    activeLegCount,
    initializing,
    collateral: collateral.filter((item): item is PositionCollateral => item !== null),
    stakedBalance: stake.stakedBalance,
    unstakeAvailableAt: stake.unstakeAvailableAt,
    claimAssetCount: stake.claimAssetCount,
    selectedRewardAssets,
    rewards: rewardMetadata.map((token, index) => ({
      token,
      pending: pending[index] ?? 0n,
    })),
  };
}

export async function loadPositionCatalog(
  publicClient: PublicClient,
  deployment: DollarDeployment,
  wallet: Address
): Promise<PositionCatalog> {
  const basketCatalog = await loadBasketCatalog(publicClient, deployment, wallet);
  const [
    transferLogs,
    rewardSelectionLogs,
    rewardLogs,
    stakingToken,
    totalStaked,
    maximumRewardAssets,
    latestBlock,
  ] = await Promise.all([
    publicClient.getContractEvents({
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      eventName: "Transfer",
      args: { to: wallet },
      fromBlock: deployment.deploymentStartBlock,
      toBlock: "latest",
      strict: true,
    }),
    publicClient.getContractEvents({
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      eventName: "RewardAssetOptedIn",
      fromBlock: deployment.deploymentStartBlock,
      toBlock: "latest",
      strict: true,
    }),
    publicClient.getContractEvents({
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      eventName: "GlobalFeeAccrued",
      fromBlock: deployment.deploymentStartBlock,
      toBlock: "latest",
      strict: true,
    }),
    publicClient.readContract({
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "stakingToken",
    }),
    publicClient.readContract({
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "totalStaked",
    }),
    publicClient.readContract({
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "maxRewardAssetsPerPosition",
    }),
    publicClient.getBlock({ blockTag: "latest" }),
  ]);

  const positionIds = [...new Set(transferLogs.map((log) => log.args.tokenId.toString()))].map(
    BigInt
  );
  const positions = (
    await Promise.all(
      positionIds.map((positionId) =>
        readOwnedPosition(
          publicClient,
          deployment,
          wallet,
          positionId,
          basketCatalog.baskets,
          rewardSelectionLogs
            .filter((log) => log.args.positionId === positionId)
            .map((log) => log.args.asset)
        )
      )
    )
  )
    .filter((position): position is PositionRecord => position !== null)
    .sort((left, right) => Number(right.positionId - left.positionId));

  const candidateSources = new Map<Address, Set<string>>();
  addCandidate(candidateSources, deployment.contracts.dollar, "Statics deployment");
  addCandidate(candidateSources, deployment.contracts.weth, "Statics deployment");
  for (const basket of basketCatalog.baskets) {
    addCandidate(candidateSources, basket.token.address, `Basket ${basket.symbol}`);
    for (const constituent of basket.constituents) {
      addCandidate(candidateSources, constituent.token.address, `${basket.symbol} constituent`);
    }
  }
  for (const log of rewardLogs) addCandidate(candidateSources, log.args.asset, "Fee history");
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
      [...candidateSources.keys()].map((address) => loadTokenMetadata(publicClient, address))
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
            }),
          ] as const
      )
    ),
    loadTokenMetadata(publicClient, stakingToken),
    publicClient.readContract({
      address: stakingToken,
      abi: basketTokenAbi,
      functionName: "balanceOf",
      args: [wallet],
    }),
    publicClient.readContract({
      address: stakingToken,
      abi: basketTokenAbi,
      functionName: "allowance",
      args: [wallet, deployment.contracts.diamond],
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
    currentBlock: latestBlock.number,
    currentTimestamp: latestBlock.timestamp,
  };
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
  PositionHasActiveLegs: "Remove every active position leg before closing this PositionNFT.",
  NotPositionOwnerOrApproved: "This wallet is not authorized to manage the PositionNFT.",
  ERC721NonexistentToken: "This PositionNFT no longer exists.",
  PositionSharesLocked: "Loan-locked basket collateral cannot be removed.",
  PositionDepositTooRecent: "Basket collateral becomes withdrawable in the next block.",
  InsufficientPositionShares: "The position does not contain that many basket shares.",
  UnstakeCooldownActive: "The 24-hour unstaking cooldown is still active.",
  InsufficientStake: "The position does not contain that much staked balance.",
  RewardAssetAlreadyOptedIn: "This reward asset is already selected.",
  RewardAssetNotOptedIn: "This reward asset is not selected.",
  RewardAssetLimitExceeded: "This position already selected the maximum 64 reward assets.",
  ERC20InsufficientBalance: "The wallet does not have enough of the required token.",
  ERC20InsufficientAllowance: "The current token approval is below the required amount.",
  MaximumInputExceeded: "A constituent input moved above the selected slippage limit.",
  MinimumOutputNotMet: "A constituent output moved below the selected slippage limit.",
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

export function canClosePosition(
  position: Pick<PositionRecord, "activeLegCount" | "initializing">
) {
  return !position.initializing && position.activeLegCount === 0n;
}

export function isUnstakeAvailable(
  position: Pick<PositionRecord, "unstakeAvailableAt">,
  now: bigint
) {
  return now >= position.unstakeAvailableAt;
}
