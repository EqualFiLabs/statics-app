"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getAddress, type Address } from "viem";
import { usePublicClient } from "wagmi";

import { dopplerStaticsTokenAbi, v4StateViewReadAbi } from "@statics-protocol/sdk";
import { GENESIS_MAX_CREDIT_PRINCIPAL } from "@statics-protocol/sdk/genesis-credit";

import { EmptyState } from "@/components/common/EmptyState";
import { DollarOverview } from "@/components/dollar/DollarPage";
import { EpochBanner, type EpochQuotes } from "@/components/overview/EpochBanner";
import { VaultSolvency } from "@/components/overview/VaultSolvency";
import type { LaunchDeployment } from "@/lib/deployments/types";
import { verifyLaunchDeployment } from "@/lib/deployments/verify-launch";
import { currentGenesisVaultAbi } from "@/lib/genesis/current-vault";
import { genesisAcquisitionCost, genesisBackingInNumeraire } from "@/lib/genesis/market-value";
import {
  EMPTY_GENESIS_PORTFOLIO,
  loadOwnedGenesis,
  ownedGenesisQueryKey,
  summariseGenesisRewards,
} from "@/lib/genesis/owned";
import { formatTokenAmountGrouped } from "@/lib/protocol/ux";
import { useDeployment } from "@/providers/deployment-context";
import { useWalletState } from "@/providers/wallet-context";

const Q192 = 1n << 192n;
const PRICE_DECIMALS = 8;

/** Genesis held by the treasury at launch, StaticsGenesisVault.INITIAL_TREASURY_GENESIS. */
const TREASURY_GENESIS = 555n;

/** A whole-unit count -- NFTs, not token amounts -- with thousands separators. */
function count(value: bigint): string {
  return formatTokenAmountGrouped(value, 0, 0);
}

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
            The same Operators launch application will be enabled here after its reviewed manifest
            is published.
          </p>
        </section>
      </div>
    );
  }
  return <LaunchOverview deployment={active.launch} />;
}

