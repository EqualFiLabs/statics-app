"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  encodeFunctionData,
  formatUnits,
  getAddress,
  isAddress,
  parseAbi,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";

import { usePublicClient, useWalletClient } from "wagmi";
import { ArrowDownUp, ArrowUpRight, Download, Send } from "lucide-react";
import { useTranslations } from "next-intl";

import { PortalWorkspace } from "@/components/portal/PortalWorkspace";
import { WalletNftPanel } from "@/components/wallet/WalletNftPanel";
import { useWalletNftCollections } from "@/hooks/useWalletNftCollections";
import { readNftCollection } from "@/lib/wallet/nft-contracts";
import { loadRiskShareBalances, type RiskShareBalance } from "@/lib/wallet/risk-shares";
import {
  erc721TransferAbi,
  validateRecipient,
  verifyNftTransfer,
  type WalletNft,
} from "@/lib/wallet/nfts";
import { readClientDollarDeployment } from "@/lib/dollar/deployment";
import { portalRequested, walletPortalUrl, withoutWalletPortal } from "@/lib/portal/navigation";
import { SolanaWalletPanel } from "@/components/wallet/SolanaWalletPanel";
import { TokenLogo } from "@/components/wallet/TokenLogo";
import { useWalletTokens } from "@/hooks/useWalletTokens";
import { getFundingNetwork } from "@/lib/funding-networks";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { subscribeToProtocolReconciliation } from "@/lib/protocol/reconciliation";
import { searchTokenList } from "@/lib/token-list";
import { getNativeTokenLogoURI } from "@/lib/token-icons";
import type { WalletToken } from "@/lib/wallet-tokens";
import { useWalletState } from "@/providers/wallet-context";
import { useAppLocale } from "@/i18n/client";
import { parseLocalizedUnits } from "@/lib/i18n/amounts";

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

const deploymentState = readClientDollarDeployment();

