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
  staticsDollarRiskTokenAbi,
  staticsDollarTokenAbi,
  wethAbi,
} from "@statics-protocol/sdk";
import {
  encodeFunctionData,
  formatUnits,
  getAddress,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { usePublicClient, useWalletClient } from "wagmi";

import {
  updateDollarActivity,
  writeDollarActivity,
  type DollarActivityKind,
  type DollarActivityStatus,
  type DollarReplacementReason,
} from "@/lib/dollar/activity";
import {
  deriveDollarActionAvailability,
  dollarQuoteQueryKey,
  type DollarActionMode,
  type DollarCollateralChoice,
  type DollarQuoteState,
} from "@/lib/dollar/action-state";
import {
  readClientDollarDeployment,
  verifyDollarDeployment,
  type DollarDeployment,
} from "@/lib/dollar/deployment";
import {
  describeDollarError,
  isOnchainRevert,
  isWalletRejection,
  maximumWithTolerance,
  minimumWithTolerance,
  validateRecombinationSimulation,
} from "@/lib/dollar/transactions";
import { useWalletState } from "@/providers/wallet-context";
import { DollarOverviewPreview, DollarPagePreview } from "@/components/preview/DappPreview";
import { SurfaceEmptyState } from "@/components/common/EmptyState";
import { dappPreviewEnabled } from "@/lib/dapp-preview";
import { deriveSurfaceState } from "@/lib/surface-state";
import { readEvesMarketUrl } from "@/lib/site-config";

const deploymentState = readClientDollarDeployment();
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
      ]);
      return {
        profile,
        seriesId,
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
    <DollarOverviewConnected
      deployment={deploymentState.deployment}
      wallet={getAddress(wallet.address)}
    />
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
  const [amountInput, setAmountInput] = useState("");
  const [pendingAction, setPendingAction] = useState<"primary" | "revoke" | null>(null);
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
    enabled: amount > 0n && Boolean(publicClient) && Boolean(snapshot.data),
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
      createdAt: Date.now(),
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

  const executeNextAction = async () => {
    setPendingAction("primary");
    setActionError(null);
    try {
      if (!snapshot.data || amount <= 0n) throw new Error("Enter a valid amount.");
      if (!currentQuote || !actionAvailability.executable) {
        throw new Error(actionAvailability.reason || "Wait for a fresh protocol preview.");
      }

      if (actionAvailability.kind === "approve-weth") {
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
      } else if (actionAvailability.kind === "execute" && currentQuote.mode === "deposit") {
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

  if ((snapshot.isPending || snapshot.isError) && !snapshot.data) {
    return <DollarPagePreview />;
  }

  const state = snapshot.data!;
  const actionAvailability = deriveDollarActionAvailability({
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
    },
  });
  const balance =
    mode === "deposit"
      ? asset === "ETH"
        ? state.nativeBalance
        : state.wethBalance
      : state.dollarBalance;
  const preview = quote.data?.preview;
  const output =
    quote.data?.mode === "deposit"
      ? `${displayAmount(quote.data.preview.staticsDollarMinted)} Dollar + ${displayAmount(
          quote.data.preview.sharesMinted
        )} Risk`
      : quote.data?.mode === "recombine"
        ? `${displayAmount(quote.data.preview.collateralOut)} ${asset}`
        : "Enter an amount for an onchain preview";
  const previewLabel =
    quoteState === "ready"
      ? "Current preview"
      : quote.data
        ? `Previous preview · ${displayAmount(quote.data.amount)} ${
            quote.data.mode === "deposit" ? asset : "Dollar"
          }`
        : "Onchain preview";
  const anyPending = pendingAction !== null;

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
          <div className="dollar-tabs" aria-label="Dollar action">
            {(["deposit", "recombine"] as const).map((choice) => (
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
                {choice}
              </button>
            ))}
          </div>
          <div className="dollar-field">
            <label htmlFor="dollar-amount">{mode === "deposit" ? asset : "Dollar"} amount</label>
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
              Available {displayAmount(balance)} {mode === "deposit" ? asset : "Dollar"}
            </small>
          </div>
          <fieldset className="dollar-asset-choice">
            <legend>{mode === "deposit" ? "Deposit asset" : "Receive asset"}</legend>
            {(["ETH", "WETH"] as const).map((choice) => (
              <button
                key={choice}
                type="button"
                className={asset === choice ? "active" : undefined}
                onClick={() => {
                  setAsset(choice);
                  setActionError(null);
                }}
                disabled={anyPending}
              >
                {choice}
              </button>
            ))}
          </fieldset>
          <div className="dollar-quote">
            <span>{previewLabel}</span>
            <strong>{output}</strong>
            {preview && (
              <small>
                {quoteState === "ready"
                  ? "Current input verified. Bounds include 0.50% execution tolerance."
                  : "Refreshing for the current input; submission remains disabled."}
              </small>
            )}
          </div>
          {mode === "recombine" && !state.riskApproved && (
            <p className="dollar-warning">
              ERC-1155 approval covers every Risk series, not only series{" "}
              {state.seriesId.toString()}. The gateway is fixed by the verified deployment and
              approval can be revoked below.
            </p>
          )}
          {actionAvailability.reason && (
            <p className="dollar-action-reason">{actionAvailability.reason}</p>
          )}
          {actionError && (
            <p className="dapp-inline-error" role="alert">
              {actionError}
            </p>
          )}
          <button
            className="dollar-submit"
            type="button"
            onClick={() => void executeNextAction()}
            disabled={anyPending || !actionAvailability.executable}
          >
            {pendingAction === "primary" ? "Waiting for confirmation…" : actionAvailability.label}
          </button>
        </div>

        <aside className="dollar-protocol-card">
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
