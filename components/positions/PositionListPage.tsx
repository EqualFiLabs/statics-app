"use client";

import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { decodeFunctionResult, formatUnits, getAddress } from "viem";
import { usePublicClient, useWalletClient } from "wagmi";
import { useState } from "react";

import { buildCreatePositionCall, staticsAbi } from "@statics-protocol/sdk";

import { SurfaceEmptyState } from "@/components/common/EmptyState";
import { PositionCollateralSummary } from "@/components/positions/PositionCollateralSummary";
import { AddressDisplay } from "@/components/protocol/AddressDisplay";
import { PositionListPreview } from "@/components/preview/DappPreview";
import { deriveSurfaceState, isSurfaceReady } from "@/lib/surface-state";
import { dappPreviewEnabled } from "@/lib/dapp-preview";
import { readClientDollarDeployment, verifyDollarDeployment } from "@/lib/dollar/deployment";
import { describePositionError, loadPositionCatalog } from "@/lib/positions/positions";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { useWalletState } from "@/providers/wallet-context";

const deploymentState = readClientDollarDeployment();

function displayAmount(value: bigint, decimals = 18): string {
  const [whole, fraction = ""] = formatUnits(value, decimals).split(".");
  const shortFraction = fraction.slice(0, 4).replace(/0+$/, "");
  return shortFraction ? `${whole}.${shortFraction}` : whole;
}

export function PositionListPage() {
  const wallet = useWalletState();
  if (dappPreviewEnabled) {
    return <PositionListPreview />;
  }
  if (wallet.status === "unconfigured") return <PositionListPreview />;
  return <PositionListRuntime />;
}

