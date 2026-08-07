"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import {
  createPublicClient,
  custom,
  encodeFunctionData,
  formatEther,
  formatUnits,
  getAddress,
  parseEventLogs,
} from "viem";

import {
  SlippageInlineControl,
  SlippageSettingsDialog,
} from "@/components/portal/SlippageSettingsDialog";
import { usePortalSlippage } from "@/hooks/usePortalSlippage";
import { useSolanaAssets } from "@/hooks/useSolanaAssets";
import { useWalletTokens } from "@/hooks/useWalletTokens";
import { getFundingNetwork } from "@/lib/funding-networks";
import { writePortalSlippage } from "@/lib/portal/slippage";
import {
  ACROSS_SOLANA_CHAIN_ID,
  acrossError,
  normalizeAcrossTransaction,
  parseAcrossAmount,
  readAcrossDestination,
  type AcrossChain,
  type AcrossToken,
} from "@/lib/portal/across";
import {
  readBridgeActivity,
  refreshBridgeActivity,
  subscribeBridgeActivity,
  updateBridgeActivity,
  writeBridgeActivity,
} from "@/lib/portal/bridge-activity";
import {
  EVE_LOCAL_DECIMALS,
  EVE_NAME,
  EVE_SYMBOL,
  bufferedLayerZeroFee,
  createEveSendParam,
  eveOftAbi,
  eveTokenApprovalAbi,
  getEveBridgeDeployment,
  getEveBridgeDestination,
  isEveToken,
  type EveSendParam,
} from "@/lib/portal/eve-bridge";
import { decodeJupiterTransaction } from "@/lib/portal/solana";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { SOLANA_MAINNET_CHAIN } from "@/lib/solana-wallet";
import { useWalletState, walletRecoveryAction } from "@/providers/wallet-context";
import { useAppLocale } from "@/i18n/client";
import { parseLocalizedUnits } from "@/lib/i18n/amounts";

type QuotePayload = {
  quote?: {
    approvalTxns?: unknown[];
    swapTx?: unknown;
    steps?: { bridge?: { inputAmount?: unknown; outputAmount?: unknown } };
    fees?: { total?: unknown; totalMax?: unknown };
    expectedFillTime?: number;
    quoteExpiryTimestamp?: number;
    outputAmount?: unknown;
  };
  destination?: { chainId: number; token: string; symbol: string; decimals: number };
  error?: string;
  detail?: string;
};

type EveQuote = Readonly<{
  sendParam: EveSendParam;
  nativeFee: bigint;
  maximumNativeFee: bigint;
  needsApproval: boolean;
}>;

async function json(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: text.slice(0, 500) };
  }
}

function tokenArray(payload: unknown): AcrossToken[] {
  const rows = Array.isArray(payload)
    ? payload
    : payload &&
        typeof payload === "object" &&
        Array.isArray((payload as { tokens?: unknown }).tokens)
      ? (payload as { tokens: unknown[] }).tokens
      : [];
  return rows.flatMap((item): AcrossToken[] => {
    if (!item || typeof item !== "object") return [];
    const token = item as Record<string, unknown>;
    if (
      !Number.isSafeInteger(Number(token.chainId)) ||
      typeof token.address !== "string" ||
      typeof token.name !== "string" ||
      typeof token.symbol !== "string" ||
      !Number.isInteger(token.decimals)
    ) {
      return [];
    }
    return [
      {
        chainId: Number(token.chainId),
        address: token.address,
        name: token.name,
        symbol: token.symbol,
        decimals: Number(token.decimals),
        ...(typeof token.logoUrl === "string" ? { logoUrl: token.logoUrl } : {}),
        ...(typeof token.priceUsd === "string" ? { priceUsd: token.priceUsd } : {}),
      },
    ];
  });
}

function eveToken(chainId: number): AcrossToken | null {
  const deployment = getEveBridgeDeployment(chainId);
  return deployment
    ? {
        chainId,
        address: deployment.tokenAddress,
        name: EVE_NAME,
        symbol: EVE_SYMBOL,
        decimals: EVE_LOCAL_DECIMALS,
      }
    : null;
}

export function withEveToken(tokens: readonly AcrossToken[], chainId: number): AcrossToken[] {
  const eve = eveToken(chainId);
  if (!eve || tokens.some((token) => isEveToken(chainId, token.address))) return [...tokens];
  return [...tokens, eve];
}

function selectedByAddress(tokens: readonly AcrossToken[], address: string) {
  return tokens.find((token) => token.address.toLowerCase() === address.toLowerCase());
}

