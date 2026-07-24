"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  getAddress,
  parseUnits,
  type Address,
} from "viem";

import {
  getDefaultEvmSwapTokens,
  normalizeUniswapTransaction,
  uniswapError,
  type EvmSwapToken,
} from "@/lib/portal/uniswap";
import { getFundingNetwork } from "@/lib/funding-networks";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { useWalletState } from "@/providers/wallet-context";

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
  const wallet = useWalletState();
  const tokens = useMemo(
    () => getDefaultEvmSwapTokens(wallet.fundingChainId),
    [wallet.fundingChainId]
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
  const source = tokens.find((token) => token.address === sourceAddress) ?? tokens[0];
  const destination =
    tokens.find(
      (token) => token.address === destinationAddress && token.address !== source?.address
    ) ?? tokens.find((token) => token.address !== source?.address);
  const parsedAmount = (() => {
    try {
      return source && amount ? parseUnits(amount, source.decimals) : 0n;
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
    setSourceAddress(tokens[0]?.address ?? "");
    setDestinationAddress(tokens[1]?.address ?? "");
    setAmount("");
    setQuote(null);
    setReviewing(false);
    setError(null);
  }, [tokens]);

  useEffect(() => {
    let active = true;
    setBalance(null);
    if (!wallet.address || !source || !wallet.fundingWalletOnSelectedChain) return;
    void (async () => {
      try {
        const provider = await wallet.getEthereumProvider();
        const network = getFundingNetwork(wallet.fundingChainId);
        if (!provider || !network) return;
        const publicClient = createPublicClient({
          chain: network.chain,
          transport: custom(provider),
        });
        const value =
          source.kind === "native"
            ? await publicClient.getBalance({ address: getAddress(wallet.address!) })
            : await publicClient.readContract({
                address: source.address,
                abi: erc20BalanceAbi,
                functionName: "balanceOf",
                args: [getAddress(wallet.address!)],
              });
        if (active) setBalance(value);
      } catch {
        if (active) setBalance(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [
    source,
    wallet.address,
    wallet.fundingChainId,
    wallet.fundingWalletOnSelectedChain,
    wallet.getEthereumProvider,
  ]);

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
        slippageTolerance: 0.5,
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
      setQuote(null);
      setQuoteLoading(false);
      return;
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
    if (wallet.status === "signed-out") return wallet.login();
    if (wallet.address && !wallet.fundingWalletOnSelectedChain) {
      return void wallet.selectFundingNetwork(wallet.fundingChainId);
    }
    if (quote?.quote) setReviewing(true);
  };

  const actionLabel =
    wallet.status === "signed-out"
      ? "Connect wallet"
      : wallet.address && !wallet.fundingWalletOnSelectedChain
        ? `Switch to ${wallet.fundingNetworkName}`
        : quoteLoading
          ? "Finding route…"
          : insufficient
            ? "Insufficient balance"
            : "Review swap";
  const actionDisabled =
    wallet.status === "unconfigured" ||
    submitting ||
    quoteLoading ||
    (wallet.status === "ready" &&
      wallet.fundingWalletOnSelectedChain &&
      (!quote?.quote || insufficient));

  return (
    <div className="portal-panel" role="tabpanel">
      <label className="portal-field">
        <span>Funding network</span>
        <select
          value={wallet.fundingChainId}
          onChange={(event) => void wallet.selectFundingNetwork(Number(event.target.value))}
        >
          {wallet.fundingNetworks.map((network) => (
            <option key={network.chainId} value={network.chainId}>
              {network.label}
            </option>
          ))}
        </select>
      </label>
      <SwapAssetField
        label="You pay"
        tokens={tokens}
        selected={source}
        excluded={destination?.address}
        amount={amount}
        balance={balance === null || !source ? "--" : displayAmount(balance.toString(), source)}
        onAmount={setAmount}
        onToken={(address) => {
          setSourceAddress(address);
          setReviewing(false);
        }}
      />
      <button
        className="portal-switch-assets"
        type="button"
        aria-label="Switch swap direction"
        disabled={!source || !destination}
        onClick={() => {
          setSourceAddress(destination!.address);
          setDestinationAddress(source!.address);
          setReviewing(false);
        }}
      >
        ⇅
      </button>
      <SwapAssetField
        label="You receive"
        tokens={tokens}
        selected={destination}
        excluded={source?.address}
        amount={displayAmount(outputRaw, destination)}
        balance="--"
        readOnly
        onToken={(address) => {
          setDestinationAddress(address);
          setReviewing(false);
        }}
      />
      <dl className="portal-quote-grid">
        <QuoteDatum
          label="Minimum received"
          value={
            minimumRaw && destination
              ? `${displayAmount(minimumRaw, destination)} ${destination.symbol}`
              : "--"
          }
        />
        <QuoteDatum
          label="Price impact"
          value={
            quote?.quote?.priceImpact === undefined
              ? "--"
              : `${quote.quote.priceImpact.toFixed(2)}%`
          }
        />
        <QuoteDatum
          label="Network cost"
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
              ? "Checking approval…"
              : submitState === "swapping"
                ? "Swapping…"
                : "Confirm swap"}
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
}) {
  return (
    <label className="portal-field portal-asset-field">
      <span>{label}</span>
      <div>
        <input
          inputMode="decimal"
          value={amount}
          readOnly={readOnly}
          placeholder="0.00"
          onChange={(event) => onAmount?.(event.target.value)}
        />
        <select
          aria-label={`${label} asset`}
          value={selected?.address ?? ""}
          onChange={(event) => onToken(event.target.value)}
        >
          {!selected && <option value="">Select asset</option>}
          {tokens
            .filter((token) => token.address !== excluded)
            .map((token) => (
              <option key={token.address} value={token.address}>
                {token.symbol}
              </option>
            ))}
        </select>
      </div>
      <small>{readOnly ? "--" : `Balance ${balance}`}</small>
    </label>
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
