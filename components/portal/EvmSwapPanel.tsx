"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  getAddress,
  type Address,
} from "viem";

import {
  getDefaultEvmSwapTokens,
  normalizeUniswapTransaction,
  uniswapError,
  type EvmSwapToken,
} from "@/lib/portal/uniswap";
import { useWalletTokens } from "@/hooks/useWalletTokens";
import { getFundingNetwork } from "@/lib/funding-networks";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import {
  SlippageInlineControl,
  SlippageSettingsDialog,
} from "@/components/portal/SlippageSettingsDialog";
import { usePortalSlippage } from "@/hooks/usePortalSlippage";
import { writePortalSlippage } from "@/lib/portal/slippage";
import { useWalletState } from "@/providers/wallet-context";
import { useAppLocale } from "@/i18n/client";
import { parseLocalizedUnits } from "@/lib/i18n/amounts";

const erc20BalanceAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
] as const;

type QuotePayload = {
  routing?: string;
  quote?: {
    input: { amount: string; token: string };
    output: { amount: string; token: string };
    aggregatedOutputs?: Array<{ amount: string; minAmount?: string; token: string }>;
    gasFeeUSD?: string;
    priceImpact?: number;
    quoteId?: string;
  };
  detail?: string;
  error?: string;
};

type SubmitState = "idle" | "approving" | "swapping";

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: text.slice(0, 500) };
  }
}

function displayAmount(raw: string | undefined, token: EvmSwapToken | undefined): string {
  if (!raw || !token) return "";
  const value = formatUnits(BigInt(raw), token.decimals);
  const [whole, fraction = ""] = value.split(".");
  return fraction
    ? `${whole}.${fraction.slice(0, 6).replace(/0+$/, "")}`.replace(/\.$/, "")
    : whole;
}

