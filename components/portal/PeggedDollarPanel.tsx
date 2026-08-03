"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  encodeFunctionData,
  formatUnits,
  getAddress,
  parseUnits,
} from "viem";
import {
  basketTokenAbi,
  buildMintPeggedCall,
  buildRedeemPeggedCall,
  staticsAbi,
} from "@statics-protocol/sdk";

import { readClientDollarDeployment, verifyDollarDeployment } from "@/lib/dollar/deployment";
import {
  validatePeggedMintSimulation,
  validatePeggedRedemptionSimulation,
} from "@/lib/dollar/pegged";
import {
  describeDollarError,
  maximumWithTolerance,
  minimumWithTolerance,
} from "@/lib/dollar/transactions";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { useWalletState } from "@/providers/wallet-context";

type Direction = "mint" | "redeem";
type PeggedQuote =
  | {
      direction: "mint";
      amount: bigint;
      totalCollateralIn: bigint;
      feeAmount: bigint;
      priceWad: bigint;
    }
  | {
      direction: "redeem";
      amount: bigint;
      collateralOut: bigint;
      feeAmount: bigint;
      priceWad: bigint;
    };
type Snapshot = {
  collateralBalance: bigint;
  dollarBalance: bigint;
  collateralAllowance: bigint;
  dollarAllowance: bigint;
};

function deploymentState() {
  try {
    return readClientDollarDeployment();
  } catch {
    return { status: "unavailable" as const, reason: "Invalid deployment configuration." };
  }
}

const configuredDeploymentState = deploymentState();

function display(value: bigint | undefined, decimals: number, symbol?: string) {
  if (value === undefined) return "--";
  const [whole, fraction = ""] = formatUnits(value, decimals).split(".");
  const number = fraction
    ? `${whole}.${fraction.slice(0, 6).replace(/0+$/, "")}`.replace(/\.$/, "")
    : whole;
  return symbol ? `${number} ${symbol}` : number;
}

async function walletClients(wallet: ReturnType<typeof useWalletState>) {
  if (!wallet.address) throw new Error("Connect a wallet first.");
  const provider = await wallet.getEthereumProvider();
  if (!provider) throw new Error("The connected wallet is unavailable.");
  const account = getAddress(wallet.address);
  return {
    account,
    publicClient: createPublicClient({ transport: custom(provider) }),
    walletClient: createWalletClient({ account, transport: custom(provider) }),
  };
}

