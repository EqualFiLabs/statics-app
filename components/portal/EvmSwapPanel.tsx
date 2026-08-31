"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  createPublicClient,
  custom,
  decodeFunctionResult,
  encodeFunctionData,
  formatUnits,
  getAddress,
  zeroAddress,
  type Address,
} from "viem";
import {
  buildQuoteV4ExactInputSingleCall,
  buildV4ExactInputSingleSwap,
  dopplerStaticsTokenAbi,
  permit2AllowanceAbi,
  v4QuoterAbi,
} from "@statics-protocol/sdk";

import {
  getDefaultEvmSwapTokens,
  normalizeUniswapTransaction,
  uniswapError,
  type EvmSwapToken,
} from "@/lib/portal/uniswap";
import { useWalletTokens } from "@/hooks/useWalletTokens";
import { useDeployment } from "@/providers/deployment-context";
import { getFundingNetwork } from "@/lib/funding-networks";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import {
  SlippageInlineControl,
  SlippageSettingsDialog,
} from "@/components/portal/SlippageSettingsDialog";
import { usePortalSlippage } from "@/hooks/usePortalSlippage";
import { writePortalSlippage } from "@/lib/portal/slippage";
import { useWalletState, walletRecoveryAction } from "@/providers/wallet-context";
import { useAppLocale } from "@/i18n/client";
import { parseLocalizedUnits } from "@/lib/i18n/amounts";
import { minimumWithSlippage } from "@/lib/baskets/baskets";
import {
  canonicalTradeDirection,
  maximumTokenApproval,
  poolKeyForLaunch,
  settlementForTrade,
  swapDeadlineBase,
  tokenAddress,
  zeroForTrade,
} from "@/lib/trade/canonical-market";
import {
  MAX_PERMIT2_ALLOWANCE,
  MAX_PERMIT2_EXPIRATION,
  hasUsablePermit2Allowance,
} from "@/lib/protocol/approvals";
import { slippagePercentToBps } from "@/lib/portal/slippage";
import { verifyLaunchDeployment } from "@/lib/deployments/verify-launch";

const PERMIT_TTL = 20n * 60n;

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