function PositionListRuntime() {
  const walletState = useWalletState();
  const publicClient = usePublicClient();
  const walletClient = useWalletClient();
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const catalog = useQuery({
    queryKey: [
      "position-catalog",
      deploymentState.status === "configured"
        ? deploymentState.deployment.protocolCommit
        : "unconfigured",
      wallet,
    ],
    enabled:
      deploymentState.status === "configured" &&
      Boolean(publicClient) &&
      Boolean(wallet) &&
      walletState.status === "ready" &&
      walletState.isTargetChain,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!publicClient || !wallet || deploymentState.status !== "configured") {
        throw new Error("No verified Statics deployment is configured.");
      }
      await verifyDollarDeployment(publicClient, deploymentState.deployment);
      return loadPositionCatalog(publicClient, deploymentState.deployment, wallet);
    },
  });

  const createPosition = async () => {
    if (!wallet || !publicClient || !walletClient.data || deploymentState.status !== "configured") {
      return;
    }
    setPending(true);
    setActionError(null);
    try {
      const data = buildCreatePositionCall(wallet);
      await executeProtocolTransaction({
        publicClient,
        wallet,
        chainId: deploymentState.deployment.chainId,
        kind: "create-position",
        label: "Create position",
        amount: "1 position",
        to: deploymentState.deployment.contracts.diamond,
        data,
        sendTransaction: ({ to, data: transactionData, value }) =>
          walletClient.data.sendTransaction({
            account: wallet,
            chain: walletClient.data.chain,
            to,
            data: transactionData,
            value,
          }),
        describeError: describePositionError,
        validateSimulation: (result) => {
          if (!result) throw new Error("The position simulation returned no token ID.");
          const positionId = decodeFunctionResult({
            abi: staticsAbi,
            functionName: "createPosition",
            data: result,
          });
          if (positionId === 0n) throw new Error("The position simulation returned an invalid ID.");
        },
      });
      await catalog.refetch();
    } catch (error) {
      setActionError(describePositionError(error));
    } finally {
      setPending(false);
    }
  };

  // Only a missing deployment falls back to the sample preview now. Signed
  // out, loading and failed each get their own message, because rendering the
  // em-dash preview for all three told a first-time visitor nothing.
  if (deploymentState.status === "unavailable") {
    return <PositionListPreview />;
  }

  const surfaceState = deriveSurfaceState({
    walletStatus: walletState.status,
    isTargetChain: walletState.isTargetChain,
    isLoading: catalog.isPending,
    isError: catalog.isError,
    isEmpty: (catalog.data?.positions.length ?? 0) === 0,
    hasData: Boolean(catalog.data),
  });

  let primaryLabel = "Create position";
  let primaryAction: (() => void) | null = () => void createPosition();
  if (walletState.status === "signed-out" || walletState.status === "error") {
    primaryLabel = "Sign in to continue";
    primaryAction = walletState.login;
  } else if (walletState.status === "wallet-missing") {
    primaryLabel = "Create embedded wallet";
    primaryAction = () => void walletState.createWallet();
  } else if (walletState.status === "ready" && !walletState.isTargetChain) {
    primaryLabel = `Switch to ${walletState.networkName}`;
    primaryAction = () => void walletState.switchNetwork();
  } else if (walletState.status !== "ready") {
    primaryLabel = "Wallet loading…";
    primaryAction = null;
  }

  return (
    <section className="position-catalog" aria-labelledby="position-catalog-title">
      <div className="position-section-heading">
        <div>
          <p className="dapp-section-label">Positions</p>
          <h2 id="position-catalog-title">Your positions</h2>
          <p>
            A position holds your collateral, staking, rewards, loans, and liquidity together. Move
            the position and everything inside it moves with it.
          </p>
        </div>
        <button
          className="dollar-submit"
          type="button"
          onClick={primaryAction ?? undefined}
          disabled={pending || primaryAction === null}
        >
          {pending ? "Creating position…" : primaryLabel}
        </button>
      </div>

      {actionError && (
        <p className="dapp-inline-error" role="alert">
          {actionError}
        </p>
      )}

      {catalog.isError && catalog.data && (
        <p className="dollar-warning" role="status">
          Position data is temporarily unavailable. Showing the last received state.
        </p>
      )}
      {!catalog.data || !isSurfaceReady(surfaceState) ? (
        <SurfaceEmptyState
          state={surfaceState}
          subject="positions"
          onRetry={() => void catalog.refetch()}
          empty={{
            title: "You do not have any positions yet",
            description:
              "A position is where your baskets, loans, and Dollar live together. Create an empty one to start, or one will be created for you the first time you deposit.",
            action: {
              label: pending ? "Creating…" : "Create position",
              onClick: () => void createPosition(),
              disabled: pending,
            },
            secondary: { label: "Browse baskets", href: "/app/baskets" },
          }}
        />
      ) : (
        <div className="position-grid">
          {catalog.data.positions.map((position) => (
            <article className="position-card" key={position.positionId.toString()}>
              <div>
                <Link href={`/app/positions/${position.positionId.toString()}`}>
                  Position #{position.positionId.toString()}
                </Link>
                <span>{position.activeLegCount.toString()} active legs</span>
              </div>
              <AddressDisplay
                address={position.owner}
                chainId={deploymentState.deployment.chainId}
                label="Owner"
              />
              <PositionCollateralSummary
                collateral={position.collateral}
                currentBlock={catalog.data.currentBlock}
                compact
              />
              <dl>
                <div>
                  <dt>Basket legs</dt>
                  <dd>{position.collateral.length}</dd>
                </div>
                <div>
                  <dt>Global stake</dt>
                  <dd>
                    {displayAmount(position.stakedBalance, catalog.data.stakingToken.decimals)}{" "}
                    {catalog.data.stakingToken.symbol}
                  </dd>
                </div>
                <div>
                  <dt>Reward selections</dt>
                  <dd>{position.selectedRewardAssets.length}</dd>
                </div>
              </dl>
              <Link
                className="position-card-link"
                href={`/app/positions/${position.positionId.toString()}`}
              >
                Manage position →
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
