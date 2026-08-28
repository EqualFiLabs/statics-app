import type { PublicClient } from "viem";
import { genesisActivationRegistryAbi, genesisLaunchDistributorAbi } from "@statics-protocol/sdk";
import { staticsGenesisCreditAbi } from "@statics-protocol/sdk/genesis-credit";

import type { LaunchDeployment } from "@/lib/deployments/types";
import { verifyLaunchDeploymentCached } from "@/lib/deployments/verify-launch";
import { oneIndexedGenesisTierCosts } from "@/lib/genesis/activation-costs";
import { discoverWalletGenesisSnapshot } from "@/lib/genesis/discovery";

export type OwnedGenesis = Readonly<{
  id: bigint;
  tier: number;
  multiplierBps: number;
  registered: boolean;
  rewardWeight: bigint;
  pendingStatics: bigint;
  pendingWeth: bigint;
  creditActive: boolean;
  creditPrincipal: bigint;
  creditMaturity: number;
}>;

export type OwnedGenesisPortfolio = Readonly<{
  items: readonly OwnedGenesis[];
  tierCosts: readonly bigint[];
  /** uint16 onchain, so viem hands this back as a number. */
  rewardShareBps: number;
  totalWeight: bigint;
  ownerStatics: bigint;
  ownerWeth: bigint;
  indexedBlock: bigint | null;
  chainHead: bigint | null;
  stale: boolean;
}>;

export const EMPTY_GENESIS_PORTFOLIO: OwnedGenesisPortfolio = {
  items: [],
  tierCosts: [],
  rewardShareBps: 0,
  totalWeight: 0n,
  ownerStatics: 0n,
  ownerWeth: 0n,
  indexedBlock: null,
  chainHead: null,
  stale: false,
};

/**
 * The query key both My Operators and the Overview mount.
 *
 * Sharing the key is the point: this walk is one discovery call plus only the
 * dynamic reward and credit reads per NFT when the indexer provides the rest
 * of the state. The Overview and My Operators therefore reuse one snapshot.
 */
export function ownedGenesisQueryKey(deploymentId: string, wallet: `0x${string}` | null) {
  return ["launch-genesis-owned", deploymentId, wallet] as const;
}

