"use client";

import { useEffect, useMemo, useState } from "react";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { formatUnits } from "viem";
import { ArrowDownUp, Download, Send } from "lucide-react";
import { useTranslations } from "next-intl";

import { TokenLogo } from "@/components/wallet/TokenLogo";
import { useSolanaAssets, type SolanaAsset } from "@/hooks/useSolanaAssets";
import { SOL_MINT } from "@/lib/portal/solana";
import {
  createAssociatedTokenInstruction,
  createTransferCheckedInstruction,
  findAssociatedTokenAddress,
  SOLANA_MAINNET_CHAIN,
} from "@/lib/solana-wallet";
import { validSolanaPublicKey, type SolanaToken } from "@/lib/solana-tokens";
import { updateSolanaActivity, writeSolanaActivity } from "@/lib/portal/solana-activity";
import { useAppLocale } from "@/i18n/client";
import { parseLocalizedUnits } from "@/lib/i18n/amounts";

type SolanaModal = "send" | "receive" | "tokens" | null;

function displayBalance(value: bigint | null, decimals: number) {
  if (value === null) return "--";
  const [whole, fraction = ""] = formatUnits(value, decimals).split(".");
  return fraction
    ? `${whole}.${fraction.slice(0, 6).replace(/0+$/, "")}`.replace(/\.$/, "")
    : whole;
}