export function EvmSwapPanel({ canonicalOnly = false }: { canonicalOnly?: boolean }) {
  const t = useTranslations("portal");
  const locale = useAppLocale();
  const wallet = useWalletState();
  const slippage = usePortalSlippage();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { active } = useDeployment();
  const selectedChainId =
    canonicalOnly && active.launch ? active.launch.descriptor.chainId : wallet.fundingChainId;
  const selectedNetworkName =
    canonicalOnly && active.launch ? active.launch.descriptor.network : wallet.fundingNetworkName;
  const walletOnSelectedChain = wallet.chainId === selectedChainId;
  const launch =
    active.launch && active.launch.descriptor.chainId === selectedChainId ? active.launch : null;
  const walletTokens = useWalletTokens(selectedChainId, active.protocol ?? active.launch);
  const tokens = useMemo(() => {
    const native = getDefaultEvmSwapTokens(selectedChainId).filter(
      (token) => token.kind === "native"
    );
    const canonical: EvmSwapToken[] = launch
      ? [
          {
            address: launch.contracts.statics,
            decimals: 18,
            kind: "erc20",
            name: "Statics",
            symbol: "STATICS",
          },
          {
            address: launch.contracts.weth,
            decimals: 18,
            kind: "erc20",
            name: "Wrapped Ether",
            symbol: "WETH",
          },
        ]
      : [];
    const discovered = canonicalOnly
      ? []
      : walletTokens.tokens.map((token): EvmSwapToken => ({
          address: token.address,
          decimals: token.decimals,
          kind: "erc20",
          name: token.name,
          symbol: token.symbol,
        }));
    return [...native, ...canonical, ...discovered].filter(
      (token, index, values) =>
        values.findIndex(
          (candidate) => candidate.address.toLowerCase() === token.address.toLowerCase()
        ) === index
    );
  }, [canonicalOnly, launch, selectedChainId, walletTokens.tokens]);
  const [sourceAddress, setSourceAddress] = useState<string>(zeroAddress);
  const [destinationAddress, setDestinationAddress] = useState<string>(
    launch?.contracts.statics ?? ""
  );
  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState<bigint | null>(null);
  const [quote, setQuote] = useState<QuotePayload | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const { address: walletAddress, getEthereumProvider } = wallet;
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
  const directDirection = canonicalTradeDirection(launch, source, destination);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSourceAddress(tokens.find((token) => token.kind === "native")?.address ?? "");
      setDestinationAddress(
        tokens.find((token) => token.symbol === "STATICS")?.address ?? tokens[1]?.address ?? ""
      );
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
    if (!walletAddress || !source || !walletOnSelectedChain) return;
    void (async () => {
      try {
        const provider = await getEthereumProvider();
        const network = getFundingNetwork(selectedChainId);
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
  }, [source, walletAddress, selectedChainId, walletOnSelectedChain, getEthereumProvider]);

  const requestQuote = async (): Promise<QuotePayload> => {
    if (!wallet.address || !source || !destination || parsedAmount <= 0n) {
      throw new Error("Enter an amount and choose two assets.");
    }
    if (directDirection && launch) {
      const provider = await wallet.getEthereumProvider();
      const network = getFundingNetwork(selectedChainId);
      if (!provider || !network) throw new Error("The selected wallet is unavailable.");
      const publicClient = createPublicClient({
        chain: network.chain,
        transport: custom(provider),
      });
      await verifyLaunchDeployment(publicClient, launch);
      const result = await publicClient.call({
        account: getAddress(wallet.address),
        to: launch.contracts.quoter,
        data: buildQuoteV4ExactInputSingleCall(
          poolKeyForLaunch(launch),
          zeroForTrade(launch, directDirection.input),
          parsedAmount
        ),
      });
      if (!result.data) throw new Error("The canonical pool returned no quote.");
      const [amountOut] = decodeFunctionResult({
        abi: v4QuoterAbi,
        functionName: "quoteExactInputSingle",
        data: result.data,
      });
      const slippageBps = slippagePercentToBps(slippage);
      if (slippageBps === null) throw new Error("Choose a valid slippage tolerance.");
      const minimumOut = minimumWithSlippage(amountOut, slippageBps);
      return {
        routing: "STATICS_CANONICAL",
        quote: {
          input: { amount: parsedAmount.toString(), token: source.address },
          output: { amount: amountOut.toString(), token: destination.address },
          aggregatedOutputs: [
            {
              amount: amountOut.toString(),
              minAmount: minimumOut.toString(),
              token: destination.address,
            },
          ],
        },
      };
    }
    if (canonicalOnly) throw new Error("The canonical STATICS market is unavailable.");
    const response = await fetch("/api/uniswap/quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chainId: selectedChainId,
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
      walletOnSelectedChain &&
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
    selectedChainId,
    walletOnSelectedChain,
    source?.address,
    destination?.address,
    parsedAmount,
    insufficient,
  ]);

  const sendTransaction = async (raw: unknown, kind: "approve-swap" | "swap", label: string) => {
    if (!wallet.address) throw new Error("Connect a wallet first.");
    const provider = await wallet.getEthereumProvider();
    const network = getFundingNetwork(selectedChainId);
    if (!provider || !network) throw new Error("The selected wallet is unavailable.");
    const account = getAddress(wallet.address);
    const transaction = normalizeUniswapTransaction(raw, {
      chainId: selectedChainId,
      wallet: account,
    });
    const publicClient = createPublicClient({
      chain: network.chain,
      transport: custom(provider),
    });
    return executeProtocolTransaction({
      publicClient,
      wallet: account,
      chainId: selectedChainId,
      kind,
      label,
      amount: `${amount} ${source?.symbol ?? ""}`.trim(),
      to: transaction.to,
      data: transaction.data,
      value: transaction.value,
      sendTransaction: wallet.sendEvmTransaction,
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
      if (fresh.routing === "STATICS_CANONICAL" && directDirection && launch) {
        const provider = await wallet.getEthereumProvider();
        const network = getFundingNetwork(selectedChainId);
        if (!provider || !network) throw new Error("The selected wallet is unavailable.");
        const account = getAddress(wallet.address);
        const publicClient = createPublicClient({
          chain: network.chain,
          transport: custom(provider),
        });
        await verifyLaunchDeployment(publicClient, launch);
        const [block, pendingBlock] = await Promise.all([
          publicClient.getBlock(),
          // Not every node serves a pending block; the fallbacks cover it.
          publicClient.getBlock({ blockTag: "pending" }).catch(() => null),
        ]);
        const deadlineBase = swapDeadlineBase(
          block.timestamp,
          pendingBlock?.timestamp ?? null,
          BigInt(Math.floor(Date.now() / 1_000))
        );
        const inputToken = tokenAddress(launch, directDirection.input);
        if (directDirection.input !== "eth") {
          const tokenAllowance = await publicClient.readContract({
            address: inputToken,
            abi: dopplerStaticsTokenAbi,
            functionName: "allowance",
            args: [account, launch.contracts.permit2],
          });
          if (tokenAllowance < parsedAmount) {
            await executeProtocolTransaction({
              publicClient,
              wallet: account,
              chainId: launch.descriptor.chainId,
              deploymentId: launch.descriptor.deploymentId,
              kind: "approve-swap",
              label: `Enable ${source.symbol} swaps`,
              amount: `Maximum ${source.symbol}`,
              to: inputToken,
              data: maximumTokenApproval(launch.contracts.permit2),
              sendTransaction: wallet.sendEvmTransaction,
              describeError: (cause) =>
                cause instanceof Error ? cause.message : "The approval failed.",
            });
          }
          const permit2 = await publicClient.readContract({
            address: launch.contracts.permit2,
            abi: permit2AllowanceAbi,
            functionName: "allowance",
            args: [account, inputToken, launch.contracts.universalRouter],
          });
          if (
            !hasUsablePermit2Allowance(
              permit2[0],
              permit2[1],
              parsedAmount,
              // Execution time, not last-block time: a stale latest block makes
              // an expired Permit2 allowance look usable.
              Number(deadlineBase)
            )
          ) {
            await executeProtocolTransaction({
              publicClient,
              wallet: account,
              chainId: launch.descriptor.chainId,
              deploymentId: launch.descriptor.deploymentId,
              kind: "approve-permit2",
              label: `Authorize ${source.symbol} swaps`,
              amount: `Maximum ${source.symbol}`,
              to: launch.contracts.permit2,
              data: encodeFunctionData({
                abi: permit2AllowanceAbi,
                functionName: "approve",
                args: [
                  inputToken,
                  launch.contracts.universalRouter,
                  MAX_PERMIT2_ALLOWANCE,
                  MAX_PERMIT2_EXPIRATION,
                ],
              }),
              sendTransaction: wallet.sendEvmTransaction,
              describeError: (cause) =>
                cause instanceof Error ? cause.message : "The authorization failed.",
            });
          }
        }
        setSubmitState("swapping");
        const execution = buildV4ExactInputSingleSwap({
          router: launch.contracts.universalRouter,
          poolKey: poolKeyForLaunch(launch),
          zeroForOne: zeroForTrade(launch, directDirection.input),
          amountIn: parsedAmount,
          amountOutMinimum: reviewedMinimum,
          deadline: deadlineBase + PERMIT_TTL,
          settlement: settlementForTrade(launch, directDirection),
        });
        await executeProtocolTransaction({
          publicClient,
          wallet: account,
          chainId: launch.descriptor.chainId,
          deploymentId: launch.descriptor.deploymentId,
          kind: "swap",
          label: `${source.symbol} to ${destination.symbol}`,
          amount: `${amount} ${source.symbol}`,
          to: execution.target,
          data: execution.calldata,
          value: execution.value,
          sendTransaction: wallet.sendEvmTransaction,
          describeError: (cause) =>
            cause instanceof Error ? cause.message : "The canonical swap failed.",
        });
        setAmount("");
        setQuote(null);
        setReviewing(false);
        return;
      }
      if (source.kind === "erc20") {
        const response = await fetch("/api/uniswap/check-approval", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chainId: selectedChainId,
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

  const walletRecovery = walletRecoveryAction(wallet.status);
  const nextAction = () => {
    if (walletRecovery === "login") return wallet.login();
    if (walletRecovery === "create-wallet") return void wallet.createWallet();
    if (wallet.status !== "ready") return;
    if (wallet.address && !walletOnSelectedChain) {
      return canonicalOnly
        ? void wallet.switchNetwork()
        : void wallet.selectFundingNetwork(selectedChainId);
    }
    if (quote?.quote) setReviewing(true);
  };

  const actionLabel =
    walletRecovery === "login"
      ? t("connectWallet")
      : walletRecovery === "create-wallet"
        ? t("createEmbeddedWallet")
        : wallet.address && !walletOnSelectedChain
          ? t("switchTo", { network: selectedNetworkName })
          : quoteLoading
            ? t("findingRoute")
            : insufficient
              ? t("insufficientBalance")
              : t("reviewSwap");
  const actionDisabled =
    wallet.status === "unconfigured" ||
    wallet.status === "loading" ||
    submitting ||
    quoteLoading ||
    (wallet.status === "ready" && walletOnSelectedChain && (!quote?.quote || insufficient));

  return (
    <div className="portal-panel" role="tabpanel">
      {settingsOpen && (
        <SlippageSettingsDialog
          value={slippage}
          onApply={writePortalSlippage}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {!canonicalOnly && (
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
      )}
      <SwapAssetField
        label={t("youPay")}
        slippage={slippage}
        onEditSlippage={() => setSettingsOpen(true)}
        tokens={tokens}
        selected={source}
        excluded={destination?.address}
        amount={amount}
        balance={balance === null || !source ? "--" : displayAmount(balance.toString(), source)}
        onMax={
          balance === null || balance === 0n || !source || source.kind === "native"
            ? undefined
            : () => {
                setAmount(displayAmount(balance.toString(), source));
                setQuote(null);
                setReviewing(false);
                setError(null);
              }
        }
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
      {quote?.quote && (
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
              quote.quote.priceImpact === undefined
                ? "--"
                : `${quote.quote.priceImpact.toFixed(2)}%`
            }
            tone={priceImpactTone(quote.quote.priceImpact)}
          />
          <QuoteDatum
            label={t("networkCost")}
            value={quote.quote.gasFeeUSD ? `$${quote.quote.gasFeeUSD}` : "--"}
          />
        </dl>
      )}
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
  onMax,
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
  onMax?: () => void;
  slippage?: number;
  onEditSlippage?: () => void;
}) {
  const t = useTranslations("portal");
  return (
    // A div rather than a label, because the slippage control lives in this
    // card and a button inside a label would also activate the amount input.
    <div className="portal-field portal-asset-field">
      <div className="portal-asset-field-head">
        <span className="portal-field-label">{label}</span>
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
      <div className="portal-asset-field-foot">
        <small>{readOnly ? "--" : t("balance", { balance })}</small>
        {onMax && (
          <button className="portal-asset-max" type="button" onClick={onMax}>
            {t("max")}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Price impact is the one figure here that carries a warning, so it is the one
 * that earns colour. Semantic, and separate from the accent.
 */
function priceImpactTone(impact: number | undefined): QuoteTone {
  if (impact === undefined) return "neutral";
  if (impact >= 5) return "negative";
  if (impact >= 1) return "warning";
  return "positive";
}

type QuoteTone = "neutral" | "positive" | "warning" | "negative";

function QuoteDatum({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: QuoteTone;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={tone === "neutral" ? undefined : `is-${tone}`}>{value}</dd>
    </div>
  );
}