function eveBridgeError(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : String(cause);
  if (/rejected|denied|declined/i.test(message)) return "The wallet request was rejected.";
  if (/insufficient funds/i.test(message)) return "There is not enough ETH to pay the bridge fee.";
  if (/SlippageExceeded|minimum bridge amount/i.test(message)) {
    return "The minimum bridge amount is 0.000001 EVE.";
  }
  if (/NotEnoughNative|InsufficientFee/i.test(message)) {
    return "The LayerZero fee changed before submission. Refresh the quote and try again.";
  }
  return cause instanceof Error ? cause.message : "The EVE bridge transaction failed.";
}

/**
 * Picks which asset the bridge should arrive as, before anyone chooses.
 *
 * Matching the sent symbol comes first, because sending ETH and receiving WETH
 * is a swap nobody asked for. Across lists both on most chains -- native under
 * the zero address, wrapped under the real one -- so "first in the list" is a
 * coin flip between them, and on Robinhood that flip lands on WETH.
 *
 * Only if nothing matches does it fall back to a dollar, and USDG by symbol as
 * well as address so the preference survives a deployment that is not pointed
 * at Robinhood.
 */
export function defaultDestinationToken(
  tokens: readonly AcrossToken[],
  sentSymbol: string | undefined
): string {
  const bySymbol = (symbol: string) =>
    tokens.find((token) => token.symbol.toUpperCase() === symbol.toUpperCase());
  const preferred =
    (sentSymbol ? bySymbol(sentSymbol) : undefined) ?? bySymbol("USDG") ?? bySymbol("USDC");
  return preferred?.address ?? tokens[0]?.address ?? "";
}

