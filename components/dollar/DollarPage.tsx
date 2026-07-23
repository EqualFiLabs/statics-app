"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
} from "@/lib/dollar/activity";
import {
  readClientDollarDeployment,
  verifyDollarDeployment,
  type DollarDeployment,
} from "@/lib/dollar/deployment";
import {
  describeDollarError,
  maximumWithTolerance,
  minimumWithTolerance,
} from "@/lib/dollar/transactions";
import { useWalletState } from "@/providers/wallet-context";
import { readEvesMarketUrl } from "@/lib/site-config";

const deploymentState = readClientDollarDeployment();
const evesMarketUrl = readEvesMarketUrl(process.env.NEXT_PUBLIC_EVES_MARKET_URL);

type ActionMode = "deposit" | "recombine";
type CollateralChoice = "ETH" | "WETH";

function shortAddress(address: Address): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function displayAmount(value: bigint, decimals = 18, precision = 4): string {
  const formatted = formatUnits(value, decimals);
  const [whole, fraction = ""] = formatted.split(".");
  return fraction ? `${whole}.${fraction.slice(0, precision)}`.replace(/\.$/, "") : whole;
}

function deploymentUnavailable(reason: string) {
  return (
    <section className="dollar-unavailable" aria-labelledby="dollar-unavailable-title">
      <p className="dapp-section-label">Dollar unavailable</p>
      <h2 id="dollar-unavailable-title">No verified deployment is configured.</h2>
      <p>{reason} Robinhood Testnet actions remain disabled until a reviewed deployment exists.</p>
    </section>
  );
}