function LaunchOverview({ deployment }: { deployment: LaunchDeployment }) {
  const publicClient = usePublicClient({ chainId: deployment.descriptor.chainId });
  const walletState = useWalletState();
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;

  const metrics = useQuery({
    queryKey: ["launch-overview", deployment.descriptor.deploymentId, wallet],
    enabled: Boolean(publicClient),
    queryFn: async () => {
      if (!publicClient) throw new Error("The deployment RPC is unavailable.");
      await verifyLaunchDeployment(publicClient, deployment);
      const [vault, purchase, redemption, slot0, liquidity, staticsBalance] = await Promise.all([
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
        wallet
          ? publicClient.readContract({
              address: deployment.contracts.statics,
              abi: dopplerStaticsTokenAbi,
              functionName: "balanceOf",
              args: [wallet],
            })
          : 0n,
      ]);
      return { vault, purchase, redemption, sqrtPriceX96: slot0[0], liquidity, staticsBalance };
    },
  });

  // Same key and fetcher My Operators mounts, so the two surfaces share one walk
  // of the wallet rather than each paying for it.
  const portfolio = useQuery({
    queryKey: ownedGenesisQueryKey(deployment.descriptor.deploymentId, wallet),
    enabled: Boolean(publicClient && wallet),
    queryFn: async () => {
      if (!publicClient || !wallet) return EMPTY_GENESIS_PORTFOLIO;
      return loadOwnedGenesis(publicClient, deployment, wallet);
    },
  });

  const vault = metrics.data?.vault ?? null;
  const rewards = summariseGenesisRewards(portfolio.data ?? EMPTY_GENESIS_PORTFOLIO);
  const genesisHeld = portfolio.data?.items.length ?? 0;

  // The reserve grows on every acquisition fee whether or not the Epoch has
  // ended, so the buy-in owed at the boundary is always derivable -- and always
  // rising. Quoting zero during the Epoch would read as a settled future price.
  const reserveETH = vault?.reserveETH ?? 0n;
  const projectedBuyIn = reserveETH > 0n ? (reserveETH + 5_553n) / 5_554n : 0n; // ceil(R / 5,554)
  const projectedPayout = reserveETH > 0n ? reserveETH / 5_555n : 0n; // floor(R / 5,555)

  const quotes: EpochQuotes | null =
    metrics.data && vault
      ? {
          staticsPrice: metrics.data.purchase.staticsPrice,
          reserveBuyIn: metrics.data.purchase.reserveBuyIn,
          nativeFee: metrics.data.purchase.nativeFee,
          reservePayout: metrics.data.redemption.reservePayout,
          projectedBuyIn,
          projectedPayout,
          maxCredit: GENESIS_MAX_CREDIT_PRINCIPAL,
        }
      : null;

  const backingAtMarket = metrics.data
    ? genesisBackingInNumeraire(
        metrics.data.sqrtPriceX96,
        deployment.market.poolKey.currency0,
        deployment.contracts.statics,
        metrics.data.purchase.staticsPrice
      )
    : null;
  const allInCost = metrics.data
    ? genesisAcquisitionCost(backingAtMarket, metrics.data.purchase.requiredNative)
    : null;

  const marketPrice = metrics.data
    ? formatCanonicalMarketPrice(
        metrics.data.sqrtPriceX96,
        deployment.market.poolKey.currency0,
        deployment.contracts.statics
      )
    : null;

  const circulating = vault?.circulatingGenesis ?? 0n;
  const inventory = vault?.vaultInventory ?? 0n;
  const supply = vault?.maximumSupply ?? 0n;
  const heldByMarket = circulating > TREASURY_GENESIS ? circulating - TREASURY_GENESIS : 0n;
  const share = (count: bigint) =>
    supply > 0n ? `${(Number(count) / Number(supply)) * 100}%` : "0%";

  return (
    <div className="launch-overview">
      <EpochBanner
        chainId={deployment.descriptor.chainId}
        epochActive={vault?.epochActive ?? true}
        epochEnd={Number(vault?.genesisEpochEnd ?? 0n)}
        quotes={quotes}
      />

      <div className="launch-actions">
        <Link className="ui-button ui-button--primary" href="/app/swap?mode=nft">
          Acquire Operators
          <small>
            {metrics.data
              ? `${formatTokenAmountGrouped(metrics.data.purchase.staticsPrice, 18, 0)} STATICS + ${formatTokenAmountGrouped(metrics.data.purchase.requiredNative, 18, 5)} ETH`
              : "—"}
          </small>
        </Link>
        <Link className="ui-button ui-button--secondary" href="/app/swap">
          Buy STATICS
        </Link>
        {genesisHeld > 0 && (
          <Link className="ui-button ui-button--secondary" href="/app/genesis">
            {`Manage my ${genesisHeld} Genesis`}
          </Link>
        )}
        {vault?.epochActive === false && (
          <Link className="ui-button ui-button--secondary" href="/app/genesis/recoveries">
            Recover matured credit
          </Link>
        )}
      </div>

      {wallet ? (
        <section className="ui-card launch-position" aria-label="Your position">
          <div className="ui-stat">
            <span className="ui-stat__label">Your STATICS</span>
            <strong className="ui-stat__value">
              {metrics.data ? formatTokenAmountGrouped(metrics.data.staticsBalance, 18, 2) : "—"}
            </strong>
          </div>
          <div className="ui-stat">
            <span className="ui-stat__label">Your Operators</span>
            <strong className="ui-stat__value">{portfolio.isLoading ? "—" : genesisHeld}</strong>
            <small>
              {genesisHeld > 0 && vault
                ? `${formatTokenAmountGrouped(vault.vaultPrice * BigInt(genesisHeld), 18, 0)} STATICS backing`
                : "None held"}
            </small>
          </div>
          <div className="ui-stat">
            <span className="ui-stat__label">Claimable</span>
            <strong className="ui-stat__value is-accent">
              {formatTokenAmountGrouped(rewards.claimableStatics, 18, 2)} STATICS
            </strong>
            <small>{formatTokenAmountGrouped(rewards.claimableWeth, 18, 4)} WETH</small>
          </div>
          {/* Names its destination, not an action: claiming is one transaction
              per NFT and asset, and My Operators is where that sequence is priced
              honestly. Revisit when the batch claim entry point lands. */}
          <Link className="ui-button ui-button--secondary" href="/app/genesis">
            Open My Operators
          </Link>
        </section>
      ) : (
        <section className="ui-card launch-position is-signed-out" aria-label="Your position">
          <div>
            <strong>Connect to see where you stand</strong>
            <p>Your STATICS, the Genesis you hold, and anything waiting to be claimed.</p>
          </div>
          <button
            className="ui-button ui-button--primary"
            type="button"
            onClick={walletState.status === "signed-out" ? walletState.login : undefined}
            disabled={walletState.status !== "signed-out"}
          >
            Connect wallet
          </button>
        </section>
      )}

      <div className="launch-duo">
        <section className="ui-card overview-panel" aria-label="Operators supply">
          <div className="overview-panel-head">
            <h3>Supply</h3>
            <span>Fixed at {count(supply)}</span>
          </div>
          <p className="overview-figure">
            <b>{count(inventory)}</b>
            <span>still in the Vault</span>
          </p>
          <div className="supply-bar" aria-hidden="true">
            <i className="is-treasury" style={{ width: share(TREASURY_GENESIS) }} />
            <i className="is-circulating" style={{ width: share(heldByMarket) }} />
            <i className="is-inventory" style={{ width: share(inventory) }} />
          </div>
          <dl className="supply-key">
            <div>
              <dt>
                <i className="is-treasury" aria-hidden="true" />
                Treasury at launch
              </dt>
              <dd>{count(TREASURY_GENESIS)}</dd>
            </div>
            <div>
              <dt>
                <i className="is-circulating" aria-hidden="true" />
                Held by the market
              </dt>
              <dd>{count(heldByMarket)}</dd>
            </div>
            <div>
              <dt>
                <i className="is-inventory" aria-hidden="true" />
                Vault inventory
              </dt>
              <dd>{count(inventory)}</dd>
            </div>
          </dl>
        </section>

        <section className="ui-card overview-panel" aria-label="STATICS market">
          <div className="overview-panel-head">
            <h3>Market</h3>
            <span>{metrics.data?.liquidity ? "Liquidity active" : "No active liquidity"}</span>
          </div>
          <p className="overview-figure">
            <b>{marketPrice?.value ?? "—"}</b>
            <span>{marketPrice?.unit ?? "WETH per STATICS"}</span>
          </p>
          <dl className="overview-rows">
            <div>
              <dt>
                {vault ? formatTokenAmountGrouped(vault.vaultPrice, 18, 0) : "—"} STATICS at market
              </dt>
              <dd>
                {backingAtMarket !== null
                  ? `${formatTokenAmountGrouped(backingAtMarket, 18, 4)} WETH`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Reserve share per Operator</dt>
              <dd>
                {vault
                  ? `${formatTokenAmountGrouped(vault.reserveBackingPerGenesis, 18, 6)} WETH`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>
                {vault?.epochActive ? "Buy-in if the Epoch ended now" : "Buy-in charged today"}
              </dt>
              <dd>{`${formatTokenAmountGrouped(projectedBuyIn, 18, 5)} WETH`}</dd>
            </div>
            <div className="is-total">
              <dt>An Operator costs you, all in (WETH-equivalent)</dt>
              <dd>
                {allInCost !== null
                  ? `${formatTokenAmountGrouped(allInCost, 18, 4)} WETH-equivalent`
                  : "—"}
              </dd>
            </div>
          </dl>
          <p className="overview-note">
            {vault?.epochActive ? (
              <>
                <b>No buy-in is charged yet, but it is already accruing.</b> Every sale adds its
                acquisition fee to the reserve, so the buy-in owed the moment the Epoch ends rises
                with each one.
              </>
            ) : (
              <>
                <b>The reserve compounds.</b> Each acquisition returns its own buy-in to the
                reserve, so the buy-in climbs with every sale. Redemption pays out over 5,555 while
                buy-in divides by 5,554, and both round toward the reserve — so the share held by
                everyone still holding only grows.
              </>
            )}
          </p>
        </section>
      </div>

      <VaultSolvency
        figures={
          vault
            ? {
                circulatingGenesis: vault.circulatingGenesis,
                vaultPrice: vault.vaultPrice,
                grossBacking: vault.grossBacking,
                outstandingGenesisCredit: vault.outstandingGenesisCredit,
                requiredBacking: vault.requiredBacking,
                tokenBacking: vault.tokenBacking,
                tokenCustody: vault.tokenCustody,
                reserveETH: vault.reserveETH,
                nativeCustody: vault.nativeCustody,
              }
            : null
        }
      />

      {metrics.error && (
        <p className="dapp-inline-error" role="alert">
          Launch metrics are temporarily unavailable. Trading and Vault actions remain independently
          verifiable onchain.
        </p>
      )}
    </div>
  );
}
