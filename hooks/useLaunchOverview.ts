"use client";
import { useQuery } from "@tanstack/react-query";
import { getAddress } from "viem";
import { usePublicClient } from "wagmi";

import { dopplerStaticsTokenAbi, v4StateViewReadAbi } from "@statics-protocol/sdk";

import type { LaunchDeployment } from "@/lib/deployments/types";
import { ROBINHOOD_GENESIS_DEPLOYMENT_ID } from "@/lib/deployments/registry";
import { verifyLaunchDeploymentForRead } from "@/lib/deployments/verify-launch-read";
import { currentGenesisVaultAbi } from "@/lib/genesis/current-vault";
import {
  EMPTY_GENESIS_PORTFOLIO,
  loadOwnedGenesis,
  ownedGenesisQueryKey,
} from "@/lib/genesis/owned";
import { loadMarketOverview } from "@/lib/market/client";
import { useWalletState } from "@/providers/wallet-context";

/**
 * The Genesis reads both overviews show: Vault accounting and quotes, the canonical STATICS
 * pool, the wallet's STATICS and Operators, and the market analytics snapshot. The launch
 * dashboard and the Phase 1 protocol overview share these query keys, so moving between
 * them does not refetch.
 */
export function useLaunchOverview(deployment: LaunchDeployment | null) {
  const chainId = deployment?.descriptor.chainId;
  const deploymentId = deployment?.descriptor.deploymentId ?? null;
  const publicClient = usePublicClient({ chainId });
  const walletState = useWalletState();
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;

  const metrics = useQuery({
    queryKey: ["launch-overview", deploymentId],
    enabled: Boolean(publicClient && deployment),
    queryFn: async () => {
      if (!publicClient || !deployment) throw new Error("The deployment RPC is unavailable.");
      await verifyLaunchDeploymentForRead(publicClient, deployment);
      const [vault, purchase, redemption, slot0, liquidity] = await Promise.all([
        publicClient.readContract({
          address: deployment.contracts.vault,
          abi: currentGenesisVaultAbi,
          functionName: "vaultAccounting",
        }),
        publicClient.readContract({
          address: deployment.contracts.vault,
          abi: currentGenesisVaultAbi,
          functionName: "quoteGenesisPurchase",
        }),
        publicClient.readContract({
          address: deployment.contracts.vault,
          abi: currentGenesisVaultAbi,
          functionName: "quoteGenesisRedemption",
        }),
        publicClient.readContract({
          address: deployment.contracts.stateView,
          abi: v4StateViewReadAbi,
          functionName: "getSlot0",
          args: [deployment.market.poolId],
        }),
        publicClient.readContract({
          address: deployment.contracts.stateView,
          abi: v4StateViewReadAbi,
          functionName: "getLiquidity",
          args: [deployment.market.poolId],
        }),
      ]);
      return { vault, purchase, redemption, sqrtPriceX96: slot0[0], liquidity };
    },
  });

  const staticsBalance = useQuery({
    queryKey: ["launch-overview-balance", deploymentId, wallet],
    enabled: Boolean(publicClient && wallet && deployment),
    queryFn: async () => {
      if (!publicClient || !wallet || !deployment) return 0n;
      return publicClient.readContract({
        address: deployment.contracts.statics,
        abi: dopplerStaticsTokenAbi,
        functionName: "balanceOf",
        args: [wallet],
      });
    },
  });

  // Same key and fetcher My Operators mounts, so the two surfaces share one walk
  // of the wallet rather than each paying for it.
  const portfolio = useQuery({
    queryKey: ownedGenesisQueryKey(deploymentId ?? "", wallet),
    enabled: Boolean(publicClient && wallet && deployment),
    retry: false,
    queryFn: async () => {
      if (!publicClient || !wallet || !deployment) return EMPTY_GENESIS_PORTFOLIO;
      return loadOwnedGenesis(publicClient, deployment, wallet);
    },
  });

  const marketAnalytics = useQuery({
    queryKey: ["market-overview", deploymentId],
    enabled: deploymentId === ROBINHOOD_GENESIS_DEPLOYMENT_ID,
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 1,
    queryFn: ({ signal }) => loadMarketOverview(signal),
  });

  return { wallet, metrics, staticsBalance, portfolio, marketAnalytics };
}