export function EvmSwapPanel() {
  const t = useTranslations("portal");
  const locale = useAppLocale();
  const wallet = useWalletState();
  const slippage = usePortalSlippage();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const walletTokens = useWalletTokens(wallet.fundingChainId);
  const tokens = useMemo(
    () => [
      ...getDefaultEvmSwapTokens(wallet.fundingChainId).filter((token) => token.kind === "native"),
      ...walletTokens.tokens.map((token): EvmSwapToken => ({
        address: token.address,
        decimals: token.decimals,
        kind: "erc20",
        name: token.name,
        symbol: token.symbol,
      })),
    ],
    [wallet.fundingChainId, walletTokens.tokens]
  );
  const [sourceAddress, setSourceAddress] = useState<string>(tokens[0]?.address ?? "");
  const [destinationAddress, setDestinationAddress] = useState<string>(tokens[1]?.address ?? "");
  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState<bigint | null>(null);
  const [quote, setQuote] = useState<QuotePayload | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const {
    address: walletAddress,
    fundingChainId,
    fundingWalletOnSelectedChain,
    getEthereumProvider,
  } = wallet;
  const source = tokens.find((token) => token.address === sourceAddress) ?? tokens[0];
  const destination =
    tokens.find(
      (token) => token.address === destinationAddress && token.address !== source?.address
    ) ?? tokens.find((token) => token.address !== source?.address);
  const parsedAmount = (() => {
    try {
      return source ? parseLocalizedUnits(amount, source.decimals, locale) : 0n;
    } catch {
      return 0n;
    }
  })();
  const insufficient = balance !== null && parsedAmount > balance;
  const submitting = submitState !== "idle";
  const outputRaw = quote?.quote?.output.amount;
  const minimumRaw =
    quote?.quote?.aggregatedOutputs?.[0]?.minAmount ??
    quote?.quote?.aggregatedOutputs?.[0]?.amount ??
    outputRaw;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSourceAddress(tokens[0]?.address ?? "");
      setDestinationAddress(tokens[1]?.address ?? "");
      setAmount("");
      setQuote(null);
      setReviewing(false);
      setError(null);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [tokens]);

  useEffect(() => {
    let active = true;
    const reset = window.setTimeout(() => {
      if (active) setBalance(null);
    }, 0);
    if (!walletAddress || !source || !fundingWalletOnSelectedChain) return;
    void (async () => {
      try {
        const provider = await getEthereumProvider();
        const network = getFundingNetwork(fundingChainId);
        if (!provider || !network) return;
        const publicClient = createPublicClient({
          chain: network.chain,
          transport: custom(provider),
        });
        const value =
          source.kind === "native"
            ? await publicClient.getBalance({ address: getAddress(walletAddress) })
            : await publicClient.readContract({
                address: source.address,
                abi: erc20BalanceAbi,
                functionName: "balanceOf",
                args: [getAddress(walletAddress)],
              });
        if (active) setBalance(value);
      } catch {
        if (active) setBalance(null);
      }
    })();
    return () => {
      active = false;
      window.clearTimeout(reset);
    };
  }, [source, walletAddress, fundingChainId, fundingWalletOnSelectedChain, getEthereumProvider]);

  const requestQuote = async (): Promise<QuotePayload> => {
    if (!wallet.address || !source || !destination || parsedAmount <= 0n) {
      throw new Error("Enter an amount and choose two assets.");
    }
    const response = await fetch("/api/uniswap/quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chainId: wallet.fundingChainId,
        tokenIn: source.address,
        tokenOut: destination.address,
        amount: parsedAmount.toString(),
        swapper: wallet.address,
        slippageTolerance: slippage,
      }),
    });
    const payload = (await readJson(response)) as QuotePayload;
    if (!response.ok || !payload.quote) {
      throw new Error(uniswapError(payload, "No swap route is available."));
    }
    return payload;
  };

  useEffect(() => {
    const canQuote =
      wallet.status === "ready" &&
      wallet.fundingWalletOnSelectedChain &&
      parsedAmount > 0n &&
      !insufficient &&
      Boolean(source && destination);
    if (!canQuote) {
      const timeout = window.setTimeout(() => {
        setQuote(null);
        setQuoteLoading(false);
      }, 0);
      return () => window.clearTimeout(timeout);
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setQuoteLoading(true);
      setError(null);
      void requestQuote()
        .then((next) => {
          if (!controller.signal.aborted) setQuote(next);
        })
        .catch((cause) => {
          if (!controller.signal.aborted) {
            setQuote(null);
            setError(cause instanceof Error ? cause.message : "No swap route is available.");
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setQuoteLoading(false);
        });
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
    // requestQuote is intentionally reconstructed from the listed quote inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    wallet.address,
    wallet.status,
    wallet.fundingChainId,
    wallet.fundingWalletOnSelectedChain,
    source?.address,
    destination?.address,
    parsedAmount,
    insufficient,
  ]);

  const sendTransaction = async (raw: unknown, kind: "approve-swap" | "swap", label: string) => {
    if (!wallet.address) throw new Error("Connect a wallet first.");
    const provider = await wallet.getEthereumProvider();
    const network = getFundingNetwork(wallet.fundingChainId);
    if (!provider || !network) throw new Error("The selected wallet is unavailable.");
    const account = getAddress(wallet.address);
    const transaction = normalizeUniswapTransaction(raw, {
      chainId: wallet.fundingChainId,
      wallet: account,
    });
    const publicClient = createPublicClient({
      chain: network.chain,
      transport: custom(provider),
    });
    const walletClient = createWalletClient({
      account,
      chain: network.chain,
      transport: custom(provider),
    });
    return executeProtocolTransaction({
      publicClient,
      wallet: account,
      chainId: wallet.fundingChainId,
      kind,
      label,
      amount: `${amount} ${source?.symbol ?? ""}`.trim(),
      to: transaction.to,
      data: transaction.data,
      value: transaction.value,
      sendTransaction: ({ to, data, value }) =>
        walletClient.sendTransaction({ account, chain: network.chain, to, data, value }),
      describeError: (cause) =>
        cause instanceof Error ? cause.message : "The wallet transaction failed.",
    });
  };

  const confirmSwap = async () => {
    if (!source || !destination || !quote?.quote || !wallet.address || submitting) return;
    setSubmitState("approving");
    setError(null);
    try {
      const fresh = await requestQuote();
      const reviewedMinimum = BigInt(minimumRaw ?? "0");
      if (BigInt(fresh.quote!.output.amount) < reviewedMinimum) {
        setQuote(fresh);
        setReviewing(false);
        throw new Error("The quote moved below the reviewed minimum. Review the new quote.");
      }
      if (source.kind === "erc20") {
        const response = await fetch("/api/uniswap/check-approval", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chainId: wallet.fundingChainId,
            token: source.address,
            tokenOut: destination.address,
            amount: parsedAmount.toString(),
            walletAddress: wallet.address,
          }),
        });
        const approval = (await readJson(response)) as {
          cancel?: unknown;
          approval?: unknown;
          detail?: string;
          error?: string;
        };
        if (!response.ok) throw new Error(uniswapError(approval, "Approval check failed."));
        if (approval.cancel)
          await sendTransaction(approval.cancel, "approve-swap", "Reset swap approval");
        if (approval.approval)
          await sendTransaction(approval.approval, "approve-swap", `Approve ${source.symbol}`);
      }
      setSubmitState("swapping");
      const response = await fetch("/api/uniswap/swap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quote: fresh.quote }),
      });
      const swap = (await readJson(response)) as {
        swap?: unknown;
        detail?: string;
        error?: string;
      };
      if (!response.ok || !swap.swap) {
        throw new Error(uniswapError(swap, "Uniswap could not build the swap transaction."));
      }
      await sendTransaction(swap.swap, "swap", `${source.symbol} to ${destination.symbol}`);
      setAmount("");
      setQuote(null);
      setReviewing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Swap failed.");
    } finally {
      setSubmitState("idle");
    }
  };

  const nextAction = () => {
    if (wallet.status === "disconnected" || wallet.status === "error") {
      return wallet.connectWallet();
    }
    if (wallet.address && !wallet.fundingWalletOnSelectedChain) {
      return void wallet.selectFundingNetwork(wallet.fundingChainId);
    }
    if (quote?.quote) setReviewing(true);
  };

  const actionLabel =
    wallet.status === "disconnected" || wallet.status === "error"
      ? t("connectWallet")
      : wallet.address && !wallet.fundingWalletOnSelectedChain
        ? t("switchTo", { network: wallet.fundingNetworkName })
        : quoteLoading
          ? t("findingRoute")
          : insufficient
            ? t("insufficientBalance")
            : t("reviewSwap");
  const actionDisabled =
    wallet.status === "unconfigured" ||
    submitting ||
    quoteLoading ||
    (wallet.status === "ready" &&
      wallet.fundingWalletOnSelectedChain &&
      (!quote?.quote || insufficient));

  return (
    <div className="portal-panel" role="tabpanel">
      {settingsOpen && (
        <SlippageSettingsDialog
          value={slippage}
          onApply={writePortalSlippage}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      <label className="portal-field">
        <span>{t("fundingNetwork")}</span>
        <select
          value={wallet.fundingChainId}
          onChange={(event) => {
            setQuote(null);
            setReviewing(false);
            setError(null);
            void wallet.selectFundingNetwork(Number(event.target.value));
          }}
        >
          {wallet.fundingNetworks.map((network) => (
            <option key={network.chainId} value={network.chainId}>
              {network.label}
            </option>
          ))}
        </select>
      </label>
      <SwapAssetField
        label={t("youPay")}
        slippage={slippage}
        onEditSlippage={() => setSettingsOpen(true)}
        tokens={tokens}
        selected={source}
        excluded={destination?.address}
        amount={amount}
        balance={balance === null || !source ? "--" : displayAmount(balance.toString(), source)}
        onAmount={(value) => {
          setAmount(value);
          setQuote(null);
          setReviewing(false);
          setError(null);
        }}
        onToken={(address) => {
          setSourceAddress(address);
          setQuote(null);
          setReviewing(false);
          setError(null);
        }}
      />
      <button
        className="portal-switch-assets"
        type="button"
        aria-label={t("switchSwapDirection")}
        disabled={!source || !destination}
        onClick={() => {
          setSourceAddress(destination!.address);
          setDestinationAddress(source!.address);
          setQuote(null);
          setReviewing(false);
          setError(null);
        }}
      >
        ⇅
      </button>
      <SwapAssetField
        label={t("youReceive")}
        tokens={tokens}
        selected={destination}
        excluded={source?.address}
        amount={displayAmount(outputRaw, destination)}
        balance="--"
        readOnly
        onToken={(address) => {
          setDestinationAddress(address);
          setQuote(null);
          setReviewing(false);
          setError(null);
        }}
      />
      <dl className="portal-quote-grid">
        <QuoteDatum
          label={t("minimumReceived")}
          value={
            minimumRaw && destination
              ? `${displayAmount(minimumRaw, destination)} ${destination.symbol}`
              : "--"
          }
        />
        <QuoteDatum
          label={t("priceImpact")}
          value={
            quote?.quote?.priceImpact === undefined
              ? "--"
              : `${quote.quote.priceImpact.toFixed(2)}%`
          }
        />
        <QuoteDatum
          label={t("networkCost")}
          value={quote?.quote?.gasFeeUSD ? `$${quote.quote.gasFeeUSD}` : "--"}
        />
      </dl>
      {error && (
        <p className="portal-error" role="alert">
          {error}
        </p>
      )}
      {reviewing && quote?.quote ? (
        <div className="portal-review">
          <div>
            <span>
              {amount || "--"} {source?.symbol}
            </span>
            <strong>→</strong>
            <span>
              {displayAmount(outputRaw, destination)} {destination?.symbol}
            </span>
          </div>
          <button
            className="portal-primary-action"
            type="button"
            disabled={submitting}
            onClick={() => void confirmSwap()}
          >
            {submitState === "approving"
              ? t("checkingApproval")
              : submitState === "swapping"
                ? t("swapping")
                : t("confirmSwap")}
          </button>
        </div>
      ) : (
        <button
          className="portal-primary-action"
          type="button"
          disabled={actionDisabled}
          onClick={nextAction}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function SwapAssetField({
  label,
  tokens,
  selected,
  excluded,
  amount,
  balance,
  readOnly = false,
  onAmount,
  onToken,
  slippage,
  onEditSlippage,
}: {
  label: string;
  tokens: EvmSwapToken[];
  selected: EvmSwapToken | undefined;
  excluded?: Address;
  amount: string;
  balance: string;
  readOnly?: boolean;
  onAmount?: (value: string) => void;
  onToken: (address: string) => void;
  slippage?: number;
  onEditSlippage?: () => void;
}) {
  const t = useTranslations("portal");
  return (
    // A div rather than a label, because the slippage control lives in this
    // card and a button inside a label would also activate the amount input.
    <div className="portal-field portal-asset-field">
      <div className="portal-asset-field-head">
        <span>{label}</span>
        {slippage !== undefined && onEditSlippage && (
          <SlippageInlineControl value={slippage} onEdit={onEditSlippage} />
        )}
      </div>
      <div>
        <input
          inputMode="decimal"
          value={amount}
          readOnly={readOnly}
          aria-label={`${label} amount`}
          placeholder="0.00"
          onChange={(event) => onAmount?.(event.target.value)}
        />
        <select
          aria-label={`${label} asset`}
          value={selected?.address ?? ""}
          onChange={(event) => onToken(event.target.value)}
        >
          {!selected && <option value="">{t("selectAsset")}</option>}
          {tokens
            .filter((token) => token.address !== excluded)
            .map((token) => (
              <option key={token.address} value={token.address}>
                {token.symbol}
              </option>
            ))}
        </select>
      </div>
      <small>{readOnly ? "--" : t("balance", { balance })}</small>
    </div>
  );
}

function QuoteDatum({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