export function AcrossBridgePanel() {
  const t = useTranslations("portal");
  const locale = useAppLocale();
  const wallet = useWalletState();
  const solana = useSolanaAssets();
  const slippage = usePortalSlippage();
  // The Statics deployment is where most people are heading, so it opens as the
  // destination -- but it is now a default rather than the only option.
  const staticsDestination = readAcrossDestination();
  const walletTokens = useWalletTokens(wallet.fundingChainId);
  const supportedEvmChains = useMemo(
    () => new Set(wallet.fundingNetworks.map((network) => network.chainId)),
    [wallet.fundingNetworks]
  );
  const fallbackChains = useMemo<AcrossChain[]>(
    () => [
      ...wallet.fundingNetworks.map((network) => ({
        chainId: network.chainId,
        name: network.label,
      })),
      { chainId: ACROSS_SOLANA_CHAIN_ID, name: "Solana" },
    ],
    [wallet.fundingNetworks]
  );
  const [chains, setChains] = useState<AcrossChain[]>(fallbackChains);
  const [originChainId, setOriginChainId] = useState(wallet.fundingChainId);
  const [destinationChainId, setDestinationChainId] = useState(staticsDestination.chainId);
  const [tokens, setTokens] = useState<AcrossToken[]>([]);
  const [tokenAddress, setTokenAddress] = useState("");
  const [destinationTokens, setDestinationTokens] = useState<AcrossToken[]>([]);
  const [destinationTokenAddress, setDestinationTokenAddress] = useState("");
  const [destinationTokenTouched, setDestinationTokenTouched] = useState(false);
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<QuotePayload | null>(null);
  const [eveQuote, setEveQuote] = useState<EveQuote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [preparingEve, setPreparingEve] = useState(false);
  const [approvingEve, setApprovingEve] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const originIsSolana = originChainId === ACROSS_SOLANA_CHAIN_ID;
  const destinationIsSolana = destinationChainId === ACROSS_SOLANA_CHAIN_ID;
  const depositor = originIsSolana ? solana.wallet?.address : wallet.address;
  // Funds land on the destination chain, so the recipient has to be an address
  // that chain can actually hold -- an EVM address is unusable on Solana.
  const recipient = destinationIsSolana ? solana.wallet?.address : wallet.address;
  const selectedToken = selectedByAddress(tokens, tokenAddress) ?? tokens[0];
  const selectedDestinationToken =
    selectedByAddress(destinationTokens, destinationTokenAddress) ?? destinationTokens[0];
  const selectedEve = isEveToken(originChainId, selectedToken?.address);
  const eveDestination = selectedEve
    ? getEveBridgeDestination(originChainId, destinationChainId)
    : null;
  const eveRoute = Boolean(
    selectedEve &&
    eveDestination &&
    isEveToken(destinationChainId, selectedDestinationToken?.address)
  );
  const destinationChainName =
    chains.find((chain) => chain.chainId === destinationChainId)?.name ??
    staticsDestination.chainName;
  const recentBridgeActivity = useSyncExternalStore(
    subscribeBridgeActivity,
    () => readBridgeActivity(depositor ?? undefined)[0] ?? null,
    () => null
  );

  let rawAmount = 0n;
  try {
    rawAmount = selectedToken ? parseLocalizedUnits(amount, selectedToken.decimals, locale) : 0n;
  } catch {
    rawAmount = 0n;
  }

  useEffect(() => {
    let active = true;
    void fetch("/api/across/chains", { cache: "no-store" })
      .then(async (response) => {
        const payload = await json(response);
        if (!response.ok || !Array.isArray(payload)) return;
        const next = payload.flatMap((item): AcrossChain[] => {
          if (!item || typeof item !== "object") return [];
          const chain = item as Record<string, unknown>;
          const chainId = Number(chain.chainId);
          // Every Across chain is kept here. Origin is narrowed separately,
          // because sending requires a wallet on that chain while receiving
          // does not.
          if (!Number.isSafeInteger(chainId) || typeof chain.name !== "string") {
            return [];
          }
          return [
            {
              chainId,
              name: chain.name,
              ...(typeof chain.logoUrl === "string" ? { logoUrl: chain.logoUrl } : {}),
              ...(typeof chain.explorerUrl === "string" ? { explorerUrl: chain.explorerUrl } : {}),
            },
          ];
        });
        for (const deployment of [getEveBridgeDeployment(8_453), getEveBridgeDeployment(4_663)]) {
          if (!deployment || next.some((chain) => chain.chainId === deployment.chainId)) continue;
          next.push({
            chainId: deployment.chainId,
            name:
              wallet.fundingNetworks.find((network) => network.chainId === deployment.chainId)
                ?.label ?? `Chain ${deployment.chainId}`,
          });
        }
        if (active && next.length) setChains(next);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [wallet.fundingNetworks]);

  // Sending needs a signable wallet on the chain, so origins stay limited to
  // configured EVM networks plus Solana. Destinations do not.
  const originChains = useMemo(
    () =>
      chains.filter(
        (chain) => chain.chainId === ACROSS_SOLANA_CHAIN_ID || supportedEvmChains.has(chain.chainId)
      ),
    [chains, supportedEvmChains]
  );

  useEffect(() => {
    let active = true;
    void fetch(`/api/across/tokens?chainId=${destinationChainId}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await json(response);
        const acrossTokens = response.ok ? tokenArray(payload) : [];
        const next =
          selectedEve && getEveBridgeDestination(originChainId, destinationChainId)
            ? withEveToken(acrossTokens, destinationChainId)
            : acrossTokens;
        if (!active) return;
        setQuote(null);
        setEveQuote(null);
        setReviewing(false);
        setDestinationTokens(next);
        // An explicit choice is never overridden. Everything below only picks
        // the opening value.
        if (destinationTokenTouched) {
          setDestinationTokenAddress((current) =>
            selectedByAddress(next, current) ? current : (next[0]?.address ?? "")
          );
          return;
        }
        setDestinationTokenAddress(defaultDestinationToken(next, selectedToken?.symbol));
      })
      .catch(() => {
        if (active) {
          setDestinationTokens([]);
          setDestinationTokenAddress("");
        }
      });
    return () => {
      active = false;
    };
  }, [
    destinationChainId,
    originChainId,
    selectedEve,
    selectedToken?.address,
    selectedToken?.symbol,
    destinationTokenTouched,
  ]);

  useEffect(() => {
    let active = true;
    void fetch(`/api/across/tokens?chainId=${originChainId}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await json(response);
        const next = withEveToken(response.ok ? tokenArray(payload) : [], originChainId);
        if (!active) return;
        setQuote(null);
        setEveQuote(null);
        setReviewing(false);
        setError(null);
        if (next.length) {
          setTokens(next);
          setTokenAddress((current) =>
            selectedByAddress(next, current)
              ? current
              : (next.find((token) => token.symbol.toUpperCase() === "USDC")?.address ??
                next[0]!.address)
          );
          return;
        }
        const fallback = originIsSolana
          ? solana.assets.map((token) => ({
              chainId: ACROSS_SOLANA_CHAIN_ID,
              address: token.mint,
              name: token.name,
              symbol: token.symbol,
              decimals: token.decimals,
              logoUrl: token.logoURI,
            }))
          : walletTokens.tokens.map((token) => ({
              chainId: originChainId,
              address: token.address,
              name: token.name,
              symbol: token.symbol,
              decimals: token.decimals,
              logoUrl: token.logoURI,
            }));
        const fallbackWithEve = originIsSolana ? fallback : withEveToken(fallback, originChainId);
        setTokens(fallbackWithEve);
        setTokenAddress(fallbackWithEve[0]?.address ?? "");
      })
      .catch(() => {
        if (active) {
          setQuote(null);
          setEveQuote(null);
          setTokens([]);
          setTokenAddress("");
        }
      });
    return () => {
      active = false;
    };
  }, [originChainId, originIsSolana, solana.assets, walletTokens.tokens]);

  useEffect(() => {
    if (!recentBridgeActivity) return;
    void refreshBridgeActivity(recentBridgeActivity);
    if (!["submitted", "pending", "received", "attention"].includes(recentBridgeActivity.status)) {
      return;
    }
    const interval = window.setInterval(
      () => void refreshBridgeActivity(recentBridgeActivity),
      10_000
    );
    return () => window.clearInterval(interval);
  }, [recentBridgeActivity]);

  const requestQuote = async () => {
    if (
      !selectedToken ||
      !selectedDestinationToken ||
      rawAmount <= 0n ||
      !depositor ||
      !recipient
    ) {
      throw new Error("Bridge quote inputs are incomplete.");
    }
    const response = await fetch("/api/across/quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        originChainId,
        destinationChainId,
        inputToken: selectedToken.address,
        outputToken: selectedDestinationToken.address,
        amount: rawAmount.toString(),
        depositor,
        recipient,
        slippage,
      }),
    });
    const payload = (await json(response)) as QuotePayload;
    if (!response.ok || !payload.quote) {
      throw new Error(acrossError(payload, "No Across route is available."));
    }
    return payload;
  };

  const requestEveQuote = async (): Promise<EveQuote> => {
    if (!wallet.address || !recipient || !eveRoute || rawAmount <= 0n) {
      throw new Error("EVE bridge quote inputs are incomplete.");
    }
    const origin = getEveBridgeDeployment(originChainId);
    const network = getFundingNetwork(originChainId);
    const provider = await wallet.getEthereumProvider();
    if (!origin || !network || !provider) {
      throw new Error("The selected EVE origin wallet is unavailable.");
    }
    const account = getAddress(wallet.address);
    const publicClient = createPublicClient({ chain: network.chain, transport: custom(provider) });
    const initialParam = createEveSendParam(
      originChainId,
      destinationChainId,
      getAddress(recipient),
      rawAmount
    );
    const [, , oftReceipt] = await publicClient.readContract({
      address: origin.bridgeAddress,
      abi: eveOftAbi,
      functionName: "quoteOFT",
      args: [initialParam],
    });
    const sendParam = {
      ...initialParam,
      amountLD: oftReceipt.amountSentLD,
      minAmountLD: oftReceipt.amountReceivedLD,
    };
    const [feeQuote, allowance] = await Promise.all([
      publicClient.readContract({
        address: origin.bridgeAddress,
        abi: eveOftAbi,
        functionName: "quoteSend",
        args: [sendParam, false],
      }),
      origin.approvalRequired
        ? publicClient.readContract({
            address: origin.tokenAddress,
            abi: eveTokenApprovalAbi,
            functionName: "allowance",
            args: [account, origin.bridgeAddress],
          })
        : Promise.resolve(sendParam.amountLD),
    ]);
    return {
      sendParam,
      nativeFee: feeQuote.nativeFee,
      maximumNativeFee: bufferedLayerZeroFee(feeQuote.nativeFee),
      needsApproval: allowance < sendParam.amountLD,
    };
  };

  useEffect(() => {
    if (
      !selectedToken ||
      !selectedDestinationToken ||
      rawAmount <= 0n ||
      !depositor ||
      !recipient ||
      (!originIsSolana && !wallet.fundingWalletOnSelectedChain)
    ) {
      const timeout = window.setTimeout(() => {
        setQuote(null);
        setEveQuote(null);
      }, 0);
      return () => window.clearTimeout(timeout);
    }
    let active = true;
    const timeout = window.setTimeout(() => {
      setLoadingQuote(true);
      setError(null);
      void (eveRoute ? requestEveQuote() : requestQuote())
        .then((result) => {
          if (!active) return;
          if (eveRoute) {
            setEveQuote(result as EveQuote);
            setQuote(null);
          } else {
            setQuote(result as QuotePayload);
            setEveQuote(null);
          }
        })
        .catch((cause) => {
          if (active)
            setError(eveRoute ? eveBridgeError(cause) : acrossError(cause, "No Across route."));
        })
        .finally(() => {
          if (active) setLoadingQuote(false);
        });
    }, 400);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
    // Quote dependencies are represented by the primitive route inputs below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    originChainId,
    originIsSolana,
    destinationChainId,
    selectedToken?.address,
    selectedDestinationToken?.address,
    rawAmount,
    depositor,
    recipient,
    eveRoute,
    slippage,
    wallet.fundingWalletOnSelectedChain,
  ]);

  const outputRaw =
    quote?.quote?.steps?.bridge?.outputAmount ?? quote?.quote?.outputAmount ?? undefined;
  const outputAmount = parseAcrossAmount(outputRaw);
  const output = eveQuote
    ? `${formatUnits(eveQuote.sendParam.minAmountLD, EVE_LOCAL_DECIMALS)} ${EVE_SYMBOL}`
    : outputAmount !== null && quote?.destination
      ? `${formatUnits(outputAmount, quote.destination.decimals)} ${quote.destination.symbol}`
      : "--";
  const feeAmount = parseAcrossAmount(quote?.quote?.fees?.total ?? quote?.quote?.fees?.totalMax);
  const fee = eveQuote
    ? `${formatEther(eveQuote.nativeFee)} ETH`
    : feeAmount !== null && selectedToken
      ? `${formatUnits(feeAmount, selectedToken.decimals)} ${selectedToken.symbol}`
      : "--";

  const sendEvmTransaction = async (
    raw: unknown,
    kind: "approve-bridge" | "bridge",
    label: string
  ) => {
    if (!wallet.address || !selectedToken) throw new Error("Connect an EVM wallet first.");
    const network = getFundingNetwork(originChainId);
    const provider = await wallet.getEthereumProvider();
    if (!network || !provider) throw new Error("The selected origin wallet is unavailable.");
    const account = getAddress(wallet.address);
    const transaction = normalizeAcrossTransaction(raw, {
      chainId: originChainId,
      wallet: account,
    });
    const publicClient = createPublicClient({
      chain: network.chain,
      transport: custom(provider),
    });
    return executeProtocolTransaction({
      publicClient,
      wallet: account,
      chainId: originChainId,
      kind,
      label,
      amount: `${amount} ${selectedToken.symbol}`,
      to: transaction.to,
      data: transaction.data,
      value: transaction.value,
      sendTransaction: wallet.sendEvmTransaction,
      describeError: (cause) =>
        cause instanceof Error ? cause.message : "The bridge transaction failed.",
    });
  };

  const executeEve = async () => {
    if (
      !wallet.address ||
      !selectedToken ||
      !eveRoute ||
      preparingEve ||
      approvingEve ||
      submitting
    ) {
      return;
    }
    setPreparingEve(true);
    const origin = getEveBridgeDeployment(originChainId);
    const network = getFundingNetwork(originChainId);
    const provider = await wallet.getEthereumProvider();
    if (!origin || !network || !provider) {
      setError("The selected EVE origin wallet is unavailable.");
      setPreparingEve(false);
      return;
    }
    const account = getAddress(wallet.address);
    const publicClient = createPublicClient({ chain: network.chain, transport: custom(provider) });
    setError(null);
    try {
      const fresh = await requestEveQuote();
      const displayAmount = formatUnits(fresh.sendParam.amountLD, EVE_LOCAL_DECIMALS);
      if (fresh.needsApproval) {
        setPreparingEve(false);
        setApprovingEve(true);
        const approvalData = encodeFunctionData({
          abi: eveTokenApprovalAbi,
          functionName: "approve",
          args: [origin.bridgeAddress, fresh.sendParam.amountLD],
        });
        await executeProtocolTransaction({
          publicClient,
          wallet: account,
          chainId: originChainId,
          kind: "approve-bridge",
          label: `Approve ${EVE_SYMBOL} bridge`,
          amount: `${displayAmount} ${EVE_SYMBOL}`,
          to: origin.tokenAddress,
          data: approvalData,
          sendTransaction: wallet.sendEvmTransaction,
          describeError: eveBridgeError,
          verifyConfirmation: async () => {
            const allowance = await publicClient.readContract({
              address: origin.tokenAddress,
              abi: eveTokenApprovalAbi,
              functionName: "allowance",
              args: [account, origin.bridgeAddress],
            });
            if (allowance < fresh.sendParam.amountLD) {
              throw new Error("The confirmed EVE approval is not visible yet.");
            }
          },
        });
        setEveQuote(await requestEveQuote());
        return;
      }

      setPreparingEve(false);
      setSubmitting(true);
      const activityId = crypto.randomUUID();
      const sendData = encodeFunctionData({
        abi: eveOftAbi,
        functionName: "send",
        args: [fresh.sendParam, { nativeFee: fresh.maximumNativeFee, lzTokenFee: 0n }, account],
      });
      await executeProtocolTransaction({
        publicClient,
        wallet: account,
        chainId: originChainId,
        kind: "bridge",
        label: `Bridge ${EVE_SYMBOL} to ${destinationChainName}`,
        amount: `${displayAmount} ${EVE_SYMBOL}`,
        to: origin.bridgeAddress,
        data: sendData,
        value: fresh.maximumNativeFee,
        presentation: {
          action: `Bridge ${EVE_SYMBOL} to ${destinationChainName}`,
          description: `Bridge ${displayAmount} ${EVE_SYMBOL} through the configured LayerZero OFT pathway. Maximum LayerZero fee: ${formatEther(fresh.maximumNativeFee)} ETH; unused fee is refunded to this wallet.`,
          buttonText: `Bridge ${EVE_SYMBOL}`,
          contractName: origin.approvalRequired ? "EVE OFT Adapter" : "EVE OFT",
        },
        sendTransaction: wallet.sendEvmTransaction,
        describeError: eveBridgeError,
        onSubmitted: (hash) =>
          writeBridgeActivity({
            id: activityId,
            provider: "layerzero",
            wallet: account,
            recipient: account,
            originChainId,
            destinationChainId,
            inputSymbol: EVE_SYMBOL,
            outputSymbol: EVE_SYMBOL,
            amount: displayAmount,
            amountRaw: fresh.sendParam.minAmountLD.toString(),
            depositTxnRef: hash,
            status: "submitted",
            createdAt: Date.now(),
          }),
        verifyConfirmation: async (receipt) => {
          const sent = parseEventLogs({
            abi: eveOftAbi,
            eventName: "OFTSent",
            logs: receipt.logs,
            strict: true,
          }).find(
            (event) =>
              event.address.toLowerCase() === origin.bridgeAddress.toLowerCase() &&
              event.args.dstEid === fresh.sendParam.dstEid &&
              getAddress(event.args.fromAddress) === account &&
              event.args.amountSentLD === fresh.sendParam.amountLD &&
              event.args.amountReceivedLD === fresh.sendParam.minAmountLD
          );
          if (!sent) throw new Error("The confirmed transaction emitted no matching EVE send.");
          updateBridgeActivity(activityId, {
            depositTxnRef: receipt.transactionHash,
            guid: sent.args.guid,
            status: "pending",
          });
        },
      });
      const activity = readBridgeActivity(account).find((item) => item.id === activityId);
      if (activity) void refreshBridgeActivity(activity);
      setAmount("");
      setEveQuote(null);
      setReviewing(false);
    } catch (cause) {
      setError(eveBridgeError(cause));
    } finally {
      setPreparingEve(false);
      setApprovingEve(false);
      setSubmitting(false);
    }
  };

  const execute = async () => {
    if (eveRoute) return executeEve();
    if (!quote?.quote || !selectedToken || !depositor || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const fresh = await requestQuote();
      let depositTxnRef: string;
      if (originIsSolana) {
        const rawSwap = fresh.quote?.swapTx as Record<string, unknown> | undefined;
        const serialized =
          typeof rawSwap?.data === "string"
            ? rawSwap.data
            : typeof rawSwap?.transaction === "string"
              ? rawSwap.transaction
              : null;
        if (!serialized || !solana.wallet) {
          throw new Error("Across did not return a signable Solana transaction.");
        }
        const { signedTransaction } = await solana.runtime.signTransaction({
          wallet: solana.wallet,
          chain: SOLANA_MAINNET_CHAIN,
          transaction: decodeJupiterTransaction(serialized),
        });
        depositTxnRef = await solana.connection.sendRawTransaction(signedTransaction, {
          skipPreflight: false,
        });
        const confirmation = await solana.connection.confirmTransaction(depositTxnRef, "confirmed");
        if (confirmation.value.err) throw new Error("The Across deposit reverted on Solana.");
        await solana.refresh();
      } else {
        for (const approval of fresh.quote?.approvalTxns ?? []) {
          await sendEvmTransaction(
            approval,
            "approve-bridge",
            `Approve ${selectedToken.symbol} bridge`
          );
        }
        if (!fresh.quote?.swapTx) throw new Error("Across did not return a bridge transaction.");
        depositTxnRef = await sendEvmTransaction(
          fresh.quote.swapTx,
          "bridge",
          `Bridge ${selectedToken.symbol} to ${destinationChainName}`
        );
      }
      const activity = {
        id: crypto.randomUUID(),
        wallet: depositor,
        originChainId,
        destinationChainId: fresh.destination!.chainId,
        inputSymbol: selectedToken.symbol,
        outputSymbol: fresh.destination!.symbol,
        amount,
        depositTxnRef,
        status: "submitted" as const,
        createdAt: Date.now(),
      };
      writeBridgeActivity(activity);
      void refreshBridgeActivity(activity);
      setAmount("");
      setQuote(null);
      setReviewing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Bridge failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const walletRecovery = walletRecoveryAction(wallet.status);
  const primary = () => {
    if (walletRecovery === "login") return wallet.login();
    if (walletRecovery === "create-wallet") return void wallet.createWallet();
    if (wallet.status !== "ready") return;
    if (originIsSolana && !solana.wallet) return void solana.runtime.createWallet();
    if (!originIsSolana && wallet.fundingChainId !== originChainId) {
      return void wallet.selectFundingNetwork(originChainId);
    }
    if (!originIsSolana && !wallet.fundingWalletOnSelectedChain) {
      return void wallet.selectFundingNetwork(originChainId);
    }
    if (quote?.quote || eveQuote) setReviewing(true);
  };
  const primaryLabel =
    walletRecovery === "login"
      ? t("connectWallet")
      : walletRecovery === "create-wallet"
        ? t("createEmbeddedWallet")
        : originIsSolana && !solana.wallet
          ? t("createSolanaWallet")
          : !originIsSolana &&
              (wallet.fundingChainId !== originChainId || !wallet.fundingWalletOnSelectedChain)
            ? t("switchTo", {
                network:
                  chains.find((chain) => chain.chainId === originChainId)?.name ?? t("origin"),
              })
            : loadingQuote
              ? t("findingRoute")
              : t("reviewBridge");
  const actionReady = Boolean(
    selectedToken &&
    selectedDestinationToken &&
    rawAmount > 0n &&
    (eveRoute ? eveQuote : quote?.quote) &&
    depositor &&
    recipient
  );

  return (
    <div className="portal-panel" role="tabpanel">
      <div className="portal-bridge-networks">
        <label className="portal-field">
          <span>{t("from")}</span>
          <select
            value={originChainId}
            onChange={(event) => {
              const next = Number(event.target.value);
              setOriginChainId(next);
              setQuote(null);
              setEveQuote(null);
              setReviewing(false);
              setError(null);
              if (next !== ACROSS_SOLANA_CHAIN_ID && supportedEvmChains.has(next)) {
                void wallet.selectFundingNetwork(next);
              }
            }}
          >
            {originChains
              .filter((chain) => chain.chainId !== destinationChainId)
              .map((chain) => (
                <option key={chain.chainId} value={chain.chainId}>
                  {chain.name}
                </option>
              ))}
          </select>
        </label>
        <label className="portal-field">
          <span>{t("to")}</span>
          <select
            value={destinationChainId}
            disabled={selectedEve}
            onChange={(event) => {
              setDestinationChainId(Number(event.target.value));
              setQuote(null);
              setEveQuote(null);
              setReviewing(false);
              setError(null);
            }}
          >
            {chains
              .filter(
                (chain) =>
                  chain.chainId !== originChainId &&
                  (!selectedEve || chain.chainId === eveDestination?.chainId)
              )
              .map((chain) => (
                <option key={chain.chainId} value={chain.chainId}>
                  {chain.name}
                </option>
              ))}
          </select>
        </label>
      </div>

      {/* A div rather than a label, because the slippage control lives in this
          card and a button inside a label would also activate the amount input. */}
      <div className="portal-field portal-asset-field">
        <div className="portal-asset-field-head">
          <span>{t("youSend")}</span>
          {selectedEve ? (
            <span>{t("layerZeroOft")}</span>
          ) : (
            <SlippageInlineControl value={slippage} onEdit={() => setSettingsOpen(true)} />
          )}
        </div>
        <div>
          <input
            inputMode="decimal"
            value={amount}
            aria-label={t("youSendAmount")}
            placeholder="0.00"
            onChange={(event) => {
              setAmount(event.target.value);
              setQuote(null);
              setEveQuote(null);
              setReviewing(false);
              setError(null);
            }}
          />
          <select
            aria-label={t("bridgeAsset")}
            value={selectedToken?.address ?? ""}
            onChange={(event) => {
              const nextAddress = event.target.value;
              setTokenAddress(nextAddress);
              setQuote(null);
              setEveQuote(null);
              setReviewing(false);
              setError(null);
              if (isEveToken(originChainId, nextAddress)) {
                const destination = getEveBridgeDestination(originChainId);
                if (destination) {
                  setDestinationChainId(destination.chainId);
                  setDestinationTokenAddress(destination.tokenAddress);
                  setDestinationTokenTouched(false);
                }
              }
            }}
          >
            {tokens.map((token) => (
              <option key={token.address} value={token.address}>
                {token.symbol}
              </option>
            ))}
          </select>
        </div>
        <small>
          {eveQuote && rawAmount > eveQuote.sendParam.amountLD
            ? t("eveDustRetained", {
                amount: formatUnits(rawAmount - eveQuote.sendParam.amountLD, EVE_LOCAL_DECIMALS),
              })
            : selectedEve
              ? t("eveMinimum")
              : "--"}
        </small>
      </div>

      <label className="portal-field">
        <span>{t("youReceiveOn", { network: destinationChainName })}</span>
        <select
          aria-label={t("destinationAsset")}
          value={selectedDestinationToken?.address ?? ""}
          disabled={selectedEve}
          onChange={(event) => {
            setDestinationTokenAddress(event.target.value);
            setDestinationTokenTouched(true);
            setQuote(null);
            setEveQuote(null);
            setReviewing(false);
            setError(null);
          }}
        >
          {destinationTokens.map((token) => (
            <option key={token.address} value={token.address}>
              {token.symbol}
            </option>
          ))}
        </select>
      </label>

      <dl className="portal-quote-grid">
        <div>
          <dt>{t("expectedOn", { network: destinationChainName })}</dt>
          <dd>{output}</dd>
        </div>
        <div>
          <dt>{t("bridgeFee")}</dt>
          <dd>{fee}</dd>
        </div>
        <div>
          <dt>{selectedEve ? t("route") : t("estimatedTime")}</dt>
          <dd>
            {selectedEve
              ? t("layerZeroOft")
              : quote?.quote?.expectedFillTime
                ? `${quote.quote.expectedFillTime}s`
                : "--"}
          </dd>
        </div>
      </dl>

      {settingsOpen && (
        <SlippageSettingsDialog
          value={slippage}
          onApply={writePortalSlippage}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {reviewing && (quote?.quote || eveQuote) && (
        <div className="portal-review">
          <div>
            <span>
              {amount} {selectedToken?.symbol}
            </span>
            <strong>→</strong>
            <span>{output}</span>
          </div>
          {eveQuote && (
            <small>
              {t("maximumLayerZeroFee", {
                fee: formatEther(eveQuote.maximumNativeFee),
              })}
            </small>
          )}
        </div>
      )}
      {recentBridgeActivity && (
        <div className="portal-bridge-status">
          <span>{t("latestBridge")}</span>
          <strong>{recentBridgeActivity.status}</strong>
          <button type="button" onClick={() => void refreshBridgeActivity(recentBridgeActivity)}>
            {t("refresh")}
          </button>
          {recentBridgeActivity.error && <small>{recentBridgeActivity.error}</small>}
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
          disabled={preparingEve || submitting || approvingEve}
          onClick={() => void execute()}
        >
          {preparingEve
            ? t("preparing")
            : approvingEve
              ? t("approvingEve")
              : eveQuote?.needsApproval
                ? t("approveEve")
                : submitting
                  ? t("bridging")
                  : t("confirmBridge")}
        </button>
      ) : (
        <button
          className="portal-primary-action"
          type="button"
          disabled={
            wallet.status === "unconfigured" ||
            wallet.status === "loading" ||
            submitting ||
            preparingEve ||
            approvingEve ||
            loadingQuote ||
            (wallet.status === "ready" &&
              !(
                (originIsSolana && !solana.wallet) ||
                (!originIsSolana &&
                  (wallet.fundingChainId !== originChainId ||
                    !wallet.fundingWalletOnSelectedChain)) ||
                actionReady
              ))
          }
          onClick={primary}
        >
          {primaryLabel}
        </button>
      )}
    </div>
  );
}