function walletPrompt(status: ReturnType<typeof useWalletState>["status"]) {
  const message =
    status === "signed-out"
      ? "Sign in to read your balances and prepare a Dollar action."
      : status === "wallet-missing"
        ? "Create or connect a wallet before using Dollar."
        : "Wallet configuration is required before Dollar can connect.";
  return (
    <section className="dollar-unavailable">
      <p className="dapp-section-label">Wallet required</p>
      <h2>{message}</h2>
      <p>The app will present one required wallet or network step at a time.</p>
    </section>
  );
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
  if (snapshot.isPending) return <p className="dollar-loading">Reading verified Dollar state…</p>;
  if (snapshot.isError) {
    return <p className="dapp-inline-error">{describeDollarError(snapshot.error)}</p>;
  }
  const data = snapshot.data;
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
  if (deploymentState.status === "unavailable") {
    return deploymentUnavailable(deploymentState.reason);
  }
  if (wallet.status !== "ready" || !wallet.address || !wallet.isTargetChain) {
    return walletPrompt(wallet.status);
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
  const [mode, setMode] = useState<ActionMode>("deposit");
  const [asset, setAsset] = useState<CollateralChoice>("ETH");
  const [amountInput, setAmountInput] = useState("");
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const amount = useMemo(() => {
    try {
      return amountInput ? parseUnits(amountInput, 18) : 0n;
    } catch {
      return 0n;
    }
  }, [amountInput]);

  const quote = useQuery({
    queryKey: [
      "dollar-quote",
      deployment.chainId,
      mode,
      amount.toString(),
      snapshot.data?.seriesId,
    ],
    enabled: amount > 0n && Boolean(publicClient) && Boolean(snapshot.data),
    queryFn: async () => {
      if (!publicClient || !snapshot.data) throw new Error("Dollar state is not ready.");
      if (mode === "deposit") {
        const preview = await publicClient.readContract({
          address: deployment.contracts.core,
          abi: staticsDollarCoreAbi,
          functionName: "previewDeposit",
          args: [deployment.wethProfileId, amount],
        });
        return { mode: "deposit" as const, preview };
      }
      const preview = await publicClient.readContract({
        address: deployment.contracts.core,
        abi: staticsDollarCoreAbi,
        functionName: "previewRecombine",
        args: [snapshot.data.seriesId, amount],
      });
      return { mode: "recombine" as const, preview };
    },
  });

  const recordAndSend = async (kind: DollarActivityKind, label: string, data: Hex, value = 0n) => {
    if (!publicClient || !walletClient.data)
      throw new Error("The connected wallet is unavailable.");
    const id = crypto.randomUUID();
    writeDollarActivity({
      id,
      wallet,
      chainId: deployment.chainId,
      kind,
      label,
      amount: amountInput || "0",
      status: "signing",
      createdAt: Date.now(),
    });
    try {
      await publicClient.call({
        account: wallet,
        to: deployment.contracts.gateway,
        data,
        value,
      });
      const hash = await walletClient.data.sendTransaction({
        account: wallet,
        chain: walletClient.data.chain,
        to: deployment.contracts.gateway,
        data,
        value,
      });
      updateDollarActivity(wallet, deployment.chainId, id, { hash, status: "submitted" });
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 1,
        onReplaced: (replacement) => {
          updateDollarActivity(wallet, deployment.chainId, id, {
            status: "replaced",
            replacementHash: replacement.transaction.hash,
          });
        },
      });
      if (receipt.status !== "success") throw new Error("The transaction reverted onchain.");
      updateDollarActivity(wallet, deployment.chainId, id, {
        hash: receipt.transactionHash,
        status: "confirmed",
      });
    } catch (error) {
      updateDollarActivity(wallet, deployment.chainId, id, {
        status: "reverted",
        error: describeDollarError(error),
      });
      throw error;
    }
  };

  const sendApproval = async (
    kind: DollarActivityKind,
    label: string,
    token: Address,
    data: Hex
  ) => {
    if (!publicClient || !walletClient.data)
      throw new Error("The connected wallet is unavailable.");
    const id = crypto.randomUUID();
    writeDollarActivity({
      id,
      wallet,
      chainId: deployment.chainId,
      kind,
      label,
      amount: amountInput || "0",
      status: "signing",
      createdAt: Date.now(),
    });
    try {
      await publicClient.call({ account: wallet, to: token, data });
      const hash = await walletClient.data.sendTransaction({
        account: wallet,
        chain: walletClient.data.chain,
        to: token,
        data,
      });
      updateDollarActivity(wallet, deployment.chainId, id, { hash, status: "submitted" });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("The approval reverted onchain.");
      updateDollarActivity(wallet, deployment.chainId, id, { status: "confirmed" });
    } catch (error) {
      updateDollarActivity(wallet, deployment.chainId, id, {
        status: "reverted",
        error: describeDollarError(error),
      });
      throw error;
    }
  };

  const executeNextAction = async () => {
    setPending(true);
    setActionError(null);
    try {
      if (!snapshot.data || amount <= 0n) throw new Error("Enter a valid amount.");
      if (!quote.data) throw new Error("Wait for a fresh protocol preview.");

      if (mode === "deposit" && asset === "WETH" && snapshot.data.wethAllowance !== amount) {
        await sendApproval(
          "approve-weth",
          "Approve exact WETH",
          deployment.contracts.weth,
          encodeFunctionData({
            abi: wethAbi,
            functionName: "approve",
            args: [deployment.contracts.gateway, amount],
          })
        );
      } else if (mode === "recombine" && snapshot.data.dollarAllowance !== amount) {
        await sendApproval(
          "approve-dollar",
          "Approve exact Dollar",
          deployment.contracts.dollar,
          encodeFunctionData({
            abi: staticsDollarTokenAbi,
            functionName: "approve",
            args: [deployment.contracts.gateway, amount],
          })
        );
      } else if (mode === "recombine" && !snapshot.data.riskApproved) {
        await sendApproval(
          "approve-risk",
          "Approve Risk share operator",
          deployment.contracts.risk,
          encodeFunctionData({
            abi: staticsDollarRiskTokenAbi,
            functionName: "setApprovalForAll",
            args: [deployment.contracts.gateway, true],
          })
        );
      } else if (quote.data.mode === "deposit") {
        const preview = await quote.refetch();
        if (!preview.data || preview.data.mode !== "deposit")
          throw new Error("Preview refresh failed.");
        const minimumDollar = minimumWithTolerance(preview.data.preview.staticsDollarMinted);
        const minimumShares = minimumWithTolerance(preview.data.preview.sharesMinted);
        const transaction =
          asset === "ETH"
            ? buildDepositETHTransaction(amount, wallet, wallet, minimumDollar, minimumShares)
            : {
                data: buildDepositWETHCall(amount, wallet, wallet, minimumDollar, minimumShares),
                value: 0n,
              };
        await recordAndSend(
          asset === "ETH" ? "deposit-eth" : "deposit-weth",
          `Deposit ${asset}`,
          transaction.data,
          transaction.value
        );
        setAmountInput("");
      } else {
        const preview = await quote.refetch();
        if (!preview.data || preview.data.mode !== "recombine") {
          throw new Error("Preview refresh failed.");
        }
        const data =
          asset === "ETH"
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
        await recordAndSend(
          asset === "ETH" ? "recombine-eth" : "recombine-weth",
          `Recombine to ${asset}`,
          data
        );
        setAmountInput("");
      }
      await snapshot.refetch();
      await quote.refetch();
    } catch (error) {
      setActionError(describeDollarError(error));
    } finally {
      setPending(false);
    }
  };

  const revokeRisk = async () => {
    setPending(true);
    setActionError(null);
    try {
      await sendApproval(
        "revoke-risk",
        "Revoke Risk share operator",
        deployment.contracts.risk,
        encodeFunctionData({
          abi: staticsDollarRiskTokenAbi,
          functionName: "setApprovalForAll",
          args: [deployment.contracts.gateway, false],
        })
      );
      await snapshot.refetch();
    } catch (error) {
      setActionError(describeDollarError(error));
    } finally {
      setPending(false);
    }
  };

  if (snapshot.isPending)
    return <p className="dollar-loading">Verifying deployment and balances…</p>;
  if (snapshot.isError) {
    return <p className="dapp-inline-error">{describeDollarError(snapshot.error)}</p>;
  }

  const state = snapshot.data;
  const nextAction =
    amount <= 0n
      ? mode === "deposit"
        ? `Enter ${asset} amount`
        : "Enter Dollar amount"
      : mode === "deposit" && asset === "WETH" && state.wethAllowance !== amount
        ? "Approve exact WETH"
        : mode === "recombine" && state.dollarAllowance !== amount
          ? "Approve exact Dollar"
          : mode === "recombine" && !state.riskApproved
            ? "Approve Risk operator"
            : mode === "deposit"
              ? `Deposit ${asset}`
              : `Recombine to ${asset}`;
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
                onClick={() => setMode(choice)}
                disabled={pending}
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
                onChange={(event) => setAmountInput(event.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                disabled={pending}
              />
              <button
                type="button"
                onClick={() => setAmountInput(formatUnits(balance, 18))}
                disabled={pending || (mode === "deposit" && asset === "ETH")}
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
                onClick={() => setAsset(choice)}
                disabled={pending}
              >
                {choice}
              </button>
            ))}
          </fieldset>
          <div className="dollar-quote">
            <span>Fresh preview</span>
            <strong>{quote.isFetching ? "Refreshing…" : output}</strong>
            {preview && <small>Bounds include 0.50% execution tolerance.</small>}
          </div>
          {mode === "recombine" && !state.riskApproved && (
            <p className="dollar-warning">
              ERC-1155 approval covers every Risk series, not only series{" "}
              {state.seriesId.toString()}. The gateway is fixed by the verified deployment and
              approval can be revoked below.
            </p>
          )}
          {actionError && <p className="dapp-inline-error">{actionError}</p>}
          <button
            className="dollar-submit"
            type="button"
            onClick={() => void executeNextAction()}
            disabled={pending || amount <= 0n || quote.isFetching || !quote.data}
          >
            {pending ? "Waiting for confirmation…" : nextAction}
          </button>
        </div>

        <aside className="dollar-protocol-card">
          <p className="dapp-section-label">WETH profile</p>
          <dl>
            <div>
              <dt>Health</dt>
              <dd>{state.solvency.healthy ? "Healthy" : "Impaired"}</dd>
            </div>
            <div>
              <dt>Oracle</dt>
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
              <dt>Debt ceiling</dt>
              <dd>{displayAmount(state.profile.debtCeiling)} Dollar</dd>
            </div>
            <div>
              <dt>Paused mask</dt>
              <dd>{state.pausedOperations.toString()}</dd>
            </div>
            <div>
              <dt>Exit state</dt>
              <dd>{state.globalHealth[0] === 0 ? "Available" : "Restricted"}</dd>
            </div>
            <div>
              <dt>Gateway</dt>
              <dd title={deployment.contracts.gateway}>
                {shortAddress(deployment.contracts.gateway)}
              </dd>
            </div>
          </dl>
          {state.riskApproved && (
            <button type="button" onClick={() => void revokeRisk()} disabled={pending}>
              Revoke Risk operator
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
  if (deploymentState.status === "unavailable") {
    return deploymentUnavailable(deploymentState.reason);
  }
  if (wallet.status !== "ready" || !wallet.address) return walletPrompt(wallet.status);
  if (!wallet.isTargetChain) {
    return (
      <section className="dollar-unavailable">
        <p className="dapp-section-label">Network required</p>
        <h2>Switch to {wallet.networkName} to continue.</h2>
        <p>The wallet control above is the only required next action.</p>
      </section>
    );
  }
  return (
    <DollarActionPanel
      deployment={deploymentState.deployment}
      wallet={getAddress(wallet.address)}
    />
  );
}
