"use client";

import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { decodeFunctionResult, formatUnits, getAddress } from "viem";
import { usePublicClient, useWalletClient } from "wagmi";
import { useState } from "react";

import { buildCreatePositionCall, staticsAbi } from "@statics-protocol/sdk";

import { AddressDisplay } from "@/components/protocol/AddressDisplay";
import { PositionListPreview } from "@/components/preview/DappPreview";
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
  if (wallet.status === "unconfigured") {
    return (
      <section className="dollar-unavailable">
        <p className="dapp-section-label">Wallet runtime unavailable</p>
        <h2>Configure Privy to inspect local PositionNFTs.</h2>
      </section>
    );
  }
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
        label: "Create PositionNFT",
        amount: "1 PositionNFT",
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

  if (deploymentState.status === "unavailable") {
    return (
      <section className="dollar-unavailable">
        <p className="dapp-section-label">Positions unavailable</p>
        <h2>No verified local protocol deployment is configured.</h2>
      </section>
    );
  }

  let primaryLabel = "Create PositionNFT";
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
          <p className="dapp-section-label">Event-discovered · ownership-reconciled</p>
          <h2 id="position-catalog-title">Your PositionNFTs</h2>
          <p>
            Each NFT carries every attached collateral, staking, reward, loan, and liquidity leg
            when transferred.
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

      {catalog.isPending && wallet ? (
        <p className="dollar-loading">Reconciling PositionNFT ownership…</p>
      ) : catalog.isError ? (
        <p className="dapp-inline-error" role="alert">
          {describePositionError(catalog.error)}
        </p>
      ) : !catalog.data || catalog.data.positions.length === 0 ? (
        <div className="position-empty">
          <h3>No PositionNFT is owned by this wallet.</h3>
          <p>Create an empty position, or create one atomically from collateral or staking.</p>
        </div>
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
              <dl>
                <div>
                  <dt>Basket collateral</dt>
                  <dd>{position.collateral.length} baskets</dd>
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
