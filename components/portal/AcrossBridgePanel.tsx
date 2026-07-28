"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  getAddress,
  parseUnits,
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
  readAcrossDestination,
  type AcrossChain,
  type AcrossToken,
} from "@/lib/portal/across";
import {
  readBridgeActivity,
  refreshBridgeActivity,
  subscribeBridgeActivity,
  writeBridgeActivity,
} from "@/lib/portal/bridge-activity";
import { decodeJupiterTransaction } from "@/lib/portal/solana";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { SOLANA_MAINNET_CHAIN } from "@/lib/solana-wallet";
import { useWalletState } from "@/providers/wallet-context";

type QuotePayload = {
  quote?: {
    approvalTxns?: unknown[];
    swapTx?: unknown;
    steps?: { bridge?: { inputAmount?: string; outputAmount?: string } };
    fees?: { total?: string; totalMax?: string };
    expectedFillTime?: number;
    quoteExpiryTimestamp?: number;
    outputAmount?: string;
  };
  destination?: { chainId: number; token: string; symbol: string; decimals: number };
  error?: string;
  detail?: string;
};

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

export function AcrossBridgePanel() {
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
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<QuotePayload | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const originIsSolana = originChainId === ACROSS_SOLANA_CHAIN_ID;
  const destinationIsSolana = destinationChainId === ACROSS_SOLANA_CHAIN_ID;
  const depositor = originIsSolana ? solana.wallet?.address : wallet.address;
  // Funds land on the destination chain, so the recipient has to be an address
  // that chain can actually hold -- an EVM address is unusable on Solana.
  const recipient = destinationIsSolana ? solana.wallet?.address : wallet.address;
  const selectedToken = tokens.find((token) => token.address === tokenAddress) ?? tokens[0];
  const selectedDestinationToken =
    destinationTokens.find((token) => token.address === destinationTokenAddress) ??
    destinationTokens[0];
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
    rawAmount = selectedToken && amount ? parseUnits(amount, selectedToken.decimals) : 0n;
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
        if (active && next.length) setChains(next);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

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
        const next = response.ok ? tokenArray(payload) : [];
        if (!active) return;
        setQuote(null);
        setReviewing(false);
        setDestinationTokens(next);
        setDestinationTokenAddress((current) => {
          if (next.some((token) => token.address === current)) return current;
          // The Statics collateral is the point of the default destination, so
          // prefer it, then a dollar, then whatever exists.
          const preferred =
            (destinationChainId === staticsDestination.chainId &&
            staticsDestination.status === "configured"
              ? next.find(
                  (token) => token.address.toLowerCase() === staticsDestination.token.toLowerCase()
                )
              : undefined) ?? next.find((token) => token.symbol.toUpperCase() === "USDC");
          return preferred?.address ?? next[0]?.address ?? "";
        });
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
    // staticsDestination is derived from module-level config and is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destinationChainId]);

  useEffect(() => {
    let active = true;
    void fetch(`/api/across/tokens?chainId=${originChainId}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await json(response);
        const next = response.ok ? tokenArray(payload) : [];
        if (!active) return;
        setQuote(null);
        setReviewing(false);
        setError(null);
        if (next.length) {
          setTokens(next);
          setTokenAddress((current) =>
            next.some((token) => token.address === current)
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
        setTokens(fallback);
        setTokenAddress(fallback[0]?.address ?? "");
      })
      .catch(() => {
        if (active) {
          setQuote(null);
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
    if (!["submitted", "pending", "received"].includes(recentBridgeActivity.status)) return;
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

  useEffect(() => {
    if (
      !selectedToken ||
      !selectedDestinationToken ||
      rawAmount <= 0n ||
      !depositor ||
      !recipient ||
      (!originIsSolana && !wallet.fundingWalletOnSelectedChain)
    ) {
      const timeout = window.setTimeout(() => setQuote(null), 0);
      return () => window.clearTimeout(timeout);
    }
    let active = true;
    const timeout = window.setTimeout(() => {
      setLoadingQuote(true);
      setError(null);
      void requestQuote()
        .then((result) => {
          if (active) setQuote(result);
        })
        .catch((cause) => {
          if (active) setError(cause instanceof Error ? cause.message : "No Across route.");
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
    slippage,
    wallet.fundingWalletOnSelectedChain,
  ]);

  const outputRaw =
    quote?.quote?.steps?.bridge?.outputAmount ?? quote?.quote?.outputAmount ?? undefined;
  const output =
    outputRaw && quote?.destination
      ? `${formatUnits(BigInt(outputRaw), quote.destination.decimals)} ${quote.destination.symbol}`
      : "--";
  const feeRaw = quote?.quote?.fees?.total ?? quote?.quote?.fees?.totalMax;
  const fee =
    feeRaw && selectedToken
      ? `${formatUnits(BigInt(feeRaw), selectedToken.decimals)} ${selectedToken.symbol}`
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
    const walletClient = createWalletClient({
      account,
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
      sendTransaction: ({ to, data, value }) =>
        walletClient.sendTransaction({ account, chain: network.chain, to, data, value }),
      describeError: (cause) =>
        cause instanceof Error ? cause.message : "The bridge transaction failed.",
    });
  };

  const execute = async () => {
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

  const primary = () => {
    if (wallet.status === "signed-out") return wallet.login();
    if (originIsSolana && !solana.wallet) return void solana.runtime.createWallet();
    if (!originIsSolana && wallet.fundingChainId !== originChainId) {
      return void wallet.selectFundingNetwork(originChainId);
    }
    if (!originIsSolana && !wallet.fundingWalletOnSelectedChain) {
      return void wallet.selectFundingNetwork(originChainId);
    }
    if (quote?.quote) setReviewing(true);
  };
  const primaryLabel =
    wallet.status === "signed-out"
      ? "Connect wallet"
      : originIsSolana && !solana.wallet
        ? "Create Solana wallet"
        : !originIsSolana &&
            (wallet.fundingChainId !== originChainId || !wallet.fundingWalletOnSelectedChain)
          ? `Switch to ${chains.find((chain) => chain.chainId === originChainId)?.name ?? "origin"}`
          : loadingQuote
            ? "Finding route…"
            : "Review bridge";
  const actionReady = Boolean(
    selectedToken &&
    selectedDestinationToken &&
    rawAmount > 0n &&
    quote?.quote &&
    depositor &&
    recipient
  );

  return (
    <div className="portal-panel" role="tabpanel">
      <div className="portal-bridge-networks">
        <label className="portal-field">
          <span>From</span>
          <select
            value={originChainId}
            onChange={(event) => {
              const next = Number(event.target.value);
              setOriginChainId(next);
              setQuote(null);
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
          <span>To</span>
          <select
            value={destinationChainId}
            onChange={(event) => {
              setDestinationChainId(Number(event.target.value));
              setQuote(null);
              setReviewing(false);
              setError(null);
            }}
          >
            {chains
              .filter((chain) => chain.chainId !== originChainId)
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
          <span>You send</span>
          <SlippageInlineControl value={slippage} onEdit={() => setSettingsOpen(true)} />
        </div>
        <div>
          <input
            inputMode="decimal"
            value={amount}
            aria-label="You send amount"
            placeholder="0.00"
            onChange={(event) => {
              setAmount(event.target.value);
              setQuote(null);
              setReviewing(false);
              setError(null);
            }}
          />
          <select
            aria-label="Bridge asset"
            value={selectedToken?.address ?? ""}
            onChange={(event) => {
              setTokenAddress(event.target.value);
              setQuote(null);
              setReviewing(false);
              setError(null);
            }}
          >
            {tokens.map((token) => (
              <option key={token.address} value={token.address}>
                {token.symbol}
              </option>
            ))}
          </select>
        </div>
        <small>--</small>
      </div>

      <label className="portal-field">
        <span>You receive on {destinationChainName}</span>
        <select
          aria-label="Destination asset"
          value={selectedDestinationToken?.address ?? ""}
          onChange={(event) => {
            setDestinationTokenAddress(event.target.value);
            setQuote(null);
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
          <dt>Expected on {destinationChainName}</dt>
          <dd>{output}</dd>
        </div>
        <div>
          <dt>Bridge fee</dt>
          <dd>{fee}</dd>
        </div>
        <div>
          <dt>Estimated time</dt>
          <dd>{quote?.quote?.expectedFillTime ? `${quote.quote.expectedFillTime}s` : "--"}</dd>
        </div>
      </dl>

      {settingsOpen && (
        <SlippageSettingsDialog
          value={slippage}
          onApply={writePortalSlippage}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {reviewing && quote?.quote && (
        <div className="portal-review">
          <div>
            <span>
              {amount} {selectedToken?.symbol}
            </span>
            <strong>→</strong>
            <span>{output}</span>
          </div>
        </div>
      )}
      {recentBridgeActivity && (
        <div className="portal-bridge-status">
          <span>Latest bridge</span>
          <strong>{recentBridgeActivity.status}</strong>
          <button type="button" onClick={() => void refreshBridgeActivity(recentBridgeActivity)}>
            Refresh
          </button>
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
          disabled={submitting}
          onClick={() => void execute()}
        >
          {submitting ? "Bridging…" : "Confirm bridge"}
        </button>
      ) : (
        <button
          className="portal-primary-action"
          type="button"
          disabled={
            submitting ||
            loadingQuote ||
            (wallet.status !== "signed-out" &&
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
