"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { formatUnits, getAddress, type Address } from "viem";
import { usePublicClient } from "wagmi";

import { dopplerStaticsTokenAbi, v4StateViewReadAbi } from "@statics-protocol/sdk";
import { GENESIS_MAX_CREDIT_PRINCIPAL } from "@statics-protocol/sdk/genesis-credit";

import { EmptyState } from "@/components/common/EmptyState";
import { DollarOverview } from "@/components/dollar/DollarPage";
import { EpochBanner, type EpochQuotes } from "@/components/overview/EpochBanner";
import { VaultSolvency } from "@/components/overview/VaultSolvency";
import type { LaunchDeployment } from "@/lib/deployments/types";
import { verifyLaunchDeploymentForRead } from "@/lib/deployments/verify-launch-read";
import { currentGenesisVaultAbi } from "@/lib/genesis/current-vault";
import { genesisAcquisitionCost, genesisBackingInNumeraire } from "@/lib/genesis/market-value";
import {
  EMPTY_GENESIS_PORTFOLIO,
  loadOwnedGenesis,
  ownedGenesisQueryKey,
  summariseGenesisRewards,
} from "@/lib/genesis/owned";
import { formatTokenAmountGrouped } from "@/lib/protocol/ux";
import { loadMarketOverview } from "@/lib/market/client";
import type { StaticsMarketOverview } from "@/lib/market/types";
import { ROBINHOOD_GENESIS_DEPLOYMENT_ID } from "@/lib/deployments/registry";
import { useDeployment } from "@/providers/deployment-context";
import { useWalletState } from "@/providers/wallet-context";

const Q192 = 1n << 192n;
const WETH_PER_STATICS_DECIMALS = 8;
const STATICS_PER_WETH_DECIMALS = 4;

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

function compactWad(value: string): string {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 2 }).format(
    Number(formatUnits(BigInt(value), 18))
  );
}

function usdWad(value: string | null, price = false): string {
  if (value === null) return "—";
  const amount = Number(formatUnits(BigInt(value), 18));
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    notation: price ? "standard" : "compact",
    minimumFractionDigits: price && amount >= 0.01 ? 2 : 0,
    maximumFractionDigits: price ? (amount < 0.01 ? 8 : 4) : 2,
  }).format(amount);
}

function volumeUsd(data: StaticsMarketOverview): string | null {
  if (data.price.ethUsdWad === null) return null;
  return (
    (BigInt(data.activity24h.wethVolume) * BigInt(data.price.ethUsdWad)) /
    10n ** 18n
  ).toString();
}

function wethPerStatics(value: string | null): string {
  return value === null ? "—" : `${formatTokenAmountGrouped(BigInt(value), 18, 10)} WETH`;
}

