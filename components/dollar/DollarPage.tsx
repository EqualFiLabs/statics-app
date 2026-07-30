"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  buildDepositETHTransaction,
  buildDepositWETHCall,
  buildRecombineToETHCall,
  buildRecombineToWETHCall,
  staticsDollarCoreAbi,
  staticsDollarPeripheryAbi,
  staticsDollarRiskTokenAbi,
  staticsDollarTokenAbi,
  wethAbi,
} from "@statics-protocol/sdk";
import {
  encodeFunctionData,
  formatUnits,
  getAddress,
  parseUnits,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import { usePublicClient, useWalletClient } from "wagmi";

import {
  activityTimestamp,
  updateDollarActivity,
  writeDollarActivity,
  type DollarActivityKind,
  type DollarActivityStatus,
  type DollarReplacementReason,
} from "@/lib/dollar/activity";
import {
  DOLLAR_PAIRING_FILL_PAUSE,
  deriveDollarActionAvailability,
  dollarQuoteQueryKey,
  type DollarActionMode,
  type DollarCollateralChoice,
  type DollarQuoteState,
} from "@/lib/dollar/action-state";
import {
  buildApproveRiskForPeripheryCall,
  buildClaimRiskProceedsCall,
  buildStakeRiskCall,
  buildUnstakeRiskCall,
  hasClaimableProceeds,
  emptyDollarSupplyState,
  loadDollarSupplyState,
  supplyActionAvailability,
} from "@/lib/dollar/supply";
import {
  readClientDollarDeployment,
  verifyDollarDeployment,
  type DollarDeployment,
} from "@/lib/dollar/deployment";
import {
  describeDollarError,
  isOnchainRevert,
  isWalletRejection,
  WAD,
  redeemDeadline,
  maximumWithTolerance,
  minimumWithTolerance,
  validateRecombinationSimulation,
} from "@/lib/dollar/transactions";
import { useWalletState } from "@/providers/wallet-context";
import { DollarOverviewPreview, DollarPagePreview } from "@/components/preview/DappPreview";
import { EmptyState, SurfaceEmptyState } from "@/components/common/EmptyState";
import { dappPreviewEnabled } from "@/lib/dapp-preview";
import { deriveSurfaceState } from "@/lib/surface-state";
import { claimablePositionRewards } from "@/lib/positions/positions";
import { loadLoanCatalog } from "@/lib/loans/loans";
import { loadBasketRewardSummary, totalRewardsByAsset } from "@/lib/baskets/rewards";
import { readEvesMarketUrl } from "@/lib/site-config";
import { overviewTiles } from "@/lib/overview";
import { PeggedDollarPanel } from "@/components/portal/PeggedDollarPanel";

const deploymentState = readClientDollarDeployment();

const modeLabels: Record<DollarActionMode, string> = {
  deposit: "Deposit",
  recombine: "Recombine",
  redeem: "Redeem",
  supply: "Supply",
  unsupply: "Withdraw",
};

/** Supply and withdraw move Risk shares; the other three move Dollar or ETH. */
const isSupplyMode = (mode: DollarActionMode): mode is "supply" | "unsupply" =>
  mode === "supply" || mode === "unsupply";
type DollarProfileChoice = DollarCollateralChoice | "USDG";

export function DollarProfilePills({
  value,
  peggedAvailable,
  disabled,
  onChange,
}: {
  value: DollarProfileChoice;
  peggedAvailable: boolean;
  disabled: boolean;
  onChange: (choice: DollarProfileChoice) => void;
}) {
  const choices: readonly DollarProfileChoice[] = peggedAvailable
    ? ["ETH", "WETH", "USDG"]
    : ["ETH", "WETH"];
  return (
    <fieldset
      className={`dollar-asset-choice dollar-profile-choice${peggedAvailable ? " has-pegged" : ""}`}
    >
      <legend>Collateral profile</legend>
      {choices.map((choice) => (
        <button
          key={choice}
          type="button"
          className={value === choice ? "active" : undefined}
          aria-pressed={value === choice}
          onClick={() => onChange(choice)}
          disabled={disabled}
        >
          {choice}
        </button>
      ))}
    </fieldset>
  );
}
const evesMarketUrl = readEvesMarketUrl(process.env.NEXT_PUBLIC_EVES_MARKET_URL);

function shortAddress(address: Address): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function displayAmount(value: bigint, decimals = 18, precision = 4): string {
  const formatted = formatUnits(value, decimals);
  const [whole, fraction = ""] = formatted.split(".");
  return fraction ? `${whole}.${fraction.slice(0, precision)}`.replace(/\.$/, "") : whole;
}

function profileModeLabel(mode: number): string {
  return ["Inactive", "Active", "Reduce only", "Retired"][mode] ?? `Unknown (${mode})`;
}

function seriesStatusLabel(status: number): string {
  return (
    ["None", "Active", "Recovery pending", "Recoverable", "Retired", "Closed"][status] ??
    `Unknown (${status})`
  );
}

function globalHealthLabel(phase: number): string {
  return ["Available", "Impaired", "Recovering", "Health unavailable"][phase] ?? "Restricted";
}

function useDollarSnapshot(deployment: DollarDeployment, wallet: Address) {
  const publicClient = usePublicClient({ chainId: deployment.chainId });
  return useQuery({
    queryKey: ["dollar-snapshot", deployment.chainId, wallet],
    refetchInterval: 8_000,
    queryFn: async () => {
      if (!publicClient) throw new Error("The configured public client is unavailable.");
      await verifyDollarDeployment(publicClient, deployment);
      const profile = await publicClient.readContract({
        address: deployment.contracts.core,
        abi: staticsDollarCoreAbi,
        functionName: "collateralProfile",
        args: [deployment.wethProfileId],
      });
      const seriesId = profile.activeSeriesId;
      const [
        series,
        nativeBalance,
        wethBalance,
        dollarBalance,
        riskBalance,
        wethAllowance,
        dollarAllowance,
        riskApproved,
        solvency,
        globalHealth,
        priceWad,
        pausedOperations,
        periphery,
      ] = await Promise.all([
        publicClient.readContract({
          address: deployment.contracts.core,
          abi: staticsDollarCoreAbi,
          functionName: "riskSeries",
          args: [seriesId],
        }),
        publicClient.getBalance({ address: wallet }),
        publicClient.readContract({
          address: deployment.contracts.weth,
          abi: wethAbi,
          functionName: "balanceOf",
          args: [wallet],
        }),
        publicClient.readContract({
          address: deployment.contracts.dollar,
          abi: staticsDollarTokenAbi,
          functionName: "balanceOf",
          args: [wallet],
        }),
        publicClient.readContract({
          address: deployment.contracts.risk,
          abi: staticsDollarRiskTokenAbi,
          functionName: "balanceOf",
          args: [wallet, seriesId],
        }),
        publicClient.readContract({
          address: deployment.contracts.weth,
          abi: wethAbi,
          functionName: "allowance",
          args: [wallet, deployment.contracts.gateway],
        }),
        publicClient.readContract({
          address: deployment.contracts.dollar,
          abi: staticsDollarTokenAbi,
          functionName: "allowance",
          args: [wallet, deployment.contracts.gateway],
        }),
        publicClient.readContract({
          address: deployment.contracts.risk,
          abi: staticsDollarRiskTokenAbi,
          functionName: "isApprovedForAll",
          args: [wallet, deployment.contracts.gateway],
        }),
        publicClient.readContract({
          address: deployment.contracts.core,
          abi: staticsDollarCoreAbi,
          functionName: "profileSolvency",
          args: [deployment.wethProfileId],
        }),
        publicClient.readContract({
          address: deployment.contracts.core,
          abi: staticsDollarCoreAbi,
          functionName: "globalImpairment",
        }),
        publicClient.readContract({
          address: deployment.contracts.core,
          abi: staticsDollarCoreAbi,
          functionName: "collateralUsdPriceWad",
          args: [deployment.wethProfileId],
        }),
        publicClient.readContract({
          address: deployment.contracts.core,
          abi: staticsDollarCoreAbi,
          functionName: "pausedProfileOperations",
          args: [deployment.wethProfileId],
        }),
        // Read from the pool rather than configured separately, so the two can
        // never disagree about which periphery is in use.
        publicClient.readContract({
          address: deployment.contracts.core,
          abi: staticsDollarCoreAbi,
          functionName: "periphery",
        }),
      ]);

      // Redemption depends on liquidity somebody else supplied, so an absent or
      // silent periphery means the route is simply unavailable -- never a
      // failure of the page around it.
      const [redeemableLiquidity, peripheryDollarAllowance] =
        periphery && periphery !== zeroAddress
          ? await Promise.all([
              publicClient
                .readContract({
                  address: periphery,
                  abi: staticsDollarPeripheryAbi,
                  functionName: "redeemableLiquidity",
                  args: [seriesId],
                })
                .catch(() => 0n),
              publicClient
                .readContract({
                  address: deployment.contracts.dollar,
                  abi: staticsDollarTokenAbi,
                  functionName: "allowance",
                  args: [wallet, periphery],
                })
                .catch(() => 0n),
            ])
          : [0n, 0n];

      return {
        profile,
        seriesId,
        periphery,
        redeemableLiquidity,
        peripheryDollarAllowance,
        series,
        nativeBalance,
        wethBalance,
        dollarBalance,
        riskBalance,
        wethAllowance,
        dollarAllowance,
        riskApproved,
        solvency,
        globalHealth,
        priceWad,
        pausedOperations,
      };
    },
  });
}

function DollarOverviewConnected({
  deployment,
  wallet,
}: {
  deployment: DollarDeployment;
  wallet: Address;
}) {
  const snapshot = useDollarSnapshot(deployment, wallet);
  if ((snapshot.isPending || snapshot.isError) && !snapshot.data) {
    return <DollarOverviewPreview />;
  }
  const data = snapshot.data!;
  return (
    <section className="dollar-overview-card" aria-labelledby="dollar-overview-title">
      <div>
        <p className="dapp-section-label">Statics Dollar</p>
        <h2 id="dollar-overview-title">{displayAmount(data.dollarBalance)} Dollar</h2>
        <p>
          Series {data.seriesId.toString()} · {displayAmount(data.riskBalance)} active Risk
        </p>
      </div>
      <div className="dollar-overview-health">
        <span>{data.solvency.healthy ? "Healthy" : "Impaired"}</span>
        <strong>${displayAmount(data.priceWad)}</strong>
        <small>WETH oracle</small>
      </div>
      <Link className="dollar-primary-link" href="/app/dollar">
        Open Dollar
      </Link>
    </section>
  );
}

/**
 * Where the rest of a portfolio is reached from.
 *
 * The preview overview has always shown this grid; the connected one showed
 * only the Dollar card, so signing in gave you less than the mock. It is also
 * the precondition for taking Positions and Loans out of the sidebar: a
 * destination needs somewhere to be reached from before its nav entry goes.
 */
/**
 * The rest of a portfolio, and what it has earned.
 *
 * This is where a new user lands, so it has to answer three things without a
 * click: what do I hold, what has it earned, and what do I do if the answer to
 * both is nothing. The earned figure is the whole pitch made concrete -- a
 * deposited basket accumulates more of the assets it holds -- so it leads, in
 * those assets, rather than being a count of claims buried in a tile.
 */
function OverviewPortfolio({ wallet }: { wallet: Address }) {
  const publicClient = usePublicClient();

  // loadLoanCatalog loads the position catalog internally, so one read covers
  // positions, deposited baskets and loans.
  const catalog = useQuery({
    queryKey: ["overview-portfolio", wallet],
    enabled: deploymentState.status === "configured" && Boolean(publicClient),
    placeholderData: keepPreviousData,
    queryFn: () => {
      if (!publicClient || deploymentState.status !== "configured") {
        throw new Error("No verified Statics deployment is configured.");
      }
      return loadLoanCatalog(publicClient, deploymentState.deployment, wallet);
    },
  });

  const positions = catalog.data?.positions ?? [];

  const basketRewards = useQuery({
    queryKey: [
      "overview-basket-rewards",
      wallet,
      positions.map((position) => `${position.positionId}:${position.collateral.length}`).join(","),
    ],
    enabled:
      deploymentState.status === "configured" && Boolean(publicClient) && Boolean(catalog.data),
    placeholderData: keepPreviousData,
    queryFn: () => {
      if (!publicClient || deploymentState.status !== "configured") {
        throw new Error("No verified Statics deployment is configured.");
      }
      return loadBasketRewardSummary(publicClient, deploymentState.deployment, positions);
    },
  });

  const depositedBaskets = positions.reduce(
    (total, position) => total + position.collateral.length,
    0
  );
  const loans = catalog.data?.ownedLoans.length ?? 0;
  const stakingClaims = positions.reduce(
    (total, position) => total + claimablePositionRewards(position.rewards).length,
    0
  );
  const earned = basketRewards.data ? totalRewardsByAsset(basketRewards.data.entries) : [];
  const hasNothing =
    Boolean(catalog.data) && positions.length === 0 && depositedBaskets === 0 && loans === 0;

  if (hasNothing) {
    return (
      <EmptyState
        title="Nothing here yet"
        description="Buy a basket and it starts earning more of the assets it holds. Or get Statics Dollar and stake it to earn in whichever assets you choose."
        action={{ label: "Browse baskets", href: "/app/baskets" }}
        secondary={{ label: "Get Statics Dollar", href: "/app/dollar" }}
      />
    );
  }

  return (
    <>
      {earned.length > 0 && (
        <section className="overview-earned" aria-labelledby="overview-earned-title">
          <div>
            <p className="dapp-section-label">Earned by your baskets</p>
            <h2 id="overview-earned-title">
              {earned
                .map(
                  (item) =>
                    `${displayAmount(item.amount, item.token.decimals)} ${item.token.symbol}`
                )
                .join(" + ")}
            </h2>
            <p>Paid in the assets your baskets hold. Claim it whenever you like.</p>
          </div>
          <Link className="dollar-primary-link" href="/app/rewards">
            Claim
          </Link>
        </section>
      )}

      <section className="preview-overview-grid" aria-label="Portfolio summary">
        {overviewTiles.map((tile) => {
          const values = {
            positions: positions.length,
            baskets: depositedBaskets,
            loans,
            rewards: stakingClaims,
          };
          return (
            <article key={tile.id}>
              <span>{tile.label}</span>
              <strong>{values[tile.id].toString()}</strong>
              <Link href={tile.href}>{tile.action} →</Link>
            </article>
          );
        })}
      </section>
    </>
  );
}

export function DollarOverview() {
  const wallet = useWalletState();
  if (dappPreviewEnabled) {
    return <DollarOverviewPreview />;
  }
  if (deploymentState.status === "unavailable") {
    return <DollarOverviewPreview />;
  }
  // The overview is the app's front door. Six cards of em dashes told a
  // first-time visitor nothing about why they were empty or what to do.
  if (wallet.status !== "ready" || !wallet.address || !wallet.isTargetChain) {
    return (
      <SurfaceEmptyState
        state={deriveSurfaceState({
          walletStatus: wallet.status,
          isTargetChain: wallet.isTargetChain,
          isLoading: false,
          isError: false,
          isEmpty: true,
          hasData: false,
        })}
        subject="portfolio"
        empty={{
          title: "Your portfolio is empty",
          description:
            "Add funds and get Statics Dollar to begin. Everything you hold will show up here.",
          action: { label: "Get Statics Dollar", href: "/app/dollar" },
          secondary: { label: "Add funds", href: "/app/portal" },
        }}
      />
    );
  }
  return (
    <>
      <DollarOverviewConnected
        deployment={deploymentState.deployment}
        wallet={getAddress(wallet.address)}
      />
      <OverviewPortfolio wallet={getAddress(wallet.address)} />
    </>
  );
}

function DollarActionPanel({
  deployment,
  wallet,
}: {
  deployment: DollarDeployment;
  wallet: Address;
}) {
  const publicClient = usePublicClient({ chainId: deployment.chainId });
  const walletClient = useWalletClient({ chainId: deployment.chainId });
  const snapshot = useDollarSnapshot(deployment, wallet);
  const [mode, setMode] = useState<DollarActionMode>("deposit");
  const [asset, setAsset] = useState<DollarCollateralChoice>("ETH");
  const [peggedSelected, setPeggedSelected] = useState(false);
  const [peggedPending, setPeggedPending] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [pendingAction, setPendingAction] = useState<"primary" | "revoke" | "claim" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const amount = useMemo(() => {
    try {
      return amountInput ? parseUnits(amountInput, 18) : 0n;
    } catch {
      return 0n;
    }
  }, [amountInput]);

  const quote = useQuery({
    queryKey: dollarQuoteQueryKey({
      chainId: deployment.chainId,
      mode,
      amount,
      seriesId: snapshot.data?.seriesId,
    }),
    // Supply and withdraw move Risk shares and have no Dollar quote. Without
    // this guard the query fell through to previewRecombine with a share
    // amount, and the failed result made currentQuote permanently null.
    enabled: amount > 0n && Boolean(publicClient) && Boolean(snapshot.data) && !isSupplyMode(mode),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!publicClient || !snapshot.data) throw new Error("Dollar state is not ready.");
      if (mode === "deposit") {
        const preview = await publicClient.readContract({
          address: deployment.contracts.core,
          abi: staticsDollarCoreAbi,
          functionName: "previewDeposit",
          args: [deployment.wethProfileId, amount],
        });
        return {
          mode: "deposit" as const,
          amount,
          seriesId: snapshot.data.seriesId,
          quotedAt: Date.now(),
          preview,
        };
      }
      if (mode === "redeem") {
        if (!snapshot.data.periphery || snapshot.data.periphery === zeroAddress) {
          throw new Error("This deployment has no periphery, so Dollar cannot be redeemed alone.");
        }
        const preview = await publicClient.readContract({
          address: snapshot.data.periphery,
          abi: staticsDollarPeripheryAbi,
          functionName: "previewRedeem",
          args: [snapshot.data.seriesId, amount],
        });
        return {
          mode: "redeem" as const,
          amount,
          seriesId: snapshot.data.seriesId,
          quotedAt: Date.now(),
          preview,
        };
      }
      const preview = await publicClient.readContract({
        address: deployment.contracts.core,
        abi: staticsDollarCoreAbi,
        functionName: "previewRecombine",
        args: [snapshot.data.seriesId, amount],
      });
      return {
        mode: "recombine" as const,
        amount,
        seriesId: snapshot.data.seriesId,
        quotedAt: Date.now(),
        preview,
      };
    },
  });
  const currentQuote =
    quote.data &&
    quote.data.mode === mode &&
    quote.data.amount === amount &&
    quote.data.seriesId === snapshot.data?.seriesId
      ? quote.data
      : null;
  const quoteState: DollarQuoteState =
    amount <= 0n
      ? "idle"
      : quote.isError
        ? "error"
        : quote.isFetching || quote.isPlaceholderData || !currentQuote
          ? "refreshing"
          : "ready";

  const recordAndSend = async ({
    kind,
    label,
    to,
    data,
    value = 0n,
    validateSimulation,
  }: {
    kind: DollarActivityKind;
    label: string;
    to: Address;
    data: Hex;
    value?: bigint;
    validateSimulation?: (result: Hex | undefined) => void;
  }) => {
    if (!publicClient || !walletClient.data)
      throw new Error("The connected wallet is unavailable.");
    const id = crypto.randomUUID();
    let stage: "simulating" | "signing" | "submitted" | "finished" = "simulating";
    let replacementReason: DollarReplacementReason | undefined;
    writeDollarActivity({
      id,
      wallet,
      chainId: deployment.chainId,
      kind,
      label,
      amount: amountInput || "0",
      status: "simulating",
      createdAt: activityTimestamp(),
    });
    try {
      const simulation = await publicClient.call({ account: wallet, to, data, value });
      validateSimulation?.(simulation.data);
      stage = "signing";
      updateDollarActivity(wallet, deployment.chainId, id, { status: "signing" });
      const hash = await walletClient.data.sendTransaction({
        account: wallet,
        chain: walletClient.data.chain,
        to,
        data,
        value,
      });
      stage = "submitted";
      updateDollarActivity(wallet, deployment.chainId, id, { hash, status: "submitted" });
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 1,
        onReplaced: (replacement) => {
          replacementReason = replacement.reason;
          updateDollarActivity(wallet, deployment.chainId, id, {
            status: "replaced",
            replacementHash: replacement.transaction.hash,
            replacementReason,
          });
        },
      });
      if (receipt.status !== "success") throw new Error("The transaction reverted onchain.");
      if (replacementReason === "cancelled" || replacementReason === "replaced") {
        const message =
          replacementReason === "cancelled"
            ? "The submitted transaction was cancelled in the wallet."
            : "The submitted transaction was replaced by a different wallet transaction.";
        stage = "finished";
        updateDollarActivity(wallet, deployment.chainId, id, {
          status: "replaced",
          confirmedHash: receipt.transactionHash,
          error: message,
        });
        throw new Error(message);
      }
      stage = "finished";
      updateDollarActivity(wallet, deployment.chainId, id, {
        confirmedHash: receipt.transactionHash,
        status: "confirmed",
      });
    } catch (error) {
      if (stage === "finished") throw error;
      let status: DollarActivityStatus = "failed";
      if (isWalletRejection(error)) status = "rejected";
      else if (stage === "submitted" && isOnchainRevert(error)) status = "reverted";
      updateDollarActivity(wallet, deployment.chainId, id, {
        status,
        error: describeDollarError(error),
      });
      throw error;
    }
  };

  const claimProceeds = async () => {
    if (supply.positionId === null || state.periphery === zeroAddress) return;
    setPendingAction("claim");
    setActionError(null);
    try {
      await recordAndSend({
        kind: "claim-risk-proceeds",
        label: "Claim Risk supply proceeds",
        to: state.periphery,
        data: buildClaimRiskProceedsCall(supply.positionId, state.seriesId, wallet),
      });
      await supplyState.refetch();
    } catch (error) {
      setActionError(describeDollarError(error));
    } finally {
      setPendingAction(null);
    }
  };

  const executeNextAction = async () => {
    setPendingAction("primary");
    setActionError(null);
    try {
      if (!snapshot.data || amount <= 0n) throw new Error("Enter a valid amount.");
      if (!actionAvailability.executable) {
        throw new Error(actionAvailability.reason || "This action is not available.");
      }
      // Only the Dollar routes quote. Requiring a quote here is what made the
      // supply modes unreachable.
      if (!isSupplyMode(mode) && !currentQuote) {
        throw new Error("Wait for a fresh protocol preview.");
      }

      if (isSupplyMode(mode)) {
        const moves: bigint =
          "moves" in actionAvailability && typeof actionAvailability.moves === "bigint"
            ? actionAvailability.moves
            : amount;
        const periphery = state.periphery;
        if (periphery === zeroAddress) {
          throw new Error("This deployment has no periphery, so Risk shares cannot be supplied.");
        }
        if (actionAvailability.kind === "approve-risk-periphery") {
          await recordAndSend({
            kind: "approve-risk",
            label: "Approve Risk share operator",
            to: deployment.contracts.risk,
            data: buildApproveRiskForPeripheryCall(periphery),
          });
        } else if (actionAvailability.kind === "stake") {
          // Staking is supplying -- the shares are consumable the moment this
          // confirms, so there is no follow-up step.
          await recordAndSend({
            kind: "supply-risk",
            label: supply.positionId === null ? "Create position and supply Risk" : "Supply Risk",
            to: periphery,
            data: buildStakeRiskCall(supply.positionId, state.seriesId, moves, wallet),
          });
          setAmountInput("");
        } else if (actionAvailability.kind === "unstake") {
          if (supply.positionId === null)
            throw new Error("No position holds this Risk series yet.");
          await recordAndSend({
            kind: "withdraw-risk",
            label: "Withdraw Risk shares",
            to: periphery,
            data: buildUnstakeRiskCall(supply.positionId, state.seriesId, moves, wallet),
          });
          setAmountInput("");
        }
        await supplyState.refetch();
      } else if (actionAvailability.kind === "approve-weth") {
        await recordAndSend({
          kind: "approve-weth",
          label: "Approve exact WETH",
          to: deployment.contracts.weth,
          data: encodeFunctionData({
            abi: wethAbi,
            functionName: "approve",
            args: [deployment.contracts.gateway, amount],
          }),
        });
      } else if (actionAvailability.kind === "approve-dollar") {
        await recordAndSend({
          kind: "approve-dollar",
          label: "Approve exact Dollar",
          to: deployment.contracts.dollar,
          data: encodeFunctionData({
            abi: staticsDollarTokenAbi,
            functionName: "approve",
            args: [deployment.contracts.gateway, amount],
          }),
        });
      } else if (actionAvailability.kind === "approve-dollar-periphery") {
        if (!snapshot.data.periphery || snapshot.data.periphery === zeroAddress) {
          throw new Error("This deployment has no periphery to approve.");
        }
        await recordAndSend({
          kind: "approve-dollar",
          label: "Approve exact Dollar",
          to: deployment.contracts.dollar,
          data: encodeFunctionData({
            abi: staticsDollarTokenAbi,
            functionName: "approve",
            args: [snapshot.data.periphery, amount],
          }),
        });
      } else if (actionAvailability.kind === "execute" && currentQuote?.mode === "redeem") {
        const preview = await quote.refetch();
        if (
          !preview.data ||
          preview.data.mode !== "redeem" ||
          preview.data.amount !== amount ||
          preview.data.seriesId !== snapshot.data.seriesId
        ) {
          throw new Error("Preview refresh failed.");
        }
        if (!snapshot.data.periphery || snapshot.data.periphery === zeroAddress) {
          throw new Error("This deployment has no periphery, so Dollar cannot be redeemed alone.");
        }
        const fill = preview.data.preview.staticsDollarRedeemed;
        if (fill === 0n) throw new Error("There is no redemption liquidity to fill this amount.");
        // The rate guard is collateral per Dollar, WAD-normalized -- the same
        // number the contract recomputes after the split, so a fee or price
        // move between preview and execution is caught rather than absorbed.
        const rateWad = (preview.data.preview.collateralToRedeemer * WAD) / fill;
        const data = encodeFunctionData({
          abi: staticsDollarPeripheryAbi,
          functionName: asset === "ETH" ? "redeemToETH" : "redeem",
          args: [
            snapshot.data.seriesId,
            amount,
            minimumWithTolerance(fill),
            minimumWithTolerance(rateWad),
            redeemDeadline(),
            wallet,
          ],
        });
        await recordAndSend({
          kind: asset === "ETH" ? "redeem-eth" : "redeem-weth",
          label: `Redeem Dollar for ${asset}`,
          to: snapshot.data.periphery,
          data,
        });
        setAmountInput("");
      } else if (actionAvailability.kind === "approve-risk") {
        await recordAndSend({
          kind: "approve-risk",
          label: "Approve Risk share operator",
          to: deployment.contracts.risk,
          data: encodeFunctionData({
            abi: staticsDollarRiskTokenAbi,
            functionName: "setApprovalForAll",
            args: [deployment.contracts.gateway, true],
          }),
        });
      } else if (actionAvailability.kind === "execute" && currentQuote?.mode === "deposit") {
        const preview = await quote.refetch();
        if (
          !preview.data ||
          preview.data.mode !== "deposit" ||
          preview.data.amount !== amount ||
          preview.data.seriesId !== snapshot.data.seriesId
        ) {
          throw new Error("Preview refresh failed.");
        }
        const minimumDollar = minimumWithTolerance(preview.data.preview.staticsDollarMinted);
        const minimumShares = minimumWithTolerance(preview.data.preview.sharesMinted);
        const transaction =
          asset === "ETH"
            ? buildDepositETHTransaction(amount, wallet, wallet, minimumDollar, minimumShares)
            : {
                data: buildDepositWETHCall(amount, wallet, wallet, minimumDollar, minimumShares),
                value: 0n,
              };
        await recordAndSend({
          kind: asset === "ETH" ? "deposit-eth" : "deposit-weth",
          label: `Deposit ${asset}`,
          to: deployment.contracts.gateway,
          data: transaction.data,
          value: transaction.value,
        });
        setAmountInput("");
      } else {
        const preview = await quote.refetch();
        if (
          !preview.data ||
          preview.data.mode !== "recombine" ||
          preview.data.amount !== amount ||
          preview.data.seriesId !== snapshot.data.seriesId
        ) {
          throw new Error("Preview refresh failed.");
        }
        const functionName = asset === "ETH" ? "recombineToETH" : "recombineToWETH";
        const data =
          functionName === "recombineToETH"
            ? buildRecombineToETHCall(
                snapshot.data.seriesId,
                amount,
                maximumWithTolerance(preview.data.preview.sharesBurned),
                wallet,
                minimumWithTolerance(preview.data.preview.collateralOut)
              )
            : buildRecombineToWETHCall(
                snapshot.data.seriesId,
                amount,
                maximumWithTolerance(preview.data.preview.sharesBurned),
                wallet,
                minimumWithTolerance(preview.data.preview.collateralOut)
              );
        await recordAndSend({
          kind: asset === "ETH" ? "recombine-eth" : "recombine-weth",
          label: `Recombine to ${asset}`,
          to: deployment.contracts.gateway,
          data,
          validateSimulation: (result) =>
            void validateRecombinationSimulation(functionName, result),
        });
        setAmountInput("");
      }
      await snapshot.refetch();
    } catch (error) {
      setActionError(describeDollarError(error));
    } finally {
      setPendingAction(null);
    }
  };

  const revokeRisk = async () => {
    setPendingAction("revoke");
    setActionError(null);
    try {
      await recordAndSend({
        kind: "revoke-risk",
        label: "Revoke Risk share operator",
        to: deployment.contracts.risk,
        data: encodeFunctionData({
          abi: staticsDollarRiskTokenAbi,
          functionName: "setApprovalForAll",
          args: [deployment.contracts.gateway, false],
        }),
      });
      await snapshot.refetch();
    } catch (error) {
      setActionError(describeDollarError(error));
    } finally {
      setPendingAction(null);
    }
  };

  // Hooks cannot sit behind the preview early-return below, so this reads
  // through snapshot.data and stays disabled until there is state to read.
  const supplySeriesId = snapshot.data?.seriesId;
  const supplyPeriphery = snapshot.data?.periphery;
  const supplyState = useQuery({
    queryKey: [
      "dollar-supply",
      deployment.chainId,
      wallet,
      supplySeriesId?.toString(),
      supplyPeriphery,
    ],
    enabled:
      Boolean(publicClient) &&
      supplySeriesId !== undefined &&
      Boolean(supplyPeriphery) &&
      supplyPeriphery !== zeroAddress,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!publicClient || supplySeriesId === undefined || !supplyPeriphery) {
        throw new Error("Dollar state is not ready.");
      }
      return loadDollarSupplyState(
        publicClient,
        deployment.contracts.diamond,
        supplyPeriphery,
        deployment.contracts.risk,
        wallet,
        supplySeriesId,
        deployment.deploymentStartBlock
      );
    },
  });
  const supply = supplyState.data ?? emptyDollarSupplyState;

  if ((snapshot.isPending || snapshot.isError) && !snapshot.data) {
    return <DollarPagePreview />;
  }

  const state = snapshot.data!;

  const actionAvailability = isSupplyMode(mode)
    ? supplyActionAvailability(mode, amount, supply, state.series.status === 1)
    : deriveDollarActionAvailability({
        mode,
        asset,
        amount,
        quoteState,
        quoteError: quote.isError ? describeDollarError(quote.error) : null,
        quotedDollarAmount:
          currentQuote?.mode === "deposit" ? currentQuote.preview.staticsDollarMinted : undefined,
        snapshot: {
          profileKind: state.profile.kind,
          profileMode: state.profile.mode,
          seniorOutstanding: state.profile.seniorOutstanding,
          debtCeiling: state.profile.debtCeiling,
          seriesStatus: state.series.status,
          oracleAvailable: state.solvency.oracleAvailable,
          healthy: state.solvency.healthy,
          globalHealthPhase: state.globalHealth[0],
          pausedOperations: state.pausedOperations,
          nativeBalance: state.nativeBalance,
          wethBalance: state.wethBalance,
          dollarBalance: state.dollarBalance,
          riskBalance: state.riskBalance,
          wethAllowance: state.wethAllowance,
          dollarAllowance: state.dollarAllowance,
          riskApproved: state.riskApproved,
          peripheryDollarAllowance: state.peripheryDollarAllowance,
          redeemableLiquidity: state.redeemableLiquidity,
          pairingFillsPaused: (state.pausedOperations & DOLLAR_PAIRING_FILL_PAUSE) !== 0n,
        },
      });
  const balance =
    mode === "deposit"
      ? asset === "ETH"
        ? state.nativeBalance
        : state.wethBalance
      : mode === "supply"
        ? supply.walletShares
        : mode === "unsupply"
          ? // Only unconsumed shares can come back; the rest became proceeds.
            supply.effectiveShares
          : state.dollarBalance;
  const amountUnit = mode === "deposit" ? asset : isSupplyMode(mode) ? "Risk shares" : "Dollar";
  const preview = quote.data?.preview;
  const output =
    quote.data?.mode === "deposit"
      ? `${displayAmount(quote.data.preview.staticsDollarMinted)} Dollar + ${displayAmount(
          quote.data.preview.sharesMinted
        )} Risk`
      : quote.data?.mode === "recombine"
        ? `${displayAmount(quote.data.preview.collateralOut)} ${asset}`
        : quote.data?.mode === "redeem"
          ? `${displayAmount(quote.data.preview.collateralToRedeemer)} ${asset}`
          : "Enter an amount for an onchain preview";

  // Supplying has no quote of its own -- it moves a fixed number of shares --
  // so the preview slot shows position instead of price.
  const supplyOutput = isSupplyMode(mode)
    ? `${displayAmount(supply.effectiveShares)} supplied and redeemable against`
    : null;

  // A redemption is capped to whatever is opted in, so asking for more than the
  // book holds fills part of the order. Saying so before signing is the whole
  // difference between a partial fill and a surprise.
  const redeemShortfall =
    quote.data?.mode === "redeem" && quote.data.preview.staticsDollarRedeemed < quote.data.amount
      ? quote.data.preview.staticsDollarRedeemed
      : null;
  const previewLabel =
    quoteState === "ready"
      ? "Current preview"
      : quote.data
        ? `Previous preview · ${displayAmount(quote.data.amount)} ${
            quote.data.mode === "deposit" ? asset : "Dollar"
          }`
        : "Onchain preview";
  const anyPending = pendingAction !== null || peggedPending;

  return (
    <>
      <section className="dollar-metrics" aria-label="Dollar balances and health">
        <article>
          <span>ETH</span>
          <strong>{displayAmount(state.nativeBalance)}</strong>
        </article>
        <article>
          <span>WETH</span>
          <strong>{displayAmount(state.wethBalance)}</strong>
        </article>
        <article>
          <span>Dollar</span>
          <strong>{displayAmount(state.dollarBalance)}</strong>
        </article>
        <article>
          <span>Risk · series {state.seriesId.toString()}</span>
          <strong>{displayAmount(state.riskBalance)}</strong>
        </article>
      </section>

      <section className="dollar-workspace">
        <div className="dollar-action-card">
          <DollarProfilePills
            value={peggedSelected ? "USDG" : asset}
            peggedAvailable={Boolean(deployment.pegged)}
            disabled={anyPending}
            onChange={(choice) => {
              setAmountInput("");
              setActionError(null);
              if (choice === "USDG") {
                setPeggedSelected(true);
                return;
              }
              setPeggedSelected(false);
              setAsset(choice);
            }}
          />
          {peggedSelected && <PeggedDollarPanel embedded onPendingChange={setPeggedPending} />}
          <div className="dollar-tabs" aria-label="Dollar action" hidden={peggedSelected}>
            {(["deposit", "recombine", "redeem", "supply", "unsupply"] as const).map((choice) => (
              <button
                key={choice}
                type="button"
                className={mode === choice ? "active" : undefined}
                onClick={() => {
                  setMode(choice);
                  setActionError(null);
                }}
                disabled={anyPending}
              >
                {modeLabels[choice]}
              </button>
            ))}
          </div>
          <div className="dollar-field" hidden={peggedSelected}>
            <label htmlFor="dollar-amount">{amountUnit} amount</label>
            <div>
              <input
                id="dollar-amount"
                value={amountInput}
                onChange={(event) => {
                  setAmountInput(event.target.value);
                  setActionError(null);
                }}
                inputMode="decimal"
                placeholder="0.00"
                disabled={anyPending}
              />
              <button
                type="button"
                onClick={() => {
                  setAmountInput(formatUnits(balance, 18));
                  setActionError(null);
                }}
                disabled={anyPending || (mode === "deposit" && asset === "ETH")}
              >
                {mode === "deposit" && asset === "ETH" ? "Keep gas" : "Max"}
              </button>
            </div>
            <small>
              Available {displayAmount(balance)} {amountUnit}
              {mode === "redeem" &&
                ` · ${displayAmount(state.redeemableLiquidity)} Dollar redeemable right now`}
              {isSupplyMode(mode) &&
                ` · ${displayAmount(supply.effectiveShares)} currently supplied`}
            </small>
          </div>
          <div className="dollar-quote" hidden={peggedSelected}>
            <span>{isSupplyMode(mode) ? "Your Risk shares" : previewLabel}</span>
            <strong>{supplyOutput ?? output}</strong>
            {preview && (
              <small>
                {quoteState === "ready"
                  ? "Current input verified. Bounds include 0.50% execution tolerance."
                  : "Refreshing for the current input; submission remains disabled."}
              </small>
            )}
          </div>
          {!peggedSelected && redeemShortfall !== null && (
            <p className="dollar-warning" role="status">
              Only {displayAmount(redeemShortfall)} of the {displayAmount(quote.data!.amount)}{" "}
              Dollar you entered can be redeemed right now -- that is all the Risk shares currently
              opted in. The rest stays in your wallet.
            </p>
          )}
          {!peggedSelected && mode === "supply" && (
            <p className="dollar-note">
              Supplying lets Dollar holders redeem without holding Risk shares of their own. Your
              shares become redeemable the moment this confirms, and you earn only where a
              redemption actually consumes them -- nothing accrues for sitting idle. Unconsumed
              shares stay withdrawable.
            </p>
          )}
          {!peggedSelected && mode === "unsupply" && (
            <p className="dollar-note">
              Withdrawing returns unconsumed Risk shares to this wallet. Shares a redemption already
              consumed are gone as shares -- they became proceeds, which you collect by claiming.
            </p>
          )}
          {!peggedSelected &&
            isSupplyMode(mode) &&
            hasClaimableProceeds(supply) &&
            supply.positionId !== null && (
              <div className="dollar-claim-row">
                <div>
                  <span>Proceeds to claim</span>
                  <strong>
                    {[
                      [supply.claimableCollateral, asset] as const,
                      [supply.claimableStaticsDollar, "Dollar"] as const,
                      [supply.claimableStatics, "STATICS"] as const,
                    ]
                      .filter(([value]) => value > 0n)
                      .map(([value, label]) => `${displayAmount(value)} ${label}`)
                      .join(" · ")}
                  </strong>
                </div>
                <button type="button" disabled={anyPending} onClick={() => void claimProceeds()}>
                  {pendingAction === "claim" ? "Waiting for confirmation…" : "Claim"}
                </button>
              </div>
            )}
          {!peggedSelected && mode === "redeem" && (
            <p className="dollar-note">
              Redeeming spends Risk shares somebody else opted in, so you do not need to hold any.
              Recombine instead if you hold both and want the full collateral.
            </p>
          )}
          {!peggedSelected && mode === "recombine" && !state.riskApproved && (
            <p className="dollar-warning">
              ERC-1155 approval covers every Risk series, not only series{" "}
              {state.seriesId.toString()}. The gateway is fixed by the verified deployment and
              approval can be revoked below.
            </p>
          )}
          {!peggedSelected && actionAvailability.reason && (
            <p className="dollar-action-reason">{actionAvailability.reason}</p>
          )}
          {!peggedSelected && actionError && (
            <p className="dapp-inline-error" role="alert">
              {actionError}
            </p>
          )}
          <button
            className="dollar-submit"
            type="button"
            onClick={() => void executeNextAction()}
            disabled={anyPending || !actionAvailability.executable}
            hidden={peggedSelected}
          >
            {pendingAction === "primary" ? "Waiting for confirmation…" : actionAvailability.label}
          </button>
        </div>

        {peggedSelected && (
          <aside className="dollar-protocol-card">
            <p className="dapp-section-label">USDG profile</p>
            <dl>
              <div>
                <dt>Profile</dt>
                <dd>#{deployment.pegged?.profileId.toString()}</dd>
              </div>
              <div>
                <dt>Collateral</dt>
                <dd>USDG</dd>
              </div>
              <div>
                <dt>Dollar received</dt>
                <dd>USDstx</dd>
              </div>
              <div>
                <dt>Risk shares</dt>
                <dd>None</dd>
              </div>
              <div>
                <dt>Gateway</dt>
                <dd title={deployment.contracts.gateway}>
                  {shortAddress(deployment.contracts.gateway)}
                </dd>
              </div>
            </dl>
            <p>
              USDG enters the pegged profile directly. It mints Statics Dollar without creating an
              ethLEV position.
            </p>
          </aside>
        )}
        <aside className="dollar-protocol-card" hidden={peggedSelected}>
          <p className="dapp-section-label" aria-live="polite">
            WETH profile{snapshot.isFetching ? " · refreshing" : ""}
          </p>
          <dl>
            <div>
              <dt>Health</dt>
              <dd>
                {!state.solvency.oracleAvailable
                  ? "Oracle unavailable"
                  : state.solvency.healthy
                    ? "Healthy"
                    : "Impaired"}
              </dd>
            </div>
            <div>
              <dt>Price feed</dt>
              <dd>${displayAmount(state.priceWad)}</dd>
            </div>
            <div>
              <dt>Collateral ratio</dt>
              <dd>{Number(state.profile.collateralRatioBps) / 100}%</dd>
            </div>
            <div>
              <dt>Debt</dt>
              <dd>{displayAmount(state.profile.seniorOutstanding)} Dollar</dd>
            </div>
            <div>
              <dt>Borrow limit</dt>
              <dd>{displayAmount(state.profile.debtCeiling)} Dollar</dd>
            </div>
            <div>
              <dt>Profile mode</dt>
              <dd>{profileModeLabel(state.profile.mode)}</dd>
            </div>
            <div>
              <dt>Series state</dt>
              <dd>{seriesStatusLabel(state.series.status)}</dd>
            </div>
            <div>
              <dt>Paused mask</dt>
              <dd>{state.pausedOperations.toString()}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{globalHealthLabel(state.globalHealth[0])}</dd>
            </div>
            <div>
              <dt>Gateway</dt>
              <dd title={deployment.contracts.gateway}>
                {shortAddress(deployment.contracts.gateway)}
              </dd>
            </div>
          </dl>
          {state.riskApproved && (
            <button type="button" onClick={() => void revokeRisk()} disabled={anyPending}>
              {pendingAction === "revoke" ? "Revoking…" : "Revoke Risk operator"}
            </button>
          )}
          <p>
            Receiver is fixed to {shortAddress(wallet)}. Quotes are refreshed and simulated before
            the wallet receives a signing request.
          </p>
          {evesMarketUrl ? (
            <a href={evesMarketUrl} target="_blank" rel="noreferrer">
              Continue to Eves Market ↗
            </a>
          ) : (
            <span className="dollar-disabled-link" aria-disabled="true">
              Eves Market link unavailable
            </span>
          )}
        </aside>
      </section>
    </>
  );
}

export function DollarPage() {
  const wallet = useWalletState();
  if (dappPreviewEnabled) {
    return <DollarPagePreview />;
  }
  if (deploymentState.status === "unavailable") {
    return <DollarPagePreview />;
  }
  if (wallet.status !== "ready" || !wallet.address) return <DollarPagePreview />;
  if (!wallet.isTargetChain) {
    return <DollarPagePreview />;
  }
  return (
    <DollarActionPanel
      deployment={deploymentState.deployment}
      wallet={getAddress(wallet.address)}
    />
  );
}