type WalletModal = "send" | "receive" | "portal" | "browse" | "custom" | "nft" | "add-nft" | null;
/** Tokens and NFTs are both holdings; activity is a route, linked rather than duplicated. */
type WalletTab = "tokens" | "nfts";
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
  const t = useTranslations("wallet");
  const wallet = useWalletState();
  const network = getFundingNetwork(wallet.fundingChainId);
  const nftChainId =
    deploymentState.status === "configured" ? deploymentState.deployment.chainId : null;
  const { tokens, addToken, removeToken } = useWalletTokens(wallet.fundingChainId);
  const [modal, setModalState] = useState<WalletModal>(null);
  const [walletMode, setWalletMode] = useState<"evm" | "solana">("evm");
  const [tab, setTab] = useState<WalletTab>("tokens");
  const [removingTokens, setRemovingTokens] = useState(false);
  const [transferNft, setTransferNft] = useState<WalletNft | null>(null);

  const [nativeBalance, setNativeBalance] = useState<AssetBalance>(null);
  const [tokenBalances, setTokenBalances] = useState<Record<string, AssetBalance>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [riskShares, setRiskShares] = useState<readonly RiskShareBalance[]>([]);
  const refreshId = useRef(0);
  const tokenAddresses = useMemo(() => tokens.map((token) => token.address).join(","), [tokens]);

  const setModal = useCallback((next: WalletModal) => {
    setModalState(next);
    if (typeof window === "undefined") return;
    if (next === "portal") {
      window.history.pushState(
        null,
        "",
        walletPortalUrl(window.location.pathname, window.location.search)
      );
    } else if (portalRequested(window.location.search)) {
      window.history.replaceState(
        null,
        "",
        withoutWalletPortal(window.location.pathname, window.location.search)
      );
    }
  }, []);

  useEffect(() => {
    const syncPortal = () => {
      setModalState((current) => {
        if (portalRequested(window.location.search)) return "portal";
        return current === "portal" ? null : current;
      });
    };
    syncPortal();
    window.addEventListener("popstate", syncPortal);
    return () => window.removeEventListener("popstate", syncPortal);
  }, []);

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

      // Risk shares only exist on the Statics chain, so they are read only
      // while that chain is the one being viewed. Listing a Statics balance
      // under a Base heading would misstate where the money is.
      if (
        deploymentState.status === "configured" &&
        deploymentState.deployment.chainId === wallet.fundingChainId
      ) {
        const shares = await loadRiskShareBalances(
          publicClient,
          deploymentState.deployment,
          account
        ).catch(() => []);
        if (currentRefresh === refreshId.current) setRiskShares(shares);
      } else {
        setRiskShares([]);
      }
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

  const refreshBalancesRef = useRef(refreshBalances);
  useEffect(() => {
    refreshBalancesRef.current = refreshBalances;
  });

  useEffect(() => {
    const walletAddress = wallet.address?.toLowerCase();
    return subscribeToProtocolReconciliation(
      () => refreshBalancesRef.current(),
      (confirmed) =>
        walletAddress !== undefined &&
        confirmed.chainId === wallet.fundingChainId &&
        confirmed.wallet.toLowerCase() === walletAddress
    );
  }, [wallet.address, wallet.fundingChainId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setNativeBalance(null);
      setTokenBalances({});
      void refreshBalances();
    }, 0);
    return () => window.clearTimeout(timeout);
    // Refresh identity is intentionally limited to wallet, network, and selected-token changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.address, wallet.fundingChainId, wallet.fundingWalletOnSelectedChain, tokenAddresses]);

  const nativeSymbol = network?.chain.nativeCurrency.symbol ?? "--";
  const nativeAsset = {
    id: "native",
    kind: "native" as const,
    name: network?.chain.nativeCurrency.name ?? t("nativeAsset"),
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
    ...riskShares.map((share) => ({
      id: `${share.address}:${share.seriesId}`,
      kind: "erc1155" as const,
      address: share.address,
      symbol: share.symbol,
      name: share.name,
      decimals: share.decimals,
      balance: share.balance,
      isDefault: true,
      tokenId: share.seriesId,
      // Risk shares carry no logo, and the token row expects the key to exist.
      logoURI: undefined as string | undefined,
    })),
  ];
  const hasAddedTokens = tokens.some((token) => !token.isDefault);

  if (walletMode === "solana") {
    return (
      <>
        <WalletModeSelector mode={walletMode} onChange={setWalletMode} />
        <SolanaWalletPanel onPortal={() => setModal("portal")} />
        {modal === "portal" && (
          <WalletDialog label={t("fundingPortal")} wide onClose={() => setModal(null)}>
            <PortalWorkspace compact initialSwapRuntime="solana" />
          </WalletDialog>
        )}
      </>
    );
  }

  return (
    <>
      <WalletModeSelector mode={walletMode} onChange={setWalletMode} />
      <section className="wallet-surface">
        <div className="wallet-network-row">
          <label>
            <span>{t("network")}</span>
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
            {refreshing ? t("refreshing") : t("refresh")}
          </button>
        </div>

        <div className="wallet-balance-hero">
          <span>{wallet.fundingNetworkName}</span>
          <strong>{displayBalance(nativeBalance, nativeAsset.decimals)}</strong>
          <small>{nativeSymbol}</small>
        </div>

        {/* Same three actions, same order and same stacked icon treatment as the
            market app, so the two wallets read as one product. */}
        <div className="wallet-quick-actions">
          <button type="button" onClick={() => setModal("portal")}>
            <ArrowDownUp size={16} aria-hidden="true" />
            {t("portal")}
          </button>
          <button type="button" onClick={() => setModal("send")}>
            <Send size={16} aria-hidden="true" />
            {t("send")}
          </button>
          <button type="button" onClick={() => setModal("receive")}>
            <Download size={16} aria-hidden="true" />
            {t("receive")}
          </button>
        </div>

        <div className="wallet-assets">
          {/* Tabs over the holdings, with activity linking to its own route
              rather than duplicating that page inside this one. */}
          <div className="wallet-tabs">
            {/* Only the tabs carry tablist semantics. The activity link leaves
                the page, so including it would make the tablist invalid and
                announce a destination as though it were a panel. */}
            <div className="wallet-tabs-list" role="tablist" aria-label={t("holdings")}>
              {(
                [
                  ["tokens", t("tokens")],
                  ["nfts", t("nfts")],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={tab === value}
                  className={tab === value ? "active" : undefined}
                  onClick={() => setTab(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <Link className="wallet-tabs-activity" href="/app/activity">
              {t("activity")} <ArrowUpRight size={13} aria-hidden="true" />
            </Link>
          </div>

          {tab === "nfts" ? (
            <WalletNftPanel
              onAddCollection={() => setModal("add-nft")}
              onTransfer={(nft) => {
                setTransferNft(nft);
                setModal("nft");
              }}
            />
          ) : (
            <>
              <div className="wallet-section-heading">
                <div>
                  <h2>{t("tokens")}</h2>
                </div>
                <div className="wallet-asset-actions">
                  <button type="button" onClick={() => setModal("browse")}>
                    {t("browse")}
                  </button>
                  <button type="button" onClick={() => setModal("custom")}>
                    {t("addToken")}
                  </button>
                  <button
                    type="button"
                    aria-pressed={removingTokens}
                    disabled={!hasAddedTokens && !removingTokens}
                    onClick={() => setRemovingTokens((current) => !current)}
                  >
                    {removingTokens ? t("done") : t("remove")}
                  </button>
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
                      {removingTokens && asset.kind === "erc20" && !asset.isDefault ? (
                        <button
                          className="wallet-remove-token"
                          type="button"
                          aria-label={t("removeToken", { symbol: asset.symbol })}
                          onClick={() => removeToken(asset.address)}
                        >
                          {t("remove")}
                        </button>
                      ) : (
                        <span>
                          {asset.kind === "native"
                            ? t("native")
                            : asset.kind === "erc1155"
                              ? t("riskShares")
                              : t("token")}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {modal === "add-nft" && nftChainId !== null && (
        <WalletDialog label={t("addNft")} onClose={() => setModal(null)}>
          <AddNftCollectionForm chainId={nftChainId} onDone={() => setModal(null)} />
        </WalletDialog>
      )}
      {modal === "nft" && transferNft && (
        <WalletDialog
          label={t("sendNft", { name: transferNft.name })}
          onClose={() => {
            setModal(null);
            setTransferNft(null);
          }}
        >
          <NftTransferForm
            nft={transferNft}
            onDone={() => {
              setModal(null);
              setTransferNft(null);
            }}
          />
        </WalletDialog>
      )}
      {modal === "portal" && (
        <WalletDialog label={t("fundingPortal")} wide onClose={() => setModal(null)}>
          <PortalWorkspace compact />
        </WalletDialog>
      )}
      {modal === "receive" && (
        <WalletDialog label={t("receive")} onClose={() => setModal(null)}>
          <div className="wallet-dialog-content">
            <span>
              {"// "}
              {t("receive")}
            </span>
            <h2>{wallet.fundingNetworkName}</h2>
            <code>{wallet.address ?? "--"}</code>
            <button
              className="portal-primary-action"
              type="button"
              disabled={!wallet.address}
              onClick={() => void wallet.copyAddress()}
            >
              {t("copyAddress")}
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

function WalletModeSelector({
  mode,
  onChange,
}: {
  mode: "evm" | "solana";
  onChange: (mode: "evm" | "solana") => void;
}) {
  const t = useTranslations("wallet");
  return (
    <div className="portal-chain-tabs wallet-mode-tabs" aria-label={t("chainType")}>
      <button type="button" aria-pressed={mode === "evm"} onClick={() => onChange("evm")}>
        EVM
      </button>
      <button type="button" aria-pressed={mode === "solana"} onClick={() => onChange("solana")}>
        Solana
      </button>
    </div>
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
  const t = useTranslations("wallet");
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
        <button
          className="wallet-dialog-close"
          type="button"
          onClick={onClose}
          aria-label={t("close")}
        >
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
  const t = useTranslations("wallet");
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
    <WalletDialog label={t("browseTokens")} wide onClose={onClose}>
      <div className="wallet-dialog-content wallet-token-browser">
        <span>
          {"// "}
          {t("tokenCatalog")}
        </span>
        <h2>{t("browseTokens")}</h2>
        <input
          autoFocus
          aria-label={t("searchTokens")}
          value={search}
          placeholder={t("searchPlaceholder")}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button className="wallet-inline-action" type="button" onClick={onCustom}>
          {t("addCustom")}
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
  const t = useTranslations("wallet");
  const wallet = useWalletState();
  const [input, setInput] = useState("");
  const [token, setToken] = useState<WalletToken | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const address = isAddress(input) && input !== zeroAddress ? getAddress(input) : null;
  const {
    address: walletAddress,
    fundingChainId,
    fundingWalletOnSelectedChain,
    getEthereumProvider,
  } = wallet;

  useEffect(() => {
    if (!address || !walletAddress || !fundingWalletOnSelectedChain) {
      const timeout = window.setTimeout(() => {
        setToken(null);
        setError(null);
      }, 0);
      return () => window.clearTimeout(timeout);
    }
    let active = true;
    const timeout = window.setTimeout(() => {
      setReading(true);
      void (async () => {
        try {
          const provider = await getEthereumProvider();
          const network = getFundingNetwork(fundingChainId);
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
  }, [address, walletAddress, fundingChainId, fundingWalletOnSelectedChain, getEthereumProvider]);

  const duplicate = Boolean(
    address &&
    existing.some((candidate) => candidate.address.toLowerCase() === address.toLowerCase())
  );
  return (
    <WalletDialog label={t("addToken")} onClose={onClose}>
      <div className="wallet-dialog-content">
        <span>
          {"// "}
          {t("customToken")}
        </span>
        <h2>{t("addErc20")}</h2>
        <label className="portal-field">
          <span>{t("contractAddress")}</span>
          <input
            value={input}
            placeholder="0x…"
            onChange={(event) => {
              setInput(event.target.value);
              setToken(null);
              setError(null);
            }}
          />
        </label>
        <div className="wallet-token-metadata">
          <span>{t("symbol")}</span>
          <strong>{reading ? t("reading") : (token?.symbol ?? "--")}</strong>
          <span>{t("decimals")}</span>
          <strong>{token?.decimals ?? "--"}</strong>
        </div>
        {(error || duplicate) && (
          <p className="portal-error" role="alert">
            {duplicate ? t("duplicate") : error}
          </p>
        )}
        <button
          className="portal-primary-action"
          type="button"
          disabled={!token || duplicate}
          onClick={() => token && onAdd(token)}
        >
          {t("addToken")}
        </button>
      </div>
    </WalletDialog>
  );
}

type TransferAsset = {
  id: string;
  kind: "native" | "erc20" | "erc1155";
  name: string;
  symbol: string;
  decimals: number;
  balance: AssetBalance;
  address?: Address;
  logoURI?: string;
  /** ERC-1155 only: the id the balance is held under. */
  tokenId?: bigint;
};

/**
 * ERC-1155 transfer. Omitted from the vendored SDK's risk-share ABI even
 * though the contract is OpenZeppelin's ERC1155 and has always had it, the
 * same gap as the diamond's ERC-721 transferFrom.
 */
const erc1155TransferAbi = parseAbi([
  "function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes data)",
]);

function SendDialog({
  assets,
  onConfirmed,
  onClose,
}: {
  assets: TransferAsset[];
  onConfirmed: () => Promise<void>;
  onClose: () => void;
}) {
  const locale = useAppLocale();
  const t = useTranslations("wallet");
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
    amountRaw = asset ? parseLocalizedUnits(amount, asset.decimals, locale) : 0n;
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
      let data: Hex = "0x";
      if (asset.kind === "erc20") {
        data = encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [getAddress(recipient), amountRaw],
        });
      } else if (asset.kind === "erc1155") {
        // Takes the id as well as the amount, and the empty bytes argument is
        // required: a receiving contract is handed it in onERC1155Received.
        data = encodeFunctionData({
          abi: erc1155TransferAbi,
          functionName: "safeTransferFrom",
          args: [account, getAddress(recipient), asset.tokenId ?? 0n, amountRaw, "0x"],
        });
      }
      await executeProtocolTransaction({
        publicClient,
        wallet: account,
        chainId: wallet.fundingChainId,
        kind: asset.kind === "erc1155" ? "transfer-nft" : "send",
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
    <WalletDialog label={t("send")} onClose={onClose}>
      <div className="wallet-dialog-content">
        <span>
          {"// "}
          {t("send")}
        </span>
        <h2>{t("sendAsset")}</h2>
        <label className="portal-field">
          <span>{t("asset")}</span>
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
          <span>{t("recipient")}</span>
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
          <span>{t("amount")}</span>
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
            {pending ? t("sending") : t("confirmSend")}
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
              ? t("connectWallet")
              : wallet.address && !wallet.fundingWalletOnSelectedChain
                ? t("switchNetwork", { network: wallet.fundingNetworkName })
                : t("reviewSend")}
          </button>
        )}
      </div>
    </WalletDialog>
  );
}

/**
 * Moves a position or liquidity NFT to another address.
 *
 * Transferring a position hands over everything attached to it, so the
 * consequence is restated here even though the list already showed it: this is
 * the last screen before a signature, and it is the only irreversible action in
 * the wallet.
 *
 * Ownership is re-read after confirmation rather than trusting the receipt. A
 * transfer that appeared to succeed but left the token in place would leave
 * someone believing they had handed over a position they still hold.
 */
function NftTransferForm({ nft, onDone }: { nft: WalletNft; onDone: () => void }) {
  const t = useTranslations("wallet");
  const wallet = useWalletState();
  const chainId =
    deploymentState.status === "configured" ? deploymentState.deployment.chainId : undefined;
  const publicClient = usePublicClient(chainId ? { chainId } : undefined);
  const walletClient = useWalletClient(chainId ? { chainId } : undefined);
  const [recipient, setRecipient] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sender = wallet.status === "ready" && wallet.address ? getAddress(wallet.address) : null;
  const problem = sender ? validateRecipient(recipient, sender) : "Connect a wallet to continue.";

  const submit = async () => {
    if (!sender || !publicClient || !walletClient.data || problem || !chainId) return;
    setPending(true);
    setError(null);
    try {
      const to = getAddress(recipient.trim());
      await executeProtocolTransaction({
        publicClient,
        wallet: sender,
        chainId,
        kind: "transfer-nft",
        label: `Send ${nft.name}`,
        amount: nft.name,
        to: nft.contract,
        data: encodeFunctionData({
          abi: erc721TransferAbi,
          functionName: "safeTransferFrom",
          args: [sender, to, nft.tokenId],
        }),
        sendTransaction: ({ to: target, data, value }) =>
          walletClient.data!.sendTransaction({
            account: sender,
            chain: walletClient.data!.chain,
            to: target,
            data,
            value,
          }),
        describeError: (cause) =>
          cause instanceof Error ? cause.message : "The transfer did not complete.",
        // Confirms the chain actually reassigned the token, rather than
        // trusting a successful transaction.
        verifyConfirmation: () => verifyNftTransfer(publicClient, nft, to),
      });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The transfer did not complete.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="wallet-nft-transfer">
      {nft.carries.length > 0 && (
        <p className="wallet-nft-transfer-warning">
          <strong>{t("movesMore")}</strong> {t("cannotUndo", { assets: nft.carries.join(", ") })}
        </p>
      )}
      <label className="basket-field">
        <span>{t("sendTo")}</span>
        <input
          value={recipient}
          onChange={(event) => {
            setRecipient(event.target.value);
            setError(null);
          }}
          placeholder="0x…"
          spellCheck={false}
          disabled={pending}
        />
      </label>
      {error && (
        <p className="dapp-inline-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="dollar-submit"
        type="button"
        onClick={() => void submit()}
        disabled={pending || problem !== null}
      >
        {pending ? t("sending") : problem ? problem : t("sendNft", { name: nft.name })}
      </button>
    </div>
  );
}

/**
 * Adds an ERC-721 collection by contract address.
 *
 * There is no call that lists the NFTs a wallet holds, so a collection has to
 * be named before it can be shown. This mirrors adding a custom ERC-20, which
 * is the pattern someone has already met one tab over.
 *
 * The address is checked against the chain before it is stored: a contract must
 * exist and answer as an ERC-721. Skipping that would let an ERC-20 in, and it
 * would then report a balance in wei and offer to transfer token id
 * 1000000000000000000.
 */
function AddNftCollectionForm({ chainId, onDone }: { chainId: number; onDone: () => void }) {
  const t = useTranslations("wallet");
  const publicClient = usePublicClient({ chainId });
  const { addCollection } = useWalletNftCollections(chainId);
  const [address, setAddress] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!publicClient) {
      setError("No client is available for this network.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      addCollection(await readNftCollection(publicClient, address.trim(), tokenId.trim()));
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That collection could not be added.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="wallet-nft-transfer">
      <p className="wallet-add-nft-note">{t("addNftDescription")}</p>
      <label className="basket-field">
        <span>{t("contractAddress")}</span>
        <input
          value={address}
          onChange={(event) => {
            setAddress(event.target.value);
            setError(null);
          }}
          placeholder="0x…"
          spellCheck={false}
          disabled={pending}
        />
      </label>
      <label className="basket-field">
        <span>{t("tokenId")}</span>
        <input
          value={tokenId}
          onChange={(event) => {
            setTokenId(event.target.value);
            setError(null);
          }}
          placeholder={t("tokenIdPlaceholder")}
          inputMode="numeric"
          disabled={pending}
        />
      </label>
      {error && (
        <p className="dapp-inline-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="dollar-submit"
        type="button"
        onClick={() => void submit()}
        disabled={pending || address.trim().length === 0}
      >
        {pending ? t("checking") : t("addCollection")}
      </button>
    </div>
  );
}
