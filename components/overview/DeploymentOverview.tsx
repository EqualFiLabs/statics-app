"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { formatEther } from "viem";
import { usePublicClient } from "wagmi";

import {
  genesisLaunchDistributorAbi,
  staticsFeeReceiverAbi,
  staticsGenesisVaultAbi,
  v4StateViewReadAbi,
} from "@statics-protocol/sdk";

import { DollarOverview } from "@/components/dollar/DollarPage";
import { EmptyState } from "@/components/common/EmptyState";
import { useDeployment } from "@/providers/deployment-context";
import type { LaunchDeployment } from "@/lib/deployments/types";
import { verifyLaunchDeployment } from "@/lib/deployments/verify-launch";

export function DeploymentOverview() {
  const { active } = useDeployment();
  if (active.deployment?.kind === "protocol") return <DollarOverview />;
  if (!active.deployment) {
    return (
      <div className="launch-overview">
        <EmptyState
          title="Mainnet launch is being prepared"
          description={
            active.descriptor.unavailableReason ?? "No reviewed deployment is available."
          }
        />
        <section className="ui-card launch-overview-actions">
          <p className="dapp-eyebrow">Available now</p>
          <h2>Test the complete protocol</h2>
          <p>
            Choose Robinhood Chain Testnet in the deployment selector to use Baskets, Dollar,
            Position NFTs, loans, liquidity, and protocol rewards while the standalone mainnet
            manifest remains intentionally disabled.
          </p>
        </section>
      </div>
    );
  }
  return <LaunchOverview deployment={active.deployment} />;
}

function LaunchOverview({ deployment }: { deployment: LaunchDeployment }) {
  const publicClient = usePublicClient({ chainId: deployment.descriptor.chainId });
  const metrics = useQuery({
    queryKey: ["launch-overview", deployment.descriptor.deploymentId],
    enabled: Boolean(publicClient),
    queryFn: async () => {
      if (!publicClient) throw new Error("Robinhood RPC is unavailable.");
      await verifyLaunchDeployment(publicClient, deployment);
      const [vault, totalWeight, harvestedStatics, harvestedWeth, liquidity] = await Promise.all([
        publicClient.readContract({
          address: deployment.contracts.vault,
          abi: staticsGenesisVaultAbi,
          functionName: "vaultAccounting",
        }),
        publicClient.readContract({
          address: deployment.contracts.launchDistributor,
          abi: genesisLaunchDistributorAbi,
          functionName: "totalWeight",
        }),
        publicClient.readContract({
          address: deployment.contracts.feeReceiver,
          abi: staticsFeeReceiverAbi,
          functionName: "cumulativeHarvested",
          args: [deployment.contracts.statics],
        }),
        publicClient.readContract({
          address: deployment.contracts.feeReceiver,
          abi: staticsFeeReceiverAbi,
          functionName: "cumulativeHarvested",
          args: [deployment.contracts.weth],
        }),
        publicClient.readContract({
          address: deployment.contracts.stateView,
          abi: v4StateViewReadAbi,
          functionName: "getLiquidity",
          args: [deployment.market.poolId],
        }),
      ]);
      return { vault, totalWeight, harvestedStatics, harvestedWeth, liquidity };
    },
  });
  return (
    <div className="launch-overview">
      <section className="ui-card launch-overview-hero">
        <p className="dapp-eyebrow">Statics Genesis · Robinhood Chain</p>
        <h2>Trade STATICS and acquire a fully backed Genesis NFT</h2>
        <p>
          The launch market discovers the STATICS price. Every Genesis NFT in circulation remains
          redeemable for its fixed STATICS backing, while registered holders share launch fees.
        </p>
        <div className="ui-inline-actions">
          <Link className="ui-button ui-button--primary" href="/app/trade">
            Buy STATICS
          </Link>
          <Link className="ui-button ui-button--secondary" href="/app/genesis">
            Explore Genesis
          </Link>
        </div>
      </section>
      <section className="genesis-summary ui-card">
        <div className="ui-stat">
          <span className="ui-stat__label">Vault inventory</span>
          <strong className="ui-stat__value">
            {metrics.data?.vault.vaultInventory.toString() ?? "—"}
          </strong>
        </div>
        <div className="ui-stat">
          <span className="ui-stat__label">Genesis in circulation</span>
          <strong className="ui-stat__value">
            {metrics.data?.vault.circulatingGenesis.toString() ?? "—"}
          </strong>
        </div>
        <div className="ui-stat">
          <span className="ui-stat__label">Registered reward weight</span>
          <strong className="ui-stat__value">{metrics.data?.totalWeight.toString() ?? "—"}</strong>
        </div>
        <div className="ui-stat">
          <span className="ui-stat__label">Market liquidity</span>
          <strong className="ui-stat__value">{metrics.data?.liquidity ? "Active" : "—"}</strong>
        </div>
        <div className="ui-stat">
          <span className="ui-stat__label">Fees harvested</span>
          <strong className="ui-stat__value">
            {metrics.data
              ? `${formatEther(metrics.data.harvestedStatics)} STATICS · ${formatEther(metrics.data.harvestedWeth)} WETH`
              : "—"}
          </strong>
        </div>
      </section>
      {metrics.error && (
        <p className="dapp-inline-error" role="alert">
          Launch metrics are temporarily unavailable. Trading and Vault actions remain independently
          verifiable onchain.
        </p>
      )}
    </div>
  );
}
