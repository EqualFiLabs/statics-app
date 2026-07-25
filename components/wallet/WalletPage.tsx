"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  encodeFunctionData,
  formatUnits,
  getAddress,
  isAddress,
  parseUnits,
  zeroAddress,
  type Address,
} from "viem";

import { PortalWorkspace } from "@/components/portal/PortalWorkspace";
import { TokenLogo } from "@/components/wallet/TokenLogo";
import { useWalletTokens } from "@/hooks/useWalletTokens";
import { getFundingNetwork } from "@/lib/funding-networks";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { searchTokenList } from "@/lib/token-list";
import { getNativeTokenLogoURI } from "@/lib/token-icons";
import type { WalletToken } from "@/lib/wallet-tokens";
import { useWalletState } from "@/providers/wallet-context";

const erc20Abi = [
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [{ type: "address" }, { type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
] as const;

type WalletModal = "send" | "receive" | "portal" | "browse" | "custom" | null;
type AssetBalance = bigint | null;

function displayBalance(value: AssetBalance, decimals: number) {
  if (value === null) return "--";
  const formatted = formatUnits(value, decimals);
  const [whole, fraction = ""] = formatted.split(".");
  return fraction
    ? `${whole}.${fraction.slice(0, 6).replace(/0+$/, "")}`.replace(/\.$/, "")
    : whole;
}

export function WalletPage() {
  const wallet = useWalletState();
  const network = getFundingNetwork(wallet.fundingChainId);
  const { tokens, addToken, removeToken } = useWalletTokens(wallet.fundingChainId);
  const [modal, setModal] = useState<WalletModal>(null);
  const [nativeBalance, setNativeBalance] = useState<AssetBalance>(null);
  const [tokenBalances, setTokenBalances] = useState<Record<string, AssetBalance>>({});
  const [refreshing, setRefreshing] = useState(false);
  const refreshId = useRef(0);

  const refreshBalances = async () => {
    const currentRefresh = ++refreshId.current;
    if (!wallet.address || !wallet.fundingWalletOnSelectedChain || !network) return;
    setRefreshing(true);
    try {
      const provider = await wallet.getEthereumProvider();
      if (!provider) return;
      const publicClient = createPublicClient({
        chain: network.chain,
        transport: custom(provider),
      });
      const account = getAddress(wallet.address);
      const [nativeResult, ...tokenResults] = await Promise.allSettled([
        publicClient.getBalance({ address: account }),
        ...tokens.map((token) =>
          publicClient.readContract({
            address: token.address,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [account],
          })
        ),
      ]);
      if (currentRefresh !== refreshId.current) return;
      if (nativeResult.status === "fulfilled") setNativeBalance(nativeResult.value);
      setTokenBalances((current) => {
        const next = { ...current };
        tokenResults.forEach((result, index) => {
          const token = tokens[index];
          if (token && result.status === "fulfilled") {
            next[token.address.toLowerCase()] = result.value;
          }
        });
        return next;
      });
    } finally {
      if (currentRefresh === refreshId.current) setRefreshing(false);
    }
  };

  useEffect(() => {
    setNativeBalance(null);
    setTokenBalances({});
    void refreshBalances();
    // Refresh identity is intentionally limited to wallet, network, and selected-token changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    wallet.address,
    wallet.fundingChainId,
    wallet.fundingWalletOnSelectedChain,
    tokens.map((token) => token.address).join(","),
  ]);

  const nativeSymbol = network?.chain.nativeCurrency.symbol ?? "--";
  const nativeAsset = {
    id: "native",
    kind: "native" as const,
    name: network?.chain.nativeCurrency.name ?? "Native asset",
    symbol: nativeSymbol,
    decimals: network?.chain.nativeCurrency.decimals ?? 18,
    balance: nativeBalance,
    logoURI: getNativeTokenLogoURI(nativeSymbol),
  };
  const assets = [
    nativeAsset,
    ...tokens.map((token) => ({
      id: token.address,
      kind: "erc20" as const,
      ...token,
      balance: tokenBalances[token.address.toLowerCase()] ?? null,
    })),
  ];

  return (
    <>
      <section className="wallet-surface">
        <div className="wallet-network-row">
          <label>
            <span>Network</span>
            <select
              value={wallet.fundingChainId}
              onChange={(event) => void wallet.selectFundingNetwork(Number(event.target.value))}
            >
              {wallet.fundingNetworks.map((option) => (
                <option key={option.chainId} value={option.chainId}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => void refreshBalances()} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <div className="wallet-balance-hero">
          <span>{wallet.fundingNetworkName}</span>
          <strong>{displayBalance(nativeBalance, nativeAsset.decimals)}</strong>
          <small>{nativeSymbol}</small>
        </div>

        <div className="wallet-quick-actions">
          <button type="button" onClick={() => setModal("send")}>
            <span>↑</span>Send
          </button>
          <button type="button" onClick={() => setModal("receive")}>
            <span>↓</span>Receive
          </button>
          <button type="button" onClick={() => setModal("portal")}>
            <span>⇄</span>Portal
          </button>
        </div>

        <div className="wallet-assets">
          <div className="wallet-section-heading">
            <div>
              <span>{"// Assets"}</span>
              <h2>Tokens</h2>
            </div>
            <div className="wallet-asset-actions">
              <button type="button" onClick={() => setModal("browse")}>
                Browse
              </button>
              <button type="button" onClick={() => setModal("custom")}>
                Add token
              </button>
              <Link href="/app/activity">Activity →</Link>
            </div>
          </div>
          <div className="wallet-token-rows">
            {assets.map((asset) => (
              <div className="wallet-asset-row" key={asset.id}>
                <TokenLogo
                  token={{
                    address: asset.id,
                    symbol: asset.symbol,
                    logoURI: asset.logoURI,
                  }}
                />
                <div>
                  <strong>{asset.symbol}</strong>
                  <span>{asset.name}</span>
                </div>
                <div>
                  <strong>{displayBalance(asset.balance, asset.decimals)}</strong>
                  {asset.kind === "erc20" && !asset.isDefault ? (
                    <button
                      className="wallet-remove-token"
                      type="button"
                      aria-label={`Remove ${asset.symbol}`}
                      onClick={() => removeToken(asset.address)}
                    >
                      Remove
                    </button>
                  ) : (
                    <span>{asset.kind === "native" ? "Native" : "Token"}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {modal === "portal" && (
        <WalletDialog label="Funding Portal" wide onClose={() => setModal(null)}>
          <PortalWorkspace compact />
        </WalletDialog>
      )}
      {modal === "receive" && (
        <WalletDialog label="Receive" onClose={() => setModal(null)}>
          <div className="wallet-dialog-content">
            <span>{"// Receive"}</span>
            <h2>{wallet.fundingNetworkName}</h2>
            <code>{wallet.address ?? "--"}</code>
            <button
              className="portal-primary-action"
              type="button"
              disabled={!wallet.address}
              onClick={() => void wallet.copyAddress()}
            >
              Copy address
            </button>
          </div>
        </WalletDialog>
      )}
      {modal === "browse" && (
        <TokenBrowser
          chainId={wallet.fundingChainId}
          tokens={tokens}
          onAdd={addToken}
          onCustom={() => setModal("custom")}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "custom" && (
        <CustomTokenDialog
          existing={tokens}
          onAdd={(token) => {
            addToken(token);
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "send" && (
        <SendDialog assets={assets} onConfirmed={refreshBalances} onClose={() => setModal(null)} />
      )}
    </>
  );
}

function WalletDialog({
  label,
  wide = false,
  onClose,
  children,
}: {
  label: string;
  wide?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  return (
    <div className="wallet-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`wallet-dialog${wide ? " is-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="wallet-dialog-close" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
        {children}
      </section>
    </div>
  );
}

function TokenBrowser({
  chainId,
  tokens,
  onAdd,
  onCustom,
  onClose,
}: {
  chainId: number;
  tokens: readonly WalletToken[];
  onAdd: (token: WalletToken) => void;
  onCustom: () => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const available = useMemo(
    () =>
      searchTokenList(
        chainId,
        search,
        tokens.map((token) => token.address)
      ),
    [chainId, search, tokens]
  );
  return (
    <WalletDialog label="Browse tokens" wide onClose={onClose}>
      <div className="wallet-dialog-content wallet-token-browser">
        <span>{"// Token catalog"}</span>
        <h2>Browse tokens</h2>
        <input
          autoFocus
          aria-label="Search tokens"
          value={search}
          placeholder="Symbol, name, or address"
          onChange={(event) => setSearch(event.target.value)}
        />
        <button className="wallet-inline-action" type="button" onClick={onCustom}>
          Add custom token
        </button>
        <div className="wallet-catalog-list">
          {available.map((token) => (
            <button
              key={`${token.chainId}:${token.address}`}
              type="button"
              onClick={() => {
                onAdd({ ...token });
                onClose();
              }}
            >
              <TokenLogo token={token} />
              <span>
                <strong>{token.symbol}</strong>
                <small>{token.name}</small>
              </span>
              <code>{`${token.address.slice(0, 6)}…${token.address.slice(-4)}`}</code>
            </button>
          ))}
          {available.length === 0 && <p>--</p>}
        </div>
      </div>
    </WalletDialog>
  );
}

function CustomTokenDialog({
  existing,
  onAdd,
  onClose,
}: {
  existing: readonly WalletToken[];
  onAdd: (token: WalletToken) => void;
  onClose: () => void;
}) {
  const wallet = useWalletState();
  const [input, setInput] = useState("");
  const [token, setToken] = useState<WalletToken | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const address = isAddress(input) && input !== zeroAddress ? getAddress(input) : null;

  useEffect(() => {
    setToken(null);
    setError(null);
    if (!address || !wallet.address || !wallet.fundingWalletOnSelectedChain) return;
    let active = true;
    const timeout = window.setTimeout(() => {
      setReading(true);
      void (async () => {
        try {
          const provider = await wallet.getEthereumProvider();
          const network = getFundingNetwork(wallet.fundingChainId);
          if (!provider || !network) throw new Error("The selected wallet is unavailable.");
          const client = createPublicClient({ chain: network.chain, transport: custom(provider) });
          const [symbol, decimals] = await Promise.all([
            client.readContract({ address, abi: erc20Abi, functionName: "symbol" }),
            client.readContract({ address, abi: erc20Abi, functionName: "decimals" }),
          ]);
          if (active) {
            setToken({
              address,
              symbol,
              name: symbol,
              decimals,
            });
          }
        } catch {
          if (active) setError("Could not read ERC-20 metadata from this address.");
        } finally {
          if (active) setReading(false);
        }
      })();
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [
    address,
    wallet.address,
    wallet.fundingChainId,
    wallet.fundingWalletOnSelectedChain,
    wallet.getEthereumProvider,
  ]);

  const duplicate = Boolean(
    address &&
    existing.some((candidate) => candidate.address.toLowerCase() === address.toLowerCase())
  );
  return (
    <WalletDialog label="Add token" onClose={onClose}>
      <div className="wallet-dialog-content">
        <span>{"// Custom token"}</span>
        <h2>Add ERC-20</h2>
        <label className="portal-field">
          <span>Contract address</span>
          <input
            value={input}
            placeholder="0x…"
            onChange={(event) => setInput(event.target.value)}
          />
        </label>
        <div className="wallet-token-metadata">
          <span>Symbol</span>
          <strong>{reading ? "Reading…" : (token?.symbol ?? "--")}</strong>
          <span>Decimals</span>
          <strong>{token?.decimals ?? "--"}</strong>
        </div>
        {(error || duplicate) && (
          <p className="portal-error" role="alert">
            {duplicate ? "This token is already listed." : error}
          </p>
        )}
        <button
          className="portal-primary-action"
          type="button"
          disabled={!token || duplicate}
          onClick={() => token && onAdd(token)}
        >
          Add token
        </button>
      </div>
    </WalletDialog>
  );
}

type TransferAsset = {
  id: string;
  kind: "native" | "erc20";
  name: string;
  symbol: string;
  decimals: number;
  balance: AssetBalance;
  address?: Address;
  logoURI?: string;
};

function SendDialog({
  assets,
  onConfirmed,
  onClose,
}: {
  assets: TransferAsset[];
  onConfirmed: () => Promise<void>;
  onClose: () => void;
}) {
  const wallet = useWalletState();
  const [assetId, setAssetId] = useState(assets[0]?.id ?? "");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const asset = assets.find((candidate) => candidate.id === assetId) ?? assets[0];
  let amountRaw = 0n;
  try {
    amountRaw = asset && amount ? parseUnits(amount, asset.decimals) : 0n;
  } catch {
    amountRaw = 0n;
  }
  const valid =
    Boolean(asset && isAddress(recipient) && amountRaw > 0n) &&
    (asset?.balance === null || amountRaw <= asset.balance);

  const confirm = async () => {
    if (!asset || !isAddress(recipient) || !wallet.address || !valid || pending) return;
    setPending(true);
    setError(null);
    try {
      const provider = await wallet.getEthereumProvider();
      const network = getFundingNetwork(wallet.fundingChainId);
      if (!provider || !network) throw new Error("The selected wallet is unavailable.");
      const account = getAddress(wallet.address);
      const publicClient = createPublicClient({
        chain: network.chain,
        transport: custom(provider),
      });
      const walletClient = createWalletClient({
        account,
        chain: network.chain,
        transport: custom(provider),
      });
      const to = asset.kind === "native" ? getAddress(recipient) : asset.address!;
      const data =
        asset.kind === "native"
          ? "0x"
          : encodeFunctionData({
              abi: erc20Abi,
              functionName: "transfer",
              args: [getAddress(recipient), amountRaw],
            });
      await executeProtocolTransaction({
        publicClient,
        wallet: account,
        chainId: wallet.fundingChainId,
        kind: "send",
        label: `Send ${asset.symbol}`,
        amount: `${amount} ${asset.symbol}`,
        to,
        data,
        value: asset.kind === "native" ? amountRaw : 0n,
        sendTransaction: ({ to: target, data: transactionData, value }) =>
          walletClient.sendTransaction({
            account,
            chain: network.chain,
            to: target,
            data: transactionData,
            value,
          }),
        describeError: (cause) => (cause instanceof Error ? cause.message : "The transfer failed."),
      });
      await onConfirmed();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The transfer failed.");
    } finally {
      setPending(false);
    }
  };

  const primary = () => {
    if (wallet.status === "signed-out") return wallet.login();
    if (wallet.address && !wallet.fundingWalletOnSelectedChain) {
      return void wallet.selectFundingNetwork(wallet.fundingChainId);
    }
    if (valid) setReviewing(true);
  };
  return (
    <WalletDialog label="Send" onClose={onClose}>
      <div className="wallet-dialog-content">
        <span>{"// Send"}</span>
        <h2>Send asset</h2>
        <label className="portal-field">
          <span>Asset</span>
          <select
            value={assetId}
            onChange={(event) => {
              setAssetId(event.target.value);
              setReviewing(false);
            }}
          >
            {assets.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.symbol} · {displayBalance(candidate.balance, candidate.decimals)}
              </option>
            ))}
          </select>
        </label>
        <label className="portal-field">
          <span>Recipient</span>
          <input
            value={recipient}
            placeholder="0x…"
            onChange={(event) => {
              setRecipient(event.target.value);
              setReviewing(false);
              setError(null);
            }}
          />
        </label>
        <label className="portal-field">
          <span>Amount</span>
          <input
            inputMode="decimal"
            value={amount}
            placeholder="0.00"
            onChange={(event) => {
              setAmount(event.target.value);
              setReviewing(false);
              setError(null);
            }}
          />
        </label>
        {reviewing && asset && (
          <div className="portal-review">
            <div>
              <span>
                {amount} {asset.symbol}
              </span>
              <strong>→</strong>
              <span>{`${recipient.slice(0, 6)}…${recipient.slice(-4)}`}</span>
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
            {pending ? "Sending…" : "Confirm send"}
          </button>
        ) : (
          <button
            className="portal-primary-action"
            type="button"
            disabled={
              wallet.status === "unconfigured" ||
              (wallet.status === "ready" && wallet.fundingWalletOnSelectedChain && !valid)
            }
            onClick={primary}
          >
            {wallet.status === "signed-out"
              ? "Connect wallet"
              : wallet.address && !wallet.fundingWalletOnSelectedChain
                ? `Switch to ${wallet.fundingNetworkName}`
                : "Review send"}
          </button>
        )}
      </div>
    </WalletDialog>
  );
}
