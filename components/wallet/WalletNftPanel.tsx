"use client";

import { useQuery } from "@tanstack/react-query";
import { getAddress } from "viem";
import { usePublicClient } from "wagmi";

import { SurfaceEmptyState } from "@/components/common/EmptyState";
import { WalletNftList } from "@/components/wallet/WalletNftList";
import { loadLiquidityCatalog } from "@/lib/liquidity/liquidity";
import { loadPositionCatalog } from "@/lib/positions/positions";
import { deriveSurfaceState, isSurfaceReady } from "@/lib/surface-state";
import { collectWalletNfts, describeCollectionNfts, type WalletNft } from "@/lib/wallet/nfts";
import { readCollectionHoldings } from "@/lib/wallet/nft-contracts";
import { useWalletNftCollections } from "@/hooks/useWalletNftCollections";
import { useWalletState } from "@/providers/wallet-context";
import { useDeployment } from "@/providers/deployment-context";
import { discoverWalletGenesisIds } from "@/lib/genesis/discovery";

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
export function WalletNftPanel({
  onTransfer,
  onAddCollection,
}: {
  onTransfer: (nft: WalletNft) => void;
  onAddCollection: () => void;
}) {
  const wallet = useWalletState();
  const { active } = useDeployment();
  const deployment = active.protocol ?? active.launch;
  const publicClient = usePublicClient({ chainId: active.descriptor.chainId });

  const walletAddress =
    wallet.status === "ready" && wallet.address ? getAddress(wallet.address) : null;
  const collectionChainId = deployment ? deployment.descriptor.chainId : null;
  const canonicalGenesis = deployment
    ? deployment.kind === "launch"
      ? deployment.contracts.genesis
      : deployment.protocol.genesis?.collection
    : undefined;
  const { collections, removeCollection } = useWalletNftCollections(collectionChainId, deployment);

  const catalog = useQuery({
    queryKey: [
      "wallet-nfts",
      active.descriptor.deploymentId,
      collectionChainId,
      deployment?.kind === "protocol"
        ? deployment.protocol.protocolCommit
        : (deployment?.protocolCommit ?? "unconfigured"),
      walletAddress,
      collections.map((c) => c.address).join(","),
    ],
    enabled:
      Boolean(deployment) &&
      Boolean(publicClient) &&
      Boolean(walletAddress) &&
      wallet.status === "ready" &&
      wallet.isTargetChain,
    queryFn: async () => {
      if (!publicClient || !walletAddress || !deployment) {
        throw new Error("No verified Statics deployment is configured.");
      }

      if (deployment.kind === "launch") {
        const genesisIds = await discoverWalletGenesisIds(publicClient, deployment, walletAddress);
        const customCollections = collections.filter(
          (collection) =>
            collection.address.toLowerCase() !== deployment.contracts.genesis.toLowerCase()
        );
        const collectionResults = await Promise.allSettled(
          customCollections.map((collection) =>
            readCollectionHoldings(publicClient, collection, walletAddress)
          )
        );
        const genesisNfts: WalletNft[] = genesisIds.map((tokenId) => ({
          kind: "collection" as const,
          tokenId,
          contract: deployment.contracts.genesis,
          name: `Genesis #${tokenId.toString()}`,
          summary: "Statics Genesis",
          carries: [] as readonly string[],
          transferWarning:
            "Transferring this Genesis NFT resets activation to Tier 0. Rewards earned before transfer remain claimable by the previous owner.",
          blockedReason: null,
        }));
        const collectionNfts: readonly WalletNft[] = collectionResults.flatMap((result) =>
          result.status === "fulfilled" ? describeCollectionNfts(result.value) : []
        );
        return {
          nfts: [...genesisNfts, ...collectionNfts],
          liquidityUnavailable: false,
        };
      }
      const protocol = deployment.protocol;

      // Settled rather than all: the two sources are independent, and a
      // deployment whose canonical pools are not initialised makes the
      // liquidity read revert. Failing the whole query for that discarded
      // every position the wallet actually held.
      const [positions, liquidity] = await Promise.allSettled([
        loadPositionCatalog(publicClient, protocol, walletAddress),
        protocol.liquidity
          ? loadLiquidityCatalog(publicClient, protocol, walletAddress)
          : Promise.resolve(null),
      ]);

      // Positions are the load-bearing half. Only their failure is fatal.
      if (positions.status === "rejected") throw positions.reason;

      // Added collections are read independently of the Statics catalogs, so a
      // collection that misbehaves cannot take the positions down with it.
      const collectionResults = await Promise.allSettled(
        collections.map((collection) =>
          readCollectionHoldings(publicClient, collection, walletAddress)
        )
      );
      const collectionNfts = collectionResults.flatMap((result) =>
        result.status === "fulfilled" ? describeCollectionNfts(result.value) : []
      );

      return {
        nfts: collectWalletNfts({
          positions: positions.value.positions,
          liquidityPositions:
            liquidity.status === "fulfilled" ? (liquidity.value?.positions ?? []) : [],
          deployment: protocol,
          wallet: walletAddress,
        }).concat(collectionNfts),
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

  const header = (
    <div className="wallet-nft-heading">
      <div className="wallet-nft-collections">
        {collections.map((collection) => (
          <span key={collection.address} className="wallet-nft-chip">
            {collection.symbol}
            {collection.address.toLowerCase() !== canonicalGenesis?.toLowerCase() && (
              <button
                type="button"
                aria-label={`Remove ${collection.name}`}
                onClick={() => removeCollection(collection.address)}
              >
                ×
              </button>
            )}
          </span>
        ))}
      </div>
      <button
        type="button"
        className="wallet-nft-add"
        onClick={onAddCollection}
        disabled={collectionChainId === null}
      >
        Add collection
      </button>
    </div>
  );

  if (collectionChainId === null || !catalog.data || !isSurfaceReady(state)) {
    return (
      <>
        {header}
        <SurfaceEmptyState
          state={state}
          subject="NFTs"
          onRetry={() => void catalog.refetch()}
          empty={{
            title: "No NFTs yet",
            description:
              "Positions and liquidity positions appear here. Mint a basket or supply liquidity and the NFT that represents it shows up in your wallet.",
            action: { label: "Browse baskets", href: "/app/baskets" },
          }}
        />
      </>
    );
  }

  return (
    <>
      {header}
      {catalog.data.liquidityUnavailable && (
        <p className="dollar-warning" role="status">
          Liquidity positions could not be read on this network, so only positions are listed.
        </p>
      )}
      <WalletNftList nfts={catalog.data.nfts} chainId={collectionChainId} onTransfer={onTransfer} />
    </>
  );
}