export function PeggedDollarPanel() {
  const wallet = useWalletState();
  const configured = configuredDeploymentState;
  const deployment = configured.status === "configured" ? configured.deployment : null;
  const [direction, setDirection] = useState<Direction>("mint");
  const [amountInput, setAmountInput] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [quote, setQuote] = useState<PeggedQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  let amount = 0n;
  try {
    amount = amountInput ? parseUnits(amountInput, 18) : 0n;
  } catch {
    amount = 0n;
  }

  const readSnapshot = useCallback(async () => {
    if (!deployment?.pegged || !wallet.address || wallet.chainId !== deployment.chainId)
      return null;
    const { account, publicClient } = await walletClients(wallet);
    await verifyDollarDeployment(publicClient, deployment);
    const [collateralBalance, dollarBalance, collateralAllowance, dollarAllowance] =
      await Promise.all([
        publicClient.readContract({
          address: deployment.pegged.collateral,
          abi: basketTokenAbi,
          functionName: "balanceOf",
          args: [account],
        }),
        publicClient.readContract({
          address: deployment.contracts.dollar,
          abi: basketTokenAbi,
          functionName: "balanceOf",
          args: [account],
        }),
        publicClient.readContract({
          address: deployment.pegged.collateral,
          abi: basketTokenAbi,
          functionName: "allowance",
          args: [account, deployment.contracts.gateway],
        }),
        publicClient.readContract({
          address: deployment.contracts.dollar,
          abi: basketTokenAbi,
          functionName: "allowance",
          args: [account, deployment.contracts.gateway],
        }),
      ]);
    const next = { collateralBalance, dollarBalance, collateralAllowance, dollarAllowance };
    setSnapshot(next);
    return next;
  }, [deployment, wallet]);

  useEffect(() => {
    if (!deployment || !wallet.address || wallet.chainId !== deployment.chainId) {
      const timeout = window.setTimeout(() => setSnapshot(null), 0);
      return () => window.clearTimeout(timeout);
    }
    const timeout = window.setTimeout(() => void readSnapshot().catch(() => undefined), 0);
    return () => window.clearTimeout(timeout);
  }, [deployment, readSnapshot, wallet.address, wallet.chainId]);

  const readQuote = useCallback(async () => {
    if (!deployment?.pegged || amount <= 0n) throw new Error("Enter an amount.");
    const { publicClient } = await walletClients(wallet);
    await verifyDollarDeployment(publicClient, deployment);
    if (direction === "mint") {
      const preview = await publicClient.readContract({
        address: deployment.contracts.gateway,
        abi: staticsAbi,
        functionName: "previewPeggedMint",
        args: [deployment.pegged.profileId, amount],
      });
      return {
        direction,
        amount,
        totalCollateralIn: preview.totalCollateralIn,
        feeAmount: preview.feeAmount,
        priceWad: preview.priceWad,
      } as PeggedQuote;
    }
    const preview = await publicClient.readContract({
      address: deployment.contracts.gateway,
      abi: staticsAbi,
      functionName: "previewPeggedRedemption",
      args: [deployment.pegged.profileId, amount],
    });
    return {
      direction,
      amount,
      collateralOut: preview.collateralOut,
      feeAmount: preview.feeAmount,
      priceWad: preview.priceWad,
    } as PeggedQuote;
  }, [amount, deployment, direction, wallet]);

  useEffect(() => {
    if (
      !deployment?.pegged ||
      !wallet.address ||
      wallet.chainId !== deployment.chainId ||
      amount <= 0n
    ) {
      const timeout = window.setTimeout(() => {
        setReviewing(false);
        setError(null);
        setQuote(null);
      }, 0);
      return () => window.clearTimeout(timeout);
    }
    let active = true;
    const timeout = window.setTimeout(() => {
      setQuoteLoading(true);
      void readQuote()
        .then((next) => {
          if (active) setQuote(next);
        })
        .catch(() => {
          if (active) setQuote(null);
        })
        .finally(() => {
          if (active) setQuoteLoading(false);
        });
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [amount, deployment, direction, readQuote, wallet.address, wallet.chainId]);

  const send = async (
    kind: "approve-pegged-collateral" | "approve-dollar" | "mint-pegged" | "redeem-pegged",
    label: string,
    activityAmount: string,
    target: `0x${string}`,
    data: `0x${string}`,
    options?: {
      validateSimulation?: (result: `0x${string}` | undefined) => void;
      verifyConfirmation?: () => Promise<void>;
    }
  ) => {
    if (!deployment) throw new Error("No Dollar deployment is configured.");
    const { account, publicClient, walletClient } = await walletClients(wallet);
    return executeProtocolTransaction({
      publicClient,
      wallet: account,
      chainId: deployment.chainId,
      kind,
      label,
      amount: activityAmount,
      to: target,
      data,
      sendTransaction: ({ to, data, value }) =>
        walletClient.sendTransaction({ account, chain: null, to, data, value }),
      describeError: describeDollarError,
      validateSimulation: options?.validateSimulation,
      verifyConfirmation: options?.verifyConfirmation
        ? async () => options.verifyConfirmation?.()
        : undefined,
    });
  };

  const nextAction = async () => {
    if (!deployment?.pegged || !quote || !snapshot || pending) return;
    setPending(true);
    setError(null);
    try {
      if (quote.direction === "mint") {
        const maximum = maximumWithTolerance(quote.totalCollateralIn);
        if (snapshot.collateralAllowance < maximum) {
          await send(
            "approve-pegged-collateral",
            "Approve bounded USDG",
            display(maximum, 6, "USDG"),
            deployment.pegged.collateral,
            encodeFunctionData({
              abi: basketTokenAbi,
              functionName: "approve",
              args: [deployment.contracts.gateway, maximum],
            }),
            {
              verifyConfirmation: async () => {
                const fresh = await readSnapshot();
                if (!fresh || fresh.collateralAllowance < maximum) {
                  throw new Error("The confirmed USDG allowance is below the reviewed bound.");
                }
              },
            }
          );
          await readSnapshot();
          return;
        }
      } else if (snapshot.dollarAllowance < quote.amount) {
        await send(
          "approve-dollar",
          "Approve exact Statics Dollar",
          display(quote.amount, 18, "sUSD"),
          deployment.contracts.dollar,
          encodeFunctionData({
            abi: basketTokenAbi,
            functionName: "approve",
            args: [deployment.contracts.gateway, quote.amount],
          }),
          {
            verifyConfirmation: async () => {
              const fresh = await readSnapshot();
              if (!fresh || fresh.dollarAllowance < quote.amount) {
                throw new Error("The confirmed Dollar allowance is below the reviewed amount.");
              }
            },
          }
        );
        await readSnapshot();
        return;
      }
      setReviewing(true);
    } catch (cause) {
      setError(describeDollarError(cause));
    } finally {
      setPending(false);
    }
  };

  const confirm = async () => {
    if (!deployment?.pegged || !quote || !snapshot || pending) return;
    setPending(true);
    setError(null);
    try {
      const fresh = await readQuote();
      const before = snapshot;
      if (quote.direction === "mint" && fresh.direction === "mint") {
        const maximum = maximumWithTolerance(quote.totalCollateralIn);
        if (fresh.totalCollateralIn > maximum) {
          setQuote(fresh);
          setReviewing(false);
          throw new Error("The required USDG moved above the reviewed maximum.");
        }
        await send(
          "mint-pegged",
          "Mint Statics Dollar with USDG",
          display(quote.amount, 18, "sUSD"),
          deployment.contracts.gateway,
          buildMintPeggedCall(
            deployment.pegged.profileId,
            quote.amount,
            maximum,
            getAddress(wallet.address!)
          ),
          {
            validateSimulation: (result) => void validatePeggedMintSimulation(result),
            verifyConfirmation: async () => {
              const next = await readSnapshot();
              if (!next || next.dollarBalance < before.dollarBalance + quote.amount) {
                throw new Error(
                  "The confirmed Statics Dollar balance did not increase as expected."
                );
              }
            },
          }
        );
      } else if (quote.direction === "redeem" && fresh.direction === "redeem") {
        const minimum = minimumWithTolerance(quote.collateralOut);
        if (fresh.collateralOut < minimum) {
          setQuote(fresh);
          setReviewing(false);
          throw new Error("The USDG output moved below the reviewed minimum.");
        }
        await send(
          "redeem-pegged",
          "Redeem Statics Dollar for USDG",
          display(quote.amount, 18, "sUSD"),
          deployment.contracts.gateway,
          buildRedeemPeggedCall(
            deployment.pegged.profileId,
            quote.amount,
            minimum,
            getAddress(wallet.address!)
          ),
          {
            validateSimulation: (result) => void validatePeggedRedemptionSimulation(result),
            verifyConfirmation: async () => {
              const next = await readSnapshot();
              if (
                !next ||
                next.dollarBalance > before.dollarBalance - quote.amount ||
                next.collateralBalance <= before.collateralBalance
              ) {
                throw new Error("The confirmed redemption balances did not change as expected.");
              }
            },
          }
        );
      } else {
        throw new Error("The fresh quote no longer matches the reviewed direction.");
      }
      await readSnapshot();
      setAmountInput("");
      setQuote(null);
      setReviewing(false);
    } catch (cause) {
      setError(describeDollarError(cause));
    } finally {
      setPending(false);
    }
  };

  const requiredApproval =
    quote?.direction === "mint" ? maximumWithTolerance(quote.totalCollateralIn) : quote?.amount;
  const needsApproval =
    quote?.direction === "mint"
      ? snapshot !== null &&
        requiredApproval !== undefined &&
        snapshot.collateralAllowance < requiredApproval
      : snapshot !== null &&
        requiredApproval !== undefined &&
        snapshot.dollarAllowance < requiredApproval;
  const balanceInsufficient =
    quote?.direction === "mint"
      ? snapshot !== null && snapshot.collateralBalance < quote.totalCollateralIn
      : quote?.direction === "redeem"
        ? snapshot !== null && snapshot.dollarBalance < quote.amount
        : false;

  const primary = () => {
    if (wallet.status === "signed-out") return wallet.login();
    if (deployment && wallet.chainId !== deployment.chainId) return void wallet.switchNetwork();
    return void nextAction();
  };
  const label =
    wallet.status === "signed-out"
      ? "Connect wallet"
      : deployment && wallet.chainId !== deployment.chainId
        ? `Switch to ${wallet.networkName}`
        : pending
          ? needsApproval
            ? "Approving…"
            : "Preparing…"
          : quoteLoading
            ? "Reading quote…"
            : balanceInsufficient
              ? `Insufficient ${direction === "mint" ? "USDG" : "sUSD"}`
              : needsApproval
                ? `Approve ${direction === "mint" ? "USDG" : "sUSD"}`
                : direction === "mint"
                  ? "Review mint"
                  : "Review redemption";

  return (
    <div className="portal-panel" role="tabpanel">
      <div className="portal-direction-tabs" aria-label="Statics Dollar direction">
        {(["mint", "redeem"] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={direction === item}
            onClick={() => {
              setDirection(item);
              setAmountInput("");
              setQuote(null);
              setReviewing(false);
            }}
          >
            {item === "mint" ? "Mint" : "Redeem"}
          </button>
        ))}
      </div>
      <label className="portal-field portal-asset-field">
        <span>
          {direction === "mint" ? "Statics Dollar to receive" : "Statics Dollar to redeem"}
        </span>
        <div>
          <input
            inputMode="decimal"
            value={amountInput}
            placeholder="0.00"
            onChange={(event) => {
              setAmountInput(event.target.value);
              setQuote(null);
              setReviewing(false);
              setError(null);
            }}
          />
          <button type="button">sUSD</button>
        </div>
        <small>Balance {display(snapshot?.dollarBalance, 18, "sUSD")}</small>
      </label>
      <dl className="portal-quote-grid">
        <div>
          <dt>{direction === "mint" ? "Maximum USDG" : "Minimum USDG"}</dt>
          <dd>
            {quote?.direction === "mint"
              ? display(maximumWithTolerance(quote.totalCollateralIn), 6, "USDG")
              : quote?.direction === "redeem"
                ? display(minimumWithTolerance(quote.collateralOut), 6, "USDG")
                : "--"}
          </dd>
        </div>
        <div>
          <dt>Protocol fee</dt>
          <dd>{quote ? display(quote.feeAmount, 6, "USDG") : "--"}</dd>
        </div>
        <div>
          <dt>Profile</dt>
          <dd>{deployment?.pegged ? `#${deployment.pegged.profileId.toString()}` : "--"}</dd>
        </div>
      </dl>
      {reviewing && quote && (
        <div className="portal-review">
          <div>
            <span>
              {direction === "mint"
                ? display(
                    quote.direction === "mint" ? quote.totalCollateralIn : undefined,
                    6,
                    "USDG"
                  )
                : `${amountInput} sUSD`}
            </span>
            <strong>→</strong>
            <span>
              {direction === "mint"
                ? `${amountInput} sUSD`
                : display(
                    quote.direction === "redeem" ? quote.collateralOut : undefined,
                    6,
                    "USDG"
                  )}
            </span>
          </div>
        </div>
      )}
      {error && (
        <p className="portal-error" role="alert">
          {error}
        </p>
      )}
      {reviewing ? (
        <button
          className="portal-primary-action"
          type="button"
          disabled={pending}
          onClick={() => void confirm()}
        >
          {pending
            ? direction === "mint"
              ? "Minting…"
              : "Redeeming…"
            : direction === "mint"
              ? "Confirm mint"
              : "Confirm redemption"}
        </button>
      ) : (
        <button
          className="portal-primary-action"
          type="button"
          disabled={
            pending ||
            balanceInsufficient ||
            wallet.status === "unconfigured" ||
            (wallet.status !== "signed-out" &&
              (!deployment?.pegged ||
                (wallet.chainId === deployment.chainId && (!quote || !snapshot))))
          }
          onClick={primary}
        >
          {label}
        </button>
      )}
    </div>
  );
}
