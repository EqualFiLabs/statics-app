"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getAddress } from "viem";
import { usePublicClient } from "wagmi";

import { SurfaceEmptyState } from "@/components/common/EmptyState";
import { WalletNftList } from "@/components/wallet/WalletNftList";
import { readClientDollarDeployment } from "@/lib/dollar/deployment";
import { loadLiquidityCatalog } from "@/lib/liquidity/liquidity";
import { loadPositionCatalog } from "@/lib/positions/positions";
import { deriveSurfaceState, isSurfaceReady } from "@/lib/surface-state";
import { collectWalletNfts, type WalletNft } from "@/lib/wallet/nfts";
import { useWalletState } from "@/providers/wallet-context";

const deploymentState = readClientDollarDeployment();

/**
 * The NFTs tab, owning its own reads.
 *
 * Mounted only while the tab is open, which keeps the wallet page renderable
 * without a wagmi provider -- the token balances above it use their own client,
 * and the existing tests for that surface do not stand one up.
 *
 * These live on the Statics chain rather than whichever funding network the
 * balances are showing, so the reads are addressed to the deployment's chain
 * regardless of the selector at the top of the page.
 */
export function WalletNftPanel({ onTransfer }: { onTransfer: (nft: WalletNft) => void }) {
  const wallet = useWalletState();
  const publicClient = usePublicClient(
    deploymentState.status === "configured"
      ? { chainId: deploymentState.deployment.chainId }
      : undefined
  );

  const walletAddress =
    wallet.status === "ready" && wallet.address ? getAddress(wallet.address) : null;

  const catalog = useQuery({
    queryKey: ["wallet-nfts", walletAddress],
    enabled:
      deploymentState.status === "configured" &&
      Boolean(publicClient) &&
      Boolean(walletAddress) &&
      wallet.status === "ready" &&
      wallet.isTargetChain,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!publicClient || !walletAddress || deploymentState.status !== "configured") {
        throw new Error("No verified Statics deployment is configured.");
      }
      const deployment = deploymentState.deployment;

      // Settled rather than all: the two sources are independent, and a
      // deployment whose canonical pools are not initialised makes the
      // liquidity read revert. Failing the whole query for that discarded
      // every position the wallet actually held.
      const [positions, liquidity] = await Promise.allSettled([
        loadPositionCatalog(publicClient, deployment, walletAddress),
        deployment.liquidity
          ? loadLiquidityCatalog(publicClient, deployment, walletAddress)
          : Promise.resolve(null),
      ]);

      // Positions are the load-bearing half. Only their failure is fatal.
      if (positions.status === "rejected") throw positions.reason;

      return {
        nfts: collectWalletNfts({
          positions: positions.value.positions,
          liquidityPositions:
            liquidity.status === "fulfilled" ? (liquidity.value?.positions ?? []) : [],
          deployment,
          wallet: walletAddress,
        }),
        liquidityUnavailable: liquidity.status === "rejected",
      };
    },
  });

  const state = deriveSurfaceState({
    walletStatus: wallet.status,
    isTargetChain: wallet.isTargetChain,
    isLoading: catalog.isPending,
    isError: catalog.isError,
    isEmpty: (catalog.data?.nfts.length ?? 0) === 0,
    hasData: Boolean(catalog.data),
  });

  if (!catalog.data || !isSurfaceReady(state)) {
    return (
      <SurfaceEmptyState
        state={state}
        subject="NFTs"
        onRetry={() => void catalog.refetch()}
        empty={{
          title: "No NFTs yet",
          description:
            "Positions and liquidity positions appear here. Buy a basket or supply liquidity and the NFT that represents it shows up in your wallet.",
          action: { label: "Browse baskets", href: "/app/baskets" },
        }}
      />
    );
  }

  return (
    <>
      {catalog.data.liquidityUnavailable && (
        <p className="dollar-warning" role="status">
          Liquidity positions could not be read on this network, so only positions are listed.
        </p>
      )}
      <WalletNftList nfts={catalog.data.nfts} onTransfer={onTransfer} />
    </>
  );
}
