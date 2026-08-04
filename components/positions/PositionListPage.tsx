"use client";

import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { decodeFunctionResult, formatEther, formatUnits, getAddress } from "viem";
import { usePublicClient } from "wagmi";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { buildCreatePositionCall, staticsAbi } from "@statics-protocol/sdk";

import { SurfaceEmptyState, UnconfiguredSurface } from "@/components/common/EmptyState";
import { PositionCollateralSummary } from "@/components/positions/PositionCollateralSummary";
import { AddressDisplay } from "@/components/protocol/AddressDisplay";
import { deriveSurfaceState, isSurfaceReady } from "@/lib/surface-state";
import { readClientDollarDeployment, verifyDollarDeployment } from "@/lib/dollar/deployment";
import { describePositionError, loadPositionCatalog } from "@/lib/positions/positions";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { protocolQueryKeys } from "@/lib/protocol/query-keys";
import { useActiveWalletClient, useWalletState } from "@/providers/wallet-context";

const deploymentState = readClientDollarDeployment();

function displayAmount(value: bigint, decimals = 18): string {
  const [whole, fraction = ""] = formatUnits(value, decimals).split(".");
  const shortFraction = fraction.slice(0, 4).replace(/0+$/, "");
  return shortFraction ? `${whole}.${shortFraction}` : whole;
}

export function PositionListPage() {
  const t = useTranslations("positions");
  const wallet = useWalletState();
  if (wallet.status === "unconfigured") return <UnconfiguredSurface subject={t("subject")} />;
  return <PositionListRuntime />;
}

function PositionListRuntime() {
  const t = useTranslations("positions");
  const walletState = useWalletState();
  const publicClient = usePublicClient();
  const walletClient = useActiveWalletClient();
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const catalog = useQuery({
    queryKey: protocolQueryKeys.positionCatalog(
      deploymentState.status === "configured"
        ? deploymentState.deployment.protocolCommit
        : undefined,
      wallet
    ),
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
    if (
      !wallet ||
      !publicClient ||
      !walletClient.data ||
      !catalog.data ||
      deploymentState.status !== "configured"
    ) {
      return;
    }
    setPending(true);
    setActionError(null);
    try {
      const refreshed = await catalog.refetch();
      if (!refreshed.data) throw new Error("The current Position fee is unavailable.");
      const creationFee = refreshed.data.positionCreationFee;
      const data = buildCreatePositionCall(wallet);
      await executeProtocolTransaction({
        publicClient,
        wallet,
        chainId: deploymentState.deployment.chainId,
        kind: "create-position",
        label: "Create position",
        amount: `${formatEther(creationFee)} ETH account fee`,
        to: deploymentState.deployment.contracts.diamond,
        data,
        value: creationFee,
        sendTransaction: ({ to, data: transactionData, value }) =>
          walletClient.data!.sendTransaction({
            account: wallet,
            chain: walletClient.data!.chain,
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
      <SurfaceEmptyState
        state="unconfigured"
        subject={t("subject")}
        empty={{ title: t("emptyTitle"), description: t("emptyDescription") }}
      />
    );
  }

  const surfaceState = deriveSurfaceState({
    walletStatus: walletState.status,
    isTargetChain: walletState.isTargetChain,
    isLoading: catalog.isPending,
    isError: catalog.isError,
    isEmpty: (catalog.data?.positions.length ?? 0) === 0,
    hasData: Boolean(catalog.data),
  });

  let primaryLabel = t("create");
  let primaryAction: (() => void) | null = () => void createPosition();
  if (walletState.status === "disconnected" || walletState.status === "error") {
    primaryLabel = t("signIn");
    primaryAction = walletState.connectWallet;
  } else if (walletState.status === "ready" && !walletState.isTargetChain) {
    primaryLabel = t("switchNetwork", { network: walletState.networkName });
    primaryAction = () => void walletState.switchNetwork();
  } else if (walletState.status !== "ready") {
    primaryLabel = t("walletLoading");
    primaryAction = null;
  }

  return (
    <section className="position-catalog" aria-labelledby="position-catalog-title">
      <div className="position-section-heading">
        <div>
          <p className="dapp-section-label">{t("subject")}</p>
          <h2 id="position-catalog-title">{t("title")}</h2>
          <p>{t("description")}</p>
          {catalog.data && (
            <small>
              {t("creationFee", { fee: formatEther(catalog.data.positionCreationFee) })}
            </small>
          )}
        </div>
        <button
          className="dollar-submit"
          type="button"
          onClick={primaryAction ?? undefined}
          disabled={pending || primaryAction === null}
        >
          {pending ? t("creatingPosition") : primaryLabel}
        </button>
      </div>

      {actionError && (
        <p className="dapp-inline-error" role="alert">
          {actionError}
        </p>
      )}

      {catalog.isError && catalog.data && (
        <p className="dollar-warning" role="status">
          {t("stale")}
        </p>
      )}
      {!catalog.data || !isSurfaceReady(surfaceState) ? (
        <SurfaceEmptyState
          state={surfaceState}
          subject={t("subject")}
          onRetry={() => void catalog.refetch()}
          empty={{
            title: t("emptyTitle"),
            description: t("emptyDescription"),
            action: {
              label: pending ? t("creating") : t("create"),
              onClick: () => void createPosition(),
              disabled: pending,
            },
            secondary: { label: t("browseBaskets"), href: "/app/baskets" },
          }}
        />
      ) : (
        <div className="position-grid">
          {catalog.data.positions.map((position) => (
            <article className="position-card" key={position.positionId.toString()}>
              <div>
                <Link href={`/app/positions/${position.positionId.toString()}`}>
                  {t("positionNumber", { id: position.positionId.toString() })}
                </Link>
                <span>{t("activeLegs", { count: position.activeLegCount.toString() })}</span>
              </div>
              <AddressDisplay
                address={position.owner}
                chainId={deploymentState.deployment.chainId}
                label={t("owner")}
              />
              <PositionCollateralSummary
                collateral={position.collateral}
                currentBlock={catalog.data.currentBlock}
                compact
              />
              <dl>
                <div>
                  <dt>{t("basketLegs")}</dt>
                  <dd>{position.collateral.length}</dd>
                </div>
                <div>
                  <dt>{t("globalStake")}</dt>
                  <dd>
                    {displayAmount(position.stakedBalance, catalog.data.stakingToken.decimals)}{" "}
                    {catalog.data.stakingToken.symbol}
                  </dd>
                </div>
                <div>
                  <dt>{t("rewardSelections")}</dt>
                  <dd>{position.selectedRewardAssets.length}</dd>
                </div>
              </dl>
              <Link
                className="position-card-link"
                href={`/app/positions/${position.positionId.toString()}`}
              >
                {t("manage")} →
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
