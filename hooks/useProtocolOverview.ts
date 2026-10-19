"use client";
import { useQuery } from "@tanstack/react-query";
import { erc20Abi, getAddress, zeroAddress, type Address } from "viem";
import { usePublicClient } from "wagmi";

import { staticsAbi } from "@statics-protocol/sdk/phase-one";

import type { PhaseOneDeployment } from "@/lib/deployments/types";
import { loadGaugeReserve, loadPhaseOneProtocolActivity } from "@/lib/indexer/phase-one";
import { useWalletState } from "@/providers/wallet-context";

const LIVE_MS = 30_000;

/**
 * The Phase 1 figures the protocol overview adds to the DEX data: global staking,
 * which assets have paid stakers, the gauge reserve, recent protocol events,
 * and the connected wallet's STATICS. Chain reads use the deployment's own chain.
 */
export function useProtocolOverview(deployment: PhaseOneDeployment) {
  const id = deployment.descriptor.deploymentId;
  const publicClient = usePublicClient({ chainId: deployment.descriptor.chainId });
  const walletState = useWalletState();
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;
  const diamond = deployment.contracts.diamond;

  const staking = useQuery({
    queryKey: ["protocol-overview", id, "staking"],
    enabled: Boolean(publicClient),
    staleTime: 15_000,
    refetchInterval: LIVE_MS,
    // Several reads in one batch; ride out a single failed RPC response.
    retry: 2,
    queryFn: async () => {
      if (!publicClient) throw new Error("The deployment RPC is unavailable.");
      // Candidate reward assets: every ERC-20 the reviewed pools trade. An asset has paid
      // stakers once its reward index has moved.
      const candidates = [
        ...new Map(
          deployment.supportedPools
            .flatMap((pool) => [pool.token0, pool.token1])
            .filter((token) => token.address.toLowerCase() !== zeroAddress)
            .map((token) => [token.address.toLowerCase(), token])
        ).values(),
      ];
      const [totalStaked, assets] = await Promise.all([
        publicClient.readContract({
          address: diamond,
          abi: staticsAbi,
          functionName: "totalStaked",
        }),
        Promise.all(
          candidates.map((token) =>
            publicClient.readContract({
              address: diamond,
              abi: staticsAbi,
              functionName: "rewardAsset",
              args: [token.address],
            })
          )
        ),
      ]);
      return {
        totalStaked,
        rewardAssets: candidates
          .filter((_, index) => assets[index]!.indexRay > 0n)
          .map((token) => ({ address: token.address, symbol: token.symbol })),
      };
    },
  });

  const walletStatics = useQuery({
    queryKey: ["protocol-overview-wallet", id, wallet],
    enabled: Boolean(publicClient && wallet),
    staleTime: 15_000,
    queryFn: async () => {
      if (!publicClient || !wallet) return 0n;
      return publicClient.readContract({
        address: deployment.contracts.statics,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [wallet as Address],
      });
    },
  });

  const gauges = useQuery({
    queryKey: ["protocol-overview", id, "gauges"],
    staleTime: 15_000,
    refetchInterval: LIVE_MS,
    retry: false,
    queryFn: () => loadGaugeReserve(id),
  });

  const activity = useQuery({
    queryKey: ["protocol-overview", id, "activity"],
    staleTime: 15_000,
    refetchInterval: LIVE_MS,
    retry: false,
    queryFn: () => loadPhaseOneProtocolActivity(id, 10),
  });

  return { wallet, staking, walletStatics, gauges, activity };
}