export function MarketAnalyticsPanel({
  analytics,
  loading,
  error,
}: {
  analytics: StaticsMarketOverview | null;
  loading: boolean;
  error: boolean;
}) {
  const t = useTranslations("launchOverview");
  if (error && !analytics) {
    return (
      <section className="ui-card market-analytics" aria-label={t("analyticsTitle")}>
        <div className="overview-panel-head">
          <h3>{t("analyticsTitle")}</h3>
        </div>
        <p className="overview-note is-warning">{t("analyticsUnavailable")}</p>
      </section>
    );
  }

  const change = analytics?.activity24h.priceChangeBps ?? 0;
  return (
    <section className="ui-card market-analytics" aria-label={t("analyticsTitle")}>
      <div className="overview-panel-head">
        <h3>{t("analyticsTitle")}</h3>
        <span
          className={
            analytics?.status === "fresh"
              ? "is-accent"
              : analytics?.status === "stale" || analytics?.status === "partial"
                ? "is-warning"
                : undefined
          }
        >
          {analytics ? t(`analyticsStatus.${analytics.status}`) : t("analyticsLoading")}
        </span>
      </div>

      <div className="market-analytics__headline" aria-busy={loading}>
        <article>
          <span>{t("staticsPrice")}</span>
          <strong>{analytics ? usdWad(analytics.price.staticsUsdWad, true) : "—"}</strong>
          <small className={change < 0 ? "is-negative" : change > 0 ? "is-positive" : undefined}>
            {analytics
              ? `${change > 0 ? "+" : ""}${(change / 100).toFixed(2)}% ${t("last24h")}`
              : "—"}
          </small>
          <small>
            {analytics ? wethPerStatics(analytics.activity24h.lastWethPerStaticsWad) : "—"}
          </small>
        </article>
        <article>
          <span>{t("publicMarketCap")}</span>
          <strong>{analytics ? usdWad(analytics.valuation.publicMarketCapUsdWad) : "—"}</strong>
          <small>{t("publicMarketCapHint")}</small>
        </article>
        <article>
          <span>{t("poolLiquidity")}</span>
          <strong>{analytics ? usdWad(analytics.liquidity.tvlUsdWad) : "—"}</strong>
          <small>{t("poolPrincipalOnly")}</small>
        </article>
        <article>
          <span>{t("volume24h")}</span>
          <strong>{analytics ? usdWad(volumeUsd(analytics)) : "—"}</strong>
          <small>{analytics ? t("swapCount", { count: analytics.activity24h.swaps }) : "—"}</small>
        </article>
        <article>
          <span>{t("high24h")}</span>
          <strong>
            {analytics ? wethPerStatics(analytics.activity24h.highWethPerStaticsWad) : "—"}
          </strong>
          <small>{t("perStatics")}</small>
        </article>
        <article>
          <span>{t("low24h")}</span>
          <strong>
            {analytics ? wethPerStatics(analytics.activity24h.lowWethPerStaticsWad) : "—"}
          </strong>
          <small>{t("perStatics")}</small>
        </article>
      </div>

      {analytics && (
        <div className="market-analytics__details">
          <div>
            <h4>{t("supplyDefinitions")}</h4>
            <dl className="overview-rows">
              <div>
                <dt>{t("totalSupply")}</dt>
                <dd>{compactWad(analytics.supply.total)} STATICS</dd>
              </div>
              <div>
                <dt>{t("publicDistributed")}</dt>
                <dd>{compactWad(analytics.supply.publicDistributed)} STATICS</dd>
              </div>
              <div>
                <dt>{t("strictLiquidFloat")}</dt>
                <dd>{compactWad(analytics.supply.strictLiquidFloat)} STATICS</dd>
              </div>
              <div>
                <dt>{t("fullyDilutedValue")}</dt>
                <dd>{usdWad(analytics.valuation.fdvUsdWad)}</dd>
              </div>
            </dl>
            <p className="overview-note">{t("supplyDefinitionsNote")}</p>
          </div>

          <div>
            <h4>{t("marketDepth")}</h4>
            {analytics.depth ? (
              <div className="market-depth">
                <div className="market-depth__head" aria-hidden="true">
                  <span>{t("priceImpact")}</span>
                  <span>{t("buyDepth")}</span>
                  <span>{t("sellDepth")}</span>
                </div>
                {analytics.depth.buyStatics.map((buy, index) => {
                  const sell = analytics.depth!.sellStatics[index];
                  return (
                    <div className="market-depth__row" key={buy.targetImpactBps}>
                      <b>{buy.targetImpactBps / 100}%</b>
                      <span>{usdWad(buy.inputUsdWad)}</span>
                      <span>{sell ? usdWad(sell.inputUsdWad) : "—"}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="overview-note is-warning">{t("depthUnavailable")}</p>
            )}
            <p className="overview-note">{t("depthNote")}</p>
          </div>
        </div>
      )}
    </section>
  );
}

export function formatCanonicalMarketPrice(
  sqrtPriceX96: bigint,
  currency0: Address,
  statics: Address
): { value: string; unit: "WETH per STATICS" | "STATICS per WETH" } {
  const staticsPerWeth = currency0.toLowerCase() !== statics.toLowerCase();
  const decimals = staticsPerWeth ? STATICS_PER_WETH_DECIMALS : WETH_PER_STATICS_DECIMALS;
  const scaledPrice = (sqrtPriceX96 * sqrtPriceX96 * 10n ** BigInt(decimals)) / Q192;
  return {
    value: decimalFromScaled(scaledPrice, decimals),
    unit: staticsPerWeth ? "STATICS per WETH" : "WETH per STATICS",
  };
}

export function DeploymentOverview() {
  const t = useTranslations("launchOverview");
  const { active } = useDeployment();
  if (active.protocol) return <DollarOverview deployment={active.protocol.protocol} />;
  if (!active.launch) {
    return (
      <div className="launch-overview">
        <EmptyState
          title={t("mainnetPreparing")}
          description={active.descriptor.unavailableReason ?? t("noReviewedDeployment")}
        />
        <section className="ui-card launch-overview-actions">
          <p className="dapp-eyebrow">{t("selectedNetwork")}</p>
          <h2>{active.descriptor.network}</h2>
          <p>{t("enabledAfterManifest")}</p>
        </section>
      </div>
    );
  }
  return <LaunchOverview deployment={active.launch} />;
}

function LaunchOverview({ deployment }: { deployment: LaunchDeployment }) {
  const t = useTranslations("launchOverview");
  const publicClient = usePublicClient({ chainId: deployment.descriptor.chainId });
  const walletState = useWalletState();
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;

  const metrics = useQuery({
    queryKey: ["launch-overview", deployment.descriptor.deploymentId],
    enabled: Boolean(publicClient),
    queryFn: async () => {
      if (!publicClient) throw new Error("The deployment RPC is unavailable.");
      await verifyLaunchDeploymentForRead(publicClient, deployment);
      const [vault, purchase, redemption, slot0, liquidity] = await Promise.all([
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
      ]);
      return { vault, purchase, redemption, sqrtPriceX96: slot0[0], liquidity };
    },
  });

  const staticsBalance = useQuery({
    queryKey: ["launch-overview-balance", deployment.descriptor.deploymentId, wallet],
    enabled: Boolean(publicClient && wallet),
    queryFn: async () => {
      if (!publicClient || !wallet) return 0n;
      return publicClient.readContract({
        address: deployment.contracts.statics,
        abi: dopplerStaticsTokenAbi,
        functionName: "balanceOf",
        args: [wallet],
      });
    },
  });

  // Same key and fetcher My Operators mounts, so the two surfaces share one walk
  // of the wallet rather than each paying for it.
  const portfolio = useQuery({
    queryKey: ownedGenesisQueryKey(deployment.descriptor.deploymentId, wallet),
    enabled: Boolean(publicClient && wallet),
    retry: false,
    queryFn: async () => {
      if (!publicClient || !wallet) return EMPTY_GENESIS_PORTFOLIO;
      return loadOwnedGenesis(publicClient, deployment, wallet);
    },
  });

  const marketAnalytics = useQuery({
    queryKey: ["market-overview", deployment.descriptor.deploymentId],
    enabled: deployment.descriptor.deploymentId === ROBINHOOD_GENESIS_DEPLOYMENT_ID,
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 1,
    queryFn: ({ signal }) => loadMarketOverview(signal),
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
          {t("acquireOperators")}
          <small>
            {metrics.data
              ? `${formatTokenAmountGrouped(metrics.data.purchase.staticsPrice, 18, 0)} STATICS + ${formatTokenAmountGrouped(metrics.data.purchase.requiredNative, 18, 5)} ETH`
              : "—"}
          </small>
        </Link>
        <Link className="ui-button ui-button--secondary" href="/app/swap">
          {t("buyStatics")}
        </Link>
        {genesisHeld > 0 && (
          <Link className="ui-button ui-button--secondary" href="/app/genesis">
            {t("manageOperators", { count: genesisHeld })}
          </Link>
        )}
        {vault?.epochActive === false && (
          <Link className="ui-button ui-button--secondary" href="/app/genesis/recoveries">
            {t("recoverCredit")}
          </Link>
        )}
      </div>

      {wallet && portfolio.data?.stale && (
        <p className="genesis-note is-warning" role="status">
          {t("operatorsSyncing")}
        </p>
      )}

      {wallet ? (
        <section className="ui-card launch-position" aria-label={t("yourPosition")}>
          <div className="ui-stat">
            <span className="ui-stat__label">{t("yourStatics")}</span>
            <strong className="ui-stat__value">
              {staticsBalance.data !== undefined
                ? formatTokenAmountGrouped(staticsBalance.data, 18, 2)
                : "—"}
            </strong>
          </div>
          <div className="ui-stat">
            <span className="ui-stat__label">{t("yourOperators")}</span>
            <strong className="ui-stat__value">{portfolio.isLoading ? "—" : genesisHeld}</strong>
            <small>
              {genesisHeld > 0 && vault
                ? t("staticsBacking", {
                    amount: formatTokenAmountGrouped(vault.vaultPrice * BigInt(genesisHeld), 18, 0),
                  })
                : t("noneHeld")}
            </small>
          </div>
          <div className="ui-stat">
            <span className="ui-stat__label">{t("claimable")}</span>
            <strong className="ui-stat__value is-accent">
              {formatTokenAmountGrouped(rewards.claimableStatics, 18, 2)} STATICS
            </strong>
            <small>{formatTokenAmountGrouped(rewards.claimableWeth, 18, 4)} WETH</small>
          </div>
          {/* Names its destination, not an action: claiming is one transaction
              per NFT and asset, and My Operators is where that sequence is priced
              honestly. Revisit when the batch claim entry point lands. */}
          <Link className="ui-button ui-button--secondary" href="/app/genesis">
            {t("openOperators")}
          </Link>
        </section>
      ) : (
        <section className="ui-card launch-position is-signed-out" aria-label={t("yourPosition")}>
          <div>
            <strong>{t("connectTitle")}</strong>
            <p>{t("connectDescription")}</p>
          </div>
          <button
            className="ui-button ui-button--primary"
            type="button"
            onClick={walletState.status === "signed-out" ? walletState.login : undefined}
            disabled={walletState.status !== "signed-out"}
          >
            {t("connectWallet")}
          </button>
        </section>
      )}

      <div className="launch-duo">
        <section className="ui-card overview-panel" aria-label={t("operatorsSupply")}>
          <div className="overview-panel-head">
            <h3>{t("supply")}</h3>
            <span>{t("fixedAt", { count: count(supply) })}</span>
          </div>
          <p className="overview-figure">
            <b>{count(inventory)}</b>
            <span>{t("stillInVault")}</span>
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
                {t("treasuryAtLaunch")}
              </dt>
              <dd>{count(TREASURY_GENESIS)}</dd>
            </div>
            <div>
              <dt>
                <i className="is-circulating" aria-hidden="true" />
                {t("heldByMarket")}
              </dt>
              <dd>{count(heldByMarket)}</dd>
            </div>
            <div>
              <dt>
                <i className="is-inventory" aria-hidden="true" />
                {t("vaultInventory")}
              </dt>
              <dd>{count(inventory)}</dd>
            </div>
          </dl>
        </section>

        <section className="ui-card overview-panel" aria-label={`STATICS ${t("market")}`}>
          <div className="overview-panel-head">
            <h3>{t("market")}</h3>
            <span>{metrics.data?.liquidity ? t("liquidityActive") : t("noActiveLiquidity")}</span>
          </div>
          <p className="overview-figure overview-figure--market">
            <b>{marketPrice?.value ?? "—"}</b>
            <span>
              {marketPrice?.unit === "STATICS per WETH" ? t("staticsPerWeth") : t("wethPerStatics")}
            </span>
          </p>
          <dl className="overview-rows">
            <div>
              <dt>
                {t("staticsAtMarket", {
                  amount: vault ? formatTokenAmountGrouped(vault.vaultPrice, 18, 0) : "—",
                })}
              </dt>
              <dd>
                {backingAtMarket !== null
                  ? `${formatTokenAmountGrouped(backingAtMarket, 18, 4)} WETH`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>{t("reservePerOperator")}</dt>
              <dd>
                {vault
                  ? `${formatTokenAmountGrouped(vault.reserveBackingPerGenesis, 18, 6)} ETH`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>{vault?.epochActive ? t("buyInProjected") : t("buyInToday")}</dt>
              <dd>{`${formatTokenAmountGrouped(projectedBuyIn, 18, 5)} ETH`}</dd>
            </div>
            <div className="is-total">
              <dt>{t("allInCost")}</dt>
              <dd>
                {allInCost !== null
                  ? t("wethEquivalent", {
                      amount: formatTokenAmountGrouped(allInCost, 18, 4),
                    })
                  : "—"}
              </dd>
            </div>
          </dl>
          <p className="overview-note">
            {vault?.epochActive
              ? t.rich("preEpochMarketNote", { strong: (chunks) => <b>{chunks}</b> })
              : t.rich("postEpochMarketNote", { strong: (chunks) => <b>{chunks}</b> })}
          </p>
        </section>
      </div>

      {deployment.descriptor.deploymentId === ROBINHOOD_GENESIS_DEPLOYMENT_ID && (
        <MarketAnalyticsPanel
          analytics={marketAnalytics.data ?? null}
          loading={marketAnalytics.isLoading || marketAnalytics.isFetching}
          error={Boolean(marketAnalytics.error)}
        />
      )}

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
          {t("metricsUnavailable")}
        </p>
      )}
    </div>
  );
}
