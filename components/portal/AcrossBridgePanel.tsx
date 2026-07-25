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

import { useSolanaAssets } from "@/hooks/useSolanaAssets";
import { useWalletTokens } from "@/hooks/useWalletTokens";
import { getFundingNetwork } from "@/lib/funding-networks";
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
  const destination = readAcrossDestination();
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
  const [tokens, setTokens] = useState<AcrossToken[]>([]);
  const [tokenAddress, setTokenAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<QuotePayload | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const originIsSolana = originChainId === ACROSS_SOLANA_CHAIN_ID;
  const depositor = originIsSolana ? solana.wallet?.address : wallet.address;
  const recipient = wallet.address;
  const selectedToken = tokens.find((token) => token.address === tokenAddress) ?? tokens[0];
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
          if (
            !Number.isSafeInteger(chainId) ||
            (chainId !== ACROSS_SOLANA_CHAIN_ID && !supportedEvmChains.has(chainId)) ||
            typeof chain.name !== "string"
          ) {
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
  }, [supportedEvmChains]);

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
      destination.status !== "configured" ||
      !selectedToken ||
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
        inputToken: selectedToken.address,
        amount: rawAmount.toString(),
        depositor,
        recipient,
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
      destination.status !== "configured" ||
      !selectedToken ||
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
    destination.status,
    originChainId,
    originIsSolana,
    selectedToken?.address,
    rawAmount,
    depositor,
    recipient,
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
          `Bridge ${selectedToken.symbol} to Robinhood`
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
  const actionReady =
    destination.status === "configured" &&
    Boolean(selectedToken && rawAmount > 0n && quote?.quote && depositor && recipient);

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
            {chains
              .filter((chain) => chain.chainId !== destination.chainId)
              .map((chain) => (
                <option key={chain.chainId} value={chain.chainId}>
                  {chain.name}
                </option>
              ))}
          </select>
        </label>
        <div className="portal-destination">
          <span>To</span>
          <strong>{destination.chainName}</strong>
          <small>{destination.symbol}</small>
        </div>
      </div>

      <label className="portal-field portal-asset-field">
        <span>You send</span>
        <div>
          <input
            inputMode="decimal"
            value={amount}
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
      </label>
      <dl className="portal-quote-grid">
        <div>
          <dt>Expected on Robinhood</dt>
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
