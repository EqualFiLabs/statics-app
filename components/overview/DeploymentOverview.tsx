"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { formatEther, getAddress, type Address } from "viem";
import { usePublicClient } from "wagmi";

import { dopplerStaticsTokenAbi, v4StateViewReadAbi } from "@statics-protocol/sdk";

import { EmptyState } from "@/components/common/EmptyState";
import { DollarOverview } from "@/components/dollar/DollarPage";
import type { LaunchDeployment } from "@/lib/deployments/types";
import { verifyLaunchDeployment } from "@/lib/deployments/verify-launch";
import { currentGenesisVaultAbi } from "@/lib/genesis/current-vault";
import { useDeployment } from "@/providers/deployment-context";
import { useWalletState } from "@/providers/wallet-context";

const Q192 = 1n << 192n;
const PRICE_DECIMALS = 8;

function decimalFromScaled(value: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = (value % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function formatCanonicalMarketPrice(
  sqrtPriceX96: bigint,
  currency0: Address,
  statics: Address
): { value: string; unit: "WETH per STATICS" | "STATICS per WETH" } {
  const scaledPrice = (sqrtPriceX96 * sqrtPriceX96 * 10n ** BigInt(PRICE_DECIMALS)) / Q192;
  return {
    value: decimalFromScaled(scaledPrice, PRICE_DECIMALS),
    unit:
      currency0.toLowerCase() === statics.toLowerCase() ? "WETH per STATICS" : "STATICS per WETH",
  };
}

export function DeploymentOverview() {
  const { active } = useDeployment();
  if (active.protocol) return <DollarOverview deployment={active.protocol.protocol} />;
  if (!active.launch) {
    return (
      <div className="launch-overview">
        <EmptyState
          title="Mainnet launch is being prepared"
          description={
            active.descriptor.unavailableReason ?? "No reviewed deployment is available."
          }
        />
        <section className="ui-card launch-overview-actions">
          <p className="dapp-eyebrow">Selected network</p>
          <h2>{active.descriptor.network}</h2>
          <p>
            The same Genesis launch application will be enabled here after its reviewed manifest is
            published.
          </p>
        </section>
      </div>
    );
  }
  return <LaunchOverview deployment={active.launch} />;
}

function LaunchOverview({ deployment }: { deployment: LaunchDeployment }) {
  const publicClient = usePublicClient({ chainId: deployment.descriptor.chainId });
  const locale = useLocale();
  const walletState = useWalletState();
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;
  const metrics = useQuery({
    queryKey: ["launch-overview", deployment.descriptor.deploymentId, wallet],
    enabled: Boolean(publicClient),
    queryFn: async () => {
      if (!publicClient) throw new Error("Robinhood RPC is unavailable.");
      await verifyLaunchDeployment(publicClient, deployment);
      const [vault, slot0, liquidity, staticsBalance] = await Promise.all([
        publicClient.readContract({
          address: deployment.contracts.vault,
          abi: currentGenesisVaultAbi,
          functionName: "vaultAccounting",
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
        wallet
          ? publicClient.readContract({
              address: deployment.contracts.statics,
              abi: dopplerStaticsTokenAbi,
              functionName: "balanceOf",
              args: [wallet],
            })
          : 0n,
      ]);
      return { vault, sqrtPriceX96: slot0[0], liquidity, staticsBalance };
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
          <Link className="ui-button ui-button--primary" href="/app/swap">
            Buy STATICS
          </Link>
          <Link className="ui-button ui-button--secondary" href="/app/swap?mode=nft">
            Acquire Genesis
          </Link>
          <Link className="ui-button ui-button--secondary" href="/app/genesis">
            Manage my Genesis
          </Link>
        </div>
      </section>
      <section className="genesis-summary ui-card">
        <div className="ui-stat">
          <span className="ui-stat__label">Genesis Epoch</span>
          <strong className="ui-stat__value">
            {metrics.data
              ? metrics.data.vault.epochActive
                ? `Active until ${new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(Number(metrics.data.vault.genesisEpochEnd) * 1_000))}`
                : "Complete"
              : "—"}
          </strong>
        </div>
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
          <span className="ui-stat__label">STATICS backing</span>
          <strong className="ui-stat__value">
            {metrics.data
              ? `${formatEther(metrics.data.vault.tokenBacking)} / ${formatEther(metrics.data.vault.requiredBacking)} STATICS`
              : "—"}
          </strong>
        </div>
        <div className="ui-stat">
          <span className="ui-stat__label">Native reserve</span>
          <strong className="ui-stat__value">
            {metrics.data ? `${formatEther(metrics.data.vault.reserveETH)} ETH` : "—"}
          </strong>
        </div>
        <div className="ui-stat">
          <span className="ui-stat__label">Reserve backing per Genesis</span>
          <strong className="ui-stat__value">
            {metrics.data ? `${formatEther(metrics.data.vault.reserveBackingPerGenesis)} ETH` : "—"}
          </strong>
        </div>
        <div className="ui-stat">
          <span className="ui-stat__label">STATICS/WETH market price</span>
          <strong className="ui-stat__value">
            {metrics.data
              ? (() => {
                  const price = formatCanonicalMarketPrice(
                    metrics.data.sqrtPriceX96,
                    deployment.market.poolKey.currency0,
                    deployment.contracts.statics
                  );
                  return `${price.value} ${price.unit}`;
                })()
              : "—"}
          </strong>
          <span>
            {metrics.data?.liquidity ? "Canonical liquidity active" : "No active liquidity"}
          </span>
        </div>
        <div className="ui-stat">
          <span className="ui-stat__label">Your STATICS</span>
          <strong className="ui-stat__value">
            {wallet && metrics.data ? formatEther(metrics.data.staticsBalance) : "—"}
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