export function SolanaWalletPanel({ onPortal }: { onPortal: () => void }) {
  const t = useTranslations("wallet");
  const wallet = useSolanaAssets();
  const [modal, setModal] = useState<SolanaModal>(null);
  const [removingTokens, setRemovingTokens] = useState(false);
  const native = wallet.assets.find((asset) => asset.mint === SOL_MINT);
  const hasAddedTokens = wallet.assets.some((asset) => asset.removable);
  return (
    <>
      <section className="wallet-surface">
        <div className="wallet-network-row">
          <label>
            <span>{t("network")}</span>
            <select value="solana:mainnet" disabled>
              <option>{t("solanaMainnet")}</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => void wallet.refresh()}
            disabled={wallet.refreshing || !wallet.wallet}
          >
            {wallet.refreshing ? t("refreshing") : t("refresh")}
          </button>
        </div>

        <div className="wallet-balance-hero">
          <span>{t("solanaMainnet")}</span>
          <strong>{displayBalance(native?.balance ?? null, 9)}</strong>
          <small>SOL</small>
        </div>

        <div className="wallet-quick-actions">
          <button type="button" onClick={onPortal}>
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
          <div className="wallet-section-heading">
            <div>
              <span>{`// ${t("assets")}`}</span>
              <h2>{t("tokens")}</h2>
            </div>
            <div className="wallet-asset-actions">
              <button type="button" onClick={() => setModal("tokens")}>
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
            {wallet.assets.map((asset) => (
              <div className="wallet-asset-row" key={asset.mint}>
                <TokenLogo
                  token={{ address: asset.mint, symbol: asset.symbol, logoURI: asset.logoURI }}
                />
                <div>
                  <strong>{asset.symbol}</strong>
                  <span>{asset.name}</span>
                </div>
                <div>
                  <strong>{displayBalance(asset.balance, asset.decimals)}</strong>
                  {removingTokens && asset.removable ? (
                    <button
                      className="wallet-remove-token"
                      type="button"
                      aria-label={t("removeToken", { symbol: asset.symbol })}
                      onClick={() => wallet.removeToken(asset.mint)}
                    >
                      {t("remove")}
                    </button>
                  ) : (
                    <span>{asset.mint === SOL_MINT ? t("native") : t("token")}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {modal === "receive" && (
        <SolanaDialog label={t("receiveOnSolana")} onClose={() => setModal(null)}>
          <div className="wallet-dialog-content">
            <span>{`// ${t("receive")}`}</span>
            <h2>{t("solanaMainnet")}</h2>
            <code>{wallet.wallet?.address ?? "--"}</code>
            <button
              className="portal-primary-action"
              type="button"
              disabled={!wallet.wallet}
              onClick={() =>
                wallet.wallet && void navigator.clipboard.writeText(wallet.wallet.address)
              }
            >
              {t("copyAddress")}
            </button>
          </div>
        </SolanaDialog>
      )}
      {modal === "tokens" && (
        <SolanaTokenBrowser
          existing={wallet.assets}
          onAdd={wallet.addToken}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "send" && <SolanaSendDialog wallet={wallet} onClose={() => setModal(null)} />}
    </>
  );
}

function SolanaDialog({
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
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
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

type JupiterToken = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  icon?: string;
};

function SolanaTokenBrowser({
  existing,
  onAdd,
  onClose,
}: {
  existing: readonly SolanaAsset[];
  onAdd: (token: SolanaToken) => void;
  onClose: () => void;
}) {
  const t = useTranslations("wallet");
  const [query, setQuery] = useState("");
  const [tokens, setTokens] = useState<JupiterToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void fetch(`/api/jupiter/tokens?query=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          const payload: unknown = await response.json();
          if (!response.ok || !Array.isArray(payload)) throw new Error(t("tokenSearchFailed"));
          setTokens(
            payload.filter((token): token is JupiterToken =>
              Boolean(
                token &&
                typeof token === "object" &&
                "address" in token &&
                validSolanaPublicKey(token.address)
              )
            )
          );
        })
        .catch((cause) => {
          if (!controller.signal.aborted) {
            setError(cause instanceof Error ? cause.message : t("tokenSearchFailed"));
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query, t]);
  const existingMints = useMemo(() => new Set(existing.map((token) => token.mint)), [existing]);
  return (
    <SolanaDialog label={t("browseSolanaTokens")} wide onClose={onClose}>
      <div className="wallet-dialog-content wallet-token-browser">
        <span>{`// ${t("jupiterTokenList")}`}</span>
        <h2>{t("browseTokens")}</h2>
        <input
          autoFocus
          aria-label={t("searchSolanaTokens")}
          value={query}
          placeholder={t("searchSolanaPlaceholder")}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="wallet-catalog-list">
          {tokens
            .filter((token) => !existingMints.has(token.address))
            .map((token) => (
              <button
                key={token.address}
                type="button"
                onClick={() => {
                  onAdd({
                    mint: token.address,
                    symbol: token.symbol,
                    name: token.name,
                    decimals: token.decimals,
                    logoURI: token.icon,
                  });
                  onClose();
                }}
              >
                <TokenLogo
                  token={{ address: token.address, symbol: token.symbol, logoURI: token.icon }}
                />
                <span>
                  <strong>{token.symbol}</strong>
                  <small>{token.name}</small>
                </span>
                <code>{`${token.address.slice(0, 4)}…${token.address.slice(-4)}`}</code>
              </button>
            ))}
          {loading && <p>--</p>}
          {error && (
            <p className="portal-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </SolanaDialog>
  );
}

function SolanaSendDialog({
  wallet,
  onClose,
}: {
  wallet: ReturnType<typeof useSolanaAssets>;
  onClose: () => void;
}) {
  const t = useTranslations("wallet");
  const locale = useAppLocale();
  const [assetMint, setAssetMint] = useState(wallet.assets[0]?.mint ?? SOL_MINT);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const asset = wallet.assets.find((candidate) => candidate.mint === assetMint);
  let rawAmount = 0n;
  try {
    rawAmount = asset ? parseLocalizedUnits(amount, asset.decimals, locale) : 0n;
  } catch {
    rawAmount = 0n;
  }
  const withinBalance = asset ? asset.balance === null || rawAmount <= asset.balance : false;
  const valid =
    Boolean(asset && validSolanaPublicKey(recipient) && rawAmount > 0n) && withinBalance;

  const confirm = async () => {
    if (!wallet.wallet || !asset || !validSolanaPublicKey(recipient) || !valid || pending) return;
    const activityId = crypto.randomUUID();
    writeSolanaActivity({
      id: activityId,
      wallet: wallet.wallet.address,
      kind: "send",
      label: `Send ${asset.symbol}`,
      amount: `${amount} ${asset.symbol}`,
      status: "signing",
      createdAt: Date.now(),
    });
    setPending(true);
    setError(null);
    try {
      const sender = new PublicKey(wallet.wallet.address);
      const receiver = new PublicKey(recipient);
      const latest = await wallet.connection.getLatestBlockhash("confirmed");
      const transaction = new Transaction({
        feePayer: sender,
        recentBlockhash: latest.blockhash,
      });
      if (asset.mint === SOL_MINT) {
        transaction.add(
          SystemProgram.transfer({ fromPubkey: sender, toPubkey: receiver, lamports: rawAmount })
        );
      } else {
        if (!asset.tokenAccount || !asset.tokenProgramId) {
          throw new Error("This token account is unavailable.");
        }
        const mint = new PublicKey(asset.mint);
        const program = new PublicKey(asset.tokenProgramId);
        const destination = findAssociatedTokenAddress({
          owner: receiver,
          mint,
          tokenProgramId: program,
        });
        transaction.add(
          createAssociatedTokenInstruction({
            payer: sender,
            owner: receiver,
            mint,
            associatedToken: destination,
            tokenProgramId: program,
          }),
          createTransferCheckedInstruction({
            source: new PublicKey(asset.tokenAccount),
            mint,
            destination,
            owner: sender,
            amount: rawAmount,
            decimals: asset.decimals,
            tokenProgramId: program,
          })
        );
      }
      const { signedTransaction } = await wallet.runtime.signTransaction({
        wallet: wallet.wallet,
        chain: SOLANA_MAINNET_CHAIN,
        transaction: transaction.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        }),
      });
      const signature = await wallet.connection.sendRawTransaction(signedTransaction, {
        skipPreflight: false,
      });
      updateSolanaActivity(activityId, { status: "submitted", signature });
      const confirmation = await wallet.connection.confirmTransaction(
        { signature, ...latest },
        "confirmed"
      );
      if (confirmation.value.err) throw new Error("Solana transaction reverted.");
      updateSolanaActivity(activityId, { status: "confirmed", signature });
      await wallet.refresh();
      onClose();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The transfer failed.";
      updateSolanaActivity(activityId, { status: "failed", error: message });
      setError(message);
    } finally {
      setPending(false);
    }
  };

  return (
    <SolanaDialog label={t("sendOnSolana")} onClose={onClose}>
      <div className="wallet-dialog-content">
        <span>{`// ${t("send")}`}</span>
        <h2>{t("sendAsset")}</h2>
        <label className="portal-field">
          <span>{t("asset")}</span>
          <select
            value={assetMint}
            onChange={(event) => {
              setAssetMint(event.target.value);
              setReviewing(false);
            }}
          >
            {wallet.assets.map((candidate) => (
              <option key={candidate.mint} value={candidate.mint}>
                {candidate.symbol} · {displayBalance(candidate.balance, candidate.decimals)}
              </option>
            ))}
          </select>
        </label>
        <label className="portal-field">
          <span>{t("recipient")}</span>
          <input
            value={recipient}
            placeholder={t("solanaAddress")}
            onChange={(event) => {
              setRecipient(event.target.value.trim());
              setReviewing(false);
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
              <span>{`${recipient.slice(0, 4)}…${recipient.slice(-4)}`}</span>
            </div>
          </div>
        )}
        {error && (
          <p className="portal-error" role="alert">
            {error}
          </p>
        )}
        {!wallet.wallet ? (
          <button
            className="portal-primary-action"
            type="button"
            disabled={!wallet.runtime.configured || !wallet.runtime.ready}
            onClick={() => void wallet.runtime.createWallet()}
          >
            {t("createSolanaWallet")}
          </button>
        ) : reviewing ? (
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
            disabled={!valid}
            onClick={() => setReviewing(true)}
          >
            {t("reviewSend")}
          </button>
        )}
      </div>
    </SolanaDialog>
  );
}
