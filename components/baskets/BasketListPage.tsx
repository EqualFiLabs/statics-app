"use client";

import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { formatUnits, getAddress } from "viem";
import { usePublicClient } from "wagmi";

import { basketStatusLabel, describeBasketError, loadBasketCatalog } from "@/lib/baskets/baskets";
import { BasketListPreview } from "@/components/preview/DappPreview";
import { dappPreviewEnabled } from "@/lib/dapp-preview";
import { readClientDollarDeployment, verifyDollarDeployment } from "@/lib/dollar/deployment";
import { useWalletState } from "@/providers/wallet-context";

const deploymentState = readClientDollarDeployment();

function displayAmount(value: bigint, decimals = 18): string {
  const [whole, fraction = ""] = formatUnits(value, decimals).split(".");
  const shortFraction = fraction.slice(0, 4).replace(/0+$/, "");
  return shortFraction ? `${whole}.${shortFraction}` : whole;
}

export function BasketListPage() {
  const wallet = useWalletState();
  if (dappPreviewEnabled) {
    return <BasketListPreview />;
  }
  if (wallet.status === "unconfigured") {
    return (
      <section className="dollar-unavailable">
        <p className="dapp-section-label">Wallet runtime unavailable</p>
        <h2>Configure Privy to inspect the local basket deployment.</h2>
      </section>
    );
  }
  return <BasketListRuntime />;
}

function BasketListRuntime() {
  const wallet = useWalletState();
  const publicClient = usePublicClient();
  const walletAddress =
    wallet.status === "ready" && wallet.address ? getAddress(wallet.address) : null;
  const catalog = useQuery({
    queryKey: [
      "basket-catalog",
      deploymentState.status === "configured"
        ? deploymentState.deployment.protocolCommit
        : "unconfigured",
      walletAddress,
    ],
    enabled: deploymentState.status === "configured" && Boolean(publicClient),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!publicClient || deploymentState.status !== "configured") {
        throw new Error("No verified Statics deployment is configured.");
      }
      await verifyDollarDeployment(publicClient, deploymentState.deployment);
      return loadBasketCatalog(publicClient, deploymentState.deployment, walletAddress);
    },
  });

  if (deploymentState.status === "unavailable") {
    return (
      <section className="dollar-unavailable">
        <p className="dapp-section-label">Baskets unavailable</p>
        <h2>No verified local protocol deployment is configured.</h2>
        <p>{deploymentState.reason}</p>
      </section>
    );
  }
  if (catalog.isPending) return <p className="dollar-loading">Discovering baskets…</p>;
  if (catalog.isError) {
    return (
      <p className="dapp-inline-error" role="alert">
        {describeBasketError(catalog.error)}
      </p>
    );
  }

  return (
    <section className="basket-catalog" aria-labelledby="basket-catalog-title">
      <div className="basket-section-heading">
        <div>
          <p className="dapp-section-label">Event-discovered · chain-reconciled</p>
          <h2 id="basket-catalog-title">Statics baskets</h2>
        </div>
        <div className="basket-section-actions">
          <span>{catalog.data.baskets.length} discovered</span>
          <button type="button" disabled>
            Basket creation · Planned
          </button>
        </div>
      </div>
      {catalog.data.warning && (
        <p className="dollar-warning" role="status">
          {catalog.data.warning}
        </p>
      )}
      {catalog.data.baskets.length === 0 ? (
        <div className="basket-empty">
          <h3>No baskets have been created on this deployment.</h3>
          <p>Run the local protocol deployment command to seed the reviewed fixture.</p>
        </div>
      ) : (
        <div className="basket-grid">
          {catalog.data.baskets.map((basket) => (
            <Link
              key={basket.basketId.toString()}
              className="basket-card"
              href={`/app/baskets/${basket.basketId.toString()}`}
            >
              <div>
                <span className={`basket-status is-${basket.status}`}>
                  {basketStatusLabel(basket.status)}
                </span>
                <span>#{basket.basketId.toString()}</span>
              </div>
              <h3>{basket.name}</h3>
              <p>{basket.symbol}</p>
              <dl>
                <div>
                  <dt>Constituents</dt>
                  <dd>{basket.constituents.length}</dd>
                </div>
                <div>
                  <dt>Total supply</dt>
                  <dd>{displayAmount(basket.totalSupply)}</dd>
                </div>
                <div>
                  <dt>Your balance</dt>
                  <dd>{walletAddress ? displayAmount(basket.walletBalance) : "Connect"}</dd>
                </div>
              </dl>
              <span className="basket-card-link">Inspect basket →</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
