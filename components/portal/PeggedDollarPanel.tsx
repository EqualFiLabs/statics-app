"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createPublicClient, createWalletClient, custom, formatUnits, getAddress } from "viem";
import {
  basketTokenAbi,
  buildErc20PermitTypedData,
  buildMintPeggedCall,
  buildMintPeggedWithPermitCall,
  buildRedeemPeggedCall,
  buildRedeemPeggedWithPermitCall,
  staticsAbi,
} from "@statics-protocol/sdk";
import { useSignTypedData } from "@privy-io/react-auth";

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
import {
  decodePermitSignature,
  exactPeggedMintPermitValue,
  permitDeadline,
  privyPermitRequest,
  signPermitForWallet,
} from "@/lib/dollar/permit";
import {
  executeProtocolTransaction,
  type ProtocolTransactionPresentation,
} from "@/lib/protocol/transactions";
import { MAX_ERC20_ALLOWANCE } from "@/lib/protocol/approvals";
import { permittedActionPresentation } from "@/lib/protocol/presentation";
import { useWalletState } from "@/providers/wallet-context";
import { useAppLocale } from "@/i18n/client";
import { parseLocalizedUnits } from "@/lib/i18n/amounts";

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

export function PeggedDollarPanel({
  embedded = false,
  onPendingChange,
}: {
  embedded?: boolean;
  onPendingChange?: (pending: boolean) => void;
}) {
  const t = useTranslations("portal");
  const locale = useAppLocale();
  const wallet = useWalletState();
  const { signTypedData: signEmbeddedTypedData } = useSignTypedData();
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
    amount = parseLocalizedUnits(amountInput, 18, locale);
  } catch {
    amount = 0n;
  }

  const updatePending = useCallback(
    (next: boolean) => {
      setPending(next);
      onPendingChange?.(next);
    },
    [onPendingChange]
  );

  useEffect(() => () => onPendingChange?.(false), [onPendingChange]);

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
    kind: "mint-pegged" | "redeem-pegged",
    label: string,
    activityAmount: string,
    target: `0x${string}`,
    data: `0x${string}`,
    options?: {
      validateSimulation?: (result: `0x${string}` | undefined) => void;
      verifyConfirmation?: () => Promise<void>;
      presentation?: ProtocolTransactionPresentation;
    }
  ) => {
    if (!deployment) throw new Error("No Dollar deployment is configured.");
    const { account, publicClient } = await walletClients(wallet);
    return executeProtocolTransaction({
      publicClient,
      wallet: account,
      chainId: deployment.chainId,
      kind,
      label,
      amount: activityAmount,
      to: target,
      data,
      sendTransaction: wallet.sendEvmTransaction,
      describeError: describeDollarError,
      presentation: options?.presentation,
      validateSimulation: options?.validateSimulation,
      verifyConfirmation: options?.verifyConfirmation
        ? async () => options.verifyConfirmation?.()
        : undefined,
    });
  };

  const signPermit = async (token: `0x${string}`, value: bigint) => {
    if (!deployment) throw new Error("No Dollar deployment is configured.");
    const { account, publicClient, walletClient } = await walletClients(wallet);
    const [tokenName, nonce, block] = await Promise.all([
      publicClient.readContract({
        address: token,
        abi: basketTokenAbi,
        functionName: "name",
      }),
      publicClient.readContract({
        address: token,
        abi: basketTokenAbi,
        functionName: "nonces",
        args: [account],
      }),
      publicClient.getBlock(),
    ]);
    const deadline = permitDeadline(block.timestamp);
    const typedData = buildErc20PermitTypedData({
      tokenName,
      chainId: deployment.chainId,
      token,
      owner: account,
      spender: deployment.contracts.gateway,
      value,
      nonce,
      deadline,
    });
    const signature = await signPermitForWallet({
      walletKind: wallet.walletKind,
      typedData,
      signEmbedded: async (permit) => {
        const request = privyPermitRequest(permit, account);
        const signed = await signEmbeddedTypedData(request.typedData, request.options);
        return signed.signature as `0x${string}`;
      },
      signExternal: (permit) =>
        walletClient.signTypedData({
          account,
          ...permit,
        }),
    });
    return decodePermitSignature(value, deadline, signature);
  };

  const nextAction = async () => {
    if (!deployment?.pegged || !quote || !snapshot || pending) return;
    updatePending(true);
    setError(null);
    try {
      setReviewing(true);
    } catch (cause) {
      setError(describeDollarError(cause));
    } finally {
      updatePending(false);
    }
  };

  const confirm = async () => {
    if (!deployment?.pegged || !quote || !snapshot || pending) return;
    updatePending(true);
    setError(null);
    try {
      const fresh = await readQuote();
      const before = (await readSnapshot()) ?? snapshot;
      if (quote.direction === "mint" && fresh.direction === "mint") {
        const maximum = maximumWithTolerance(quote.totalCollateralIn);
        try {
          exactPeggedMintPermitValue(fresh.totalCollateralIn, maximum);
        } catch (cause) {
          setQuote(fresh);
          setReviewing(false);
          throw cause;
        }
        const receiver = getAddress(wallet.address!);
        const usesPermit = before.collateralAllowance < fresh.totalCollateralIn;
        const data = usesPermit
          ? buildMintPeggedWithPermitCall(
              deployment.pegged.profileId,
              quote.amount,
              maximum,
              receiver,
              await signPermit(deployment.pegged.collateral, MAX_ERC20_ALLOWANCE)
            )
          : buildMintPeggedCall(deployment.pegged.profileId, quote.amount, maximum, receiver);
        await send(
          "mint-pegged",
          "Mint Statics Dollar with USDG",
          display(quote.amount, 18, "USDstx"),
          deployment.contracts.gateway,
          data,
          {
            presentation: usesPermit
              ? permittedActionPresentation({
                  action: "Mint Statics Dollar with USDG",
                  description: `Mint the reviewed ${display(quote.amount, 18, "USDstx")} using USDG.`,
                  asset: "USDG",
                  spender: deployment.contracts.gateway,
                  spenderName: "Statics Dollar Gateway",
                  contractName: "Statics Dollar Gateway",
                })
              : undefined,
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
        const receiver = getAddress(wallet.address!);
        const usesPermit = before.dollarAllowance < quote.amount;
        const data = usesPermit
          ? buildRedeemPeggedWithPermitCall(
              deployment.pegged.profileId,
              quote.amount,
              minimum,
              receiver,
              await signPermit(deployment.contracts.dollar, MAX_ERC20_ALLOWANCE)
            )
          : buildRedeemPeggedCall(deployment.pegged.profileId, quote.amount, minimum, receiver);
        await send(
          "redeem-pegged",
          "Redeem Statics Dollar for USDG",
          display(quote.amount, 18, "USDstx"),
          deployment.contracts.gateway,
          data,
          {
            presentation: usesPermit
              ? permittedActionPresentation({
                  action: "Redeem Statics Dollar for USDG",
                  description: `Redeem the reviewed ${display(quote.amount, 18, "USDstx")} for USDG.`,
                  asset: "USDstx",
                  spender: deployment.contracts.gateway,
                  spenderName: "Statics Dollar Gateway",
                  contractName: "Statics Dollar Gateway",
                })
              : undefined,
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
      updatePending(false);
    }
  };

  const balanceInsufficient =
    quote?.direction === "mint"
      ? snapshot !== null && snapshot.collateralBalance < quote.totalCollateralIn
      : quote?.direction === "redeem"
        ? snapshot !== null && snapshot.dollarBalance < quote.amount
        : false;

  const primary = () => {
    if (wallet.status === "signed-out" || wallet.status === "error") return wallet.login();
    if (wallet.status === "wallet-missing") return void wallet.createWallet();
    if (wallet.status !== "ready") return;
    if (deployment && wallet.chainId !== deployment.chainId) return void wallet.switchNetwork();
    return void nextAction();
  };
  const label =
    wallet.status === "signed-out" || wallet.status === "error"
      ? t("connectWallet")
      : wallet.status === "wallet-missing"
        ? t("createEmbeddedWallet")
        : wallet.status !== "ready"
          ? t("walletLoading")
          : deployment && wallet.chainId !== deployment.chainId
            ? t("switchTo", { network: wallet.networkName })
            : pending
              ? t("preparing")
              : quoteLoading
                ? t("readingQuote")
                : balanceInsufficient
                  ? t("insufficientAsset", {
                      symbol: direction === "mint" ? "USDG" : "USDstx",
                    })
                  : direction === "mint"
                    ? embedded
                      ? t("reviewDeposit")
                      : t("reviewMint")
                    : t("reviewRedemption");

  return (
    <div className={`portal-panel${embedded ? " dollar-pegged-panel" : ""}`} role="tabpanel">
      <div className="portal-direction-tabs" aria-label={t("dollarDirection")}>
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
            disabled={pending}
          >
            {item === "mint" ? (embedded ? t("deposit") : t("mint")) : t("redeem")}
          </button>
        ))}
      </div>
      <label className="portal-field portal-asset-field">
        <span>{direction === "mint" ? t("dollarToReceive") : t("dollarToRedeem")}</span>
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
            disabled={pending}
          />
          <button type="button" disabled={pending}>
            USDstx
          </button>
        </div>
        <small>{t("balance", { balance: display(snapshot?.dollarBalance, 18, "USDstx") })}</small>
      </label>
      <dl className="portal-quote-grid">
        <div>
          <dt>{direction === "mint" ? t("maximumUsdg") : t("minimumUsdg")}</dt>
          <dd>
            {quote?.direction === "mint"
              ? display(maximumWithTolerance(quote.totalCollateralIn), 6, "USDG")
              : quote?.direction === "redeem"
                ? display(minimumWithTolerance(quote.collateralOut), 6, "USDG")
                : "--"}
          </dd>
        </div>
        <div>
          <dt>{t("protocolFee")}</dt>
          <dd>{quote ? display(quote.feeAmount, 6, "USDG") : "--"}</dd>
        </div>
        <div>
          <dt>{t("profile")}</dt>
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
                : `${amountInput} USDstx`}
            </span>
            <strong>→</strong>
            <span>
              {direction === "mint"
                ? `${amountInput} USDstx`
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
              ? embedded
                ? "Depositing…"
                : "Minting…"
              : "Redeeming…"
            : direction === "mint"
              ? embedded
                ? "Confirm deposit"
                : "Confirm mint"
              : "Confirm redemption"}
        </button>
      ) : (
        <button
          className="portal-primary-action"
          type="button"
          disabled={
            pending ||
            (wallet.status !== "signed-out" &&
              wallet.status !== "error" &&
              wallet.status !== "wallet-missing" &&
              wallet.status !== "ready") ||
            (wallet.status === "ready" &&
              (balanceInsufficient ||
                !deployment?.pegged ||
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