/** Everything this wallet holds, with each NFT's reward and credit state. */
export async function loadOwnedGenesis(
  publicClient: PublicClient,
  deployment: LaunchDeployment,
  wallet: `0x${string}`
): Promise<OwnedGenesisPortfolio> {
  await verifyLaunchDeploymentCached(publicClient, deployment);
  const [discovery, tierCosts, rewardShareBps, totalWeight, ownerStatics, ownerWeth] =
    await Promise.all([
      discoverWalletGenesisSnapshot(publicClient, deployment, wallet),
      Promise.all(
        [1, 2, 3, 4].map((tier) =>
          publicClient.readContract({
            address: deployment.contracts.activationRegistry,
            abi: genesisActivationRegistryAbi,
            functionName: "tierCost",
            args: [tier],
          })
        )
      ).then(oneIndexedGenesisTierCosts),
      publicClient.readContract({
        address: deployment.contracts.launchDistributor,
        abi: genesisLaunchDistributorAbi,
        functionName: "genesisRewardShareBps",
      }),
      publicClient.readContract({
        address: deployment.contracts.launchDistributor,
        abi: genesisLaunchDistributorAbi,
        functionName: "totalWeight",
      }),
      publicClient.readContract({
        address: deployment.contracts.launchDistributor,
        abi: genesisLaunchDistributorAbi,
        functionName: "ownerClaimable",
        args: [wallet, deployment.contracts.statics],
      }),
      publicClient.readContract({
        address: deployment.contracts.launchDistributor,
        abi: genesisLaunchDistributorAbi,
        functionName: "ownerClaimable",
        args: [wallet, deployment.contracts.weth],
      }),
    ]);

  const indexedById = new Map(discovery.indexed.map((item) => [item.id.toString(), item]));
  const items = await Promise.all(
    discovery.ids.map(async (id): Promise<OwnedGenesis> => {
      const indexed = indexedById.get(id.toString());
      const indexedStateComplete =
        indexed?.tier !== undefined &&
        indexed.multiplierBps !== undefined &&
        indexed.registered !== undefined &&
        indexed.effectiveWeight !== undefined;
      const [state, pendingStatics, pendingWeth, credit] = await Promise.all([
        indexedStateComplete
          ? Promise.resolve({
              tier: indexed.tier!,
              multiplierBps: indexed.multiplierBps!,
              registered: indexed.registered!,
              rewardWeight: indexed.effectiveWeight!,
            })
          : Promise.all([
              publicClient.readContract({
                address: deployment.contracts.activationRegistry,
                abi: genesisActivationRegistryAbi,
                functionName: "tierOf",
                args: [id],
              }),
              publicClient.readContract({
                address: deployment.contracts.activationRegistry,
                abi: genesisActivationRegistryAbi,
                functionName: "multiplierBps",
                args: [id],
              }),
              publicClient.readContract({
                address: deployment.contracts.launchDistributor,
                abi: genesisLaunchDistributorAbi,
                functionName: "registered",
                args: [id],
              }),
              publicClient.readContract({
                address: deployment.contracts.launchDistributor,
                abi: genesisLaunchDistributorAbi,
                functionName: "effectiveWeight",
                args: [id],
              }),
            ]).then(([tier, multiplierBps, registered, rewardWeight]) => ({
              tier: Number(tier),
              multiplierBps: Number(multiplierBps),
              registered,
              rewardWeight,
            })),
        publicClient.readContract({
          address: deployment.contracts.launchDistributor,
          abi: genesisLaunchDistributorAbi,
          functionName: "pendingGenesis",
          args: [id, deployment.contracts.statics],
        }),
        publicClient.readContract({
          address: deployment.contracts.launchDistributor,
          abi: genesisLaunchDistributorAbi,
          functionName: "pendingGenesis",
          args: [id, deployment.contracts.weth],
        }),
        // Credit state travels with the list so the carousel can flag a
        // transfer lock and the summary can total what is owed, without a
        // per-card query fanning out behind the scenes.
        publicClient.readContract({
          address: deployment.contracts.vault,
          abi: staticsGenesisCreditAbi,
          functionName: "credit",
          args: [id],
        }),
      ]);
      return {
        id,
        tier: state.tier,
        multiplierBps: state.multiplierBps,
        registered: state.registered,
        rewardWeight: state.rewardWeight,
        pendingStatics,
        pendingWeth,
        creditActive: credit.active,
        creditPrincipal: credit.principal,
        creditMaturity: Number(credit.maturity),
      };
    })
  );

  return {
    items,
    tierCosts,
    rewardShareBps,
    totalWeight,
    ownerStatics,
    ownerWeth,
    indexedBlock: discovery.indexedBlock,
    chainHead: discovery.chainHead,
    stale: discovery.stale,
  };
}

export type GenesisRewardSummary = Readonly<{
  claimableStatics: bigint;
  claimableWeth: bigint;
  ownerStatics: bigint;
  ownerWeth: bigint;
  /**
   * How many wallet signatures a full claim currently takes.
   *
   * `GenesisLaunchDistributor` exposes `claimGenesis` and `claimOwnerRewards`
   * one asset at a time, so this is the honest count to put in front of anyone
   * about to start the sequence. It collapses to 1 when the batch entry point
   * lands.
   */
  claimTransactionCount: number;
}>;

export function summariseGenesisRewards(portfolio: OwnedGenesisPortfolio): GenesisRewardSummary {
  const pendingStatics = portfolio.items.reduce((total, item) => total + item.pendingStatics, 0n);
  const pendingWeth = portfolio.items.reduce((total, item) => total + item.pendingWeth, 0n);
  const claimTransactionCount =
    portfolio.items.reduce(
      (total, item) => total + (item.pendingStatics > 0n ? 1 : 0) + (item.pendingWeth > 0n ? 1 : 0),
      0
    ) +
    (portfolio.ownerStatics > 0n ? 1 : 0) +
    (portfolio.ownerWeth > 0n ? 1 : 0);
  return {
    claimableStatics: pendingStatics + portfolio.ownerStatics,
    claimableWeth: pendingWeth + portfolio.ownerWeth,
    ownerStatics: portfolio.ownerStatics,
    ownerWeth: portfolio.ownerWeth,
    claimTransactionCount,
  };
}
