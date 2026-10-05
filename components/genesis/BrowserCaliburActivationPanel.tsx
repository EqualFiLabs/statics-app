"use client";

import { useEffect, useState } from "react";
import { useSign7702Authorization } from "@privy-io/react-auth";
import { useTranslations } from "next-intl";
import { formatEther, getAddress, type Address, type Hex } from "viem";
import { usePublicClient } from "wagmi";

import {
  activateCaliburWithBrowserRelay,
  existingBrowserRelayAddress,
  quoteBrowserCaliburRelay,
  refundBrowserRelay,
  type BrowserRelayQuote,
  type BrowserRelayResult,
} from "@/lib/genesis/browser-calibur-relay";
import { delegationFromCode } from "@/lib/genesis/atomic-batch";
import { ROBINHOOD_CALIBUR } from "@/lib/genesis/calibur";
import { useWalletState } from "@/providers/wallet-context";

export function BrowserCaliburActivationPanel() {
  const t = useTranslations("operators.bulk.activation");
  const walletState = useWalletState();
  const publicClient = usePublicClient({ chainId: 4663 });
  const { signAuthorization } = useSign7702Authorization();
  const wallet = walletState.address ? getAddress(walletState.address) : null;
  const [review, setReview] = useState<BrowserRelayQuote | null>(null);
  const [reviewWallet, setReviewWallet] = useState<Address | null>(null);
  const [result, setResult] = useState<BrowserRelayResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [relayAddress, setRelayAddress] = useState<Address | null>(null);
  const [delegation, setDelegation] = useState<"loading" | "fresh" | "calibur" | "other">(
    "loading"
  );
  const activeReview = reviewWallet === wallet ? review : null;

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setRelayAddress(wallet ? existingBrowserRelayAddress(wallet) : null),
      0
    );
    return () => window.clearTimeout(timeout);
  }, [wallet]);

  useEffect(() => {
    if (!wallet || !publicClient) return;
    let cancelled = false;
    void publicClient
      .getCode({ address: wallet })
      .then((code) => {
        if (cancelled) return;
        setDelegation(
          !code || code === "0x"
            ? "fresh"
            : delegationFromCode(code) === ROBINHOOD_CALIBUR
              ? "calibur"
              : "other"
        );
      })
      .catch(() => {
        if (!cancelled) setDelegation("loading");
      });
    return () => {
      cancelled = true;
    };
  }, [publicClient, wallet]);

  const ready =
    wallet !== null &&
    publicClient !== undefined &&
    walletState.walletKind === "embedded" &&
    walletState.isTargetChain &&
    walletState.targetChainId === 4663;

  const check = async () => {
    setBusy(true);
    setError(null);
    setReview(null);
    setResult(null);
    try {
      if (!ready || !wallet || !publicClient) {
        throw new Error("Connect a Privy embedded wallet on Robinhood Chain 4663.");
      }
      const quote = await quoteBrowserCaliburRelay(publicClient, wallet);
      setRelayAddress(quote.relayer);
      setReview(quote);
      setReviewWallet(wallet);
      setMessage(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const activate = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!ready || !wallet || !publicClient || !activeReview) {
        throw new Error("Review Calibur activation again with the connected wallet.");
      }
      const current = await quoteBrowserCaliburRelay(publicClient, wallet);
      if (
        current.relayer !== activeReview.relayer ||
        current.fundingAmount > activeReview.fundingAmount
      ) {
        throw new Error("Relayer or network fees changed. Review activation again.");
      }
      const outcome = await activateCaliburWithBrowserRelay({
        publicClient,
        wallet,
        signAuthorization,
        onProgress: setMessage,
        sendFunding: async (to, value): Promise<Hex> => {
          const gasEstimate = await publicClient.estimateGas({ account: wallet, to, value });
          return walletState.sendEvmTransaction({
            wallet,
            chainId: 4663,
            to,
            data: "0x",
            value,
            gasLimit: gasEstimate + 10_000n,
            presentation: {
              action: "Fund Calibur activation",
              description: "Fund a short lived browser relayer. Unused ETH will be returned.",
              buttonText: "Confirm funding",
              contractName: "Temporary activation relayer",
            },
          });
        },
      });
      setResult(outcome);
      setDelegation("calibur");
      setRelayAddress(outcome.relayer);
      setReview(null);
      setMessage(t("confirmed"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const recover = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!wallet || !publicClient || !relayAddress) {
        throw new Error("Connect the wallet used to fund this temporary relayer.");
      }
      const refund = await refundBrowserRelay(publicClient, wallet);
      setMessage(
        refund.refundHash ? t("returned", { hash: refund.refundHash }) : t("belowRefundCost")
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="genesis-browser-relay" aria-label={t("title")}>
      <h4>{t("title")}</h4>
      <p>{t("description")}</p>
      {delegation === "fresh" && (
        <button
          className="ui-button ui-button--secondary"
          type="button"
          disabled={busy || !ready}
          onClick={() => void check()}
        >
          {busy ? t("checking") : t("review")}
        </button>
      )}
      {delegation === "calibur" && <p>{t("alreadyActive")}</p>}
      {delegation === "other" && <p>{t("otherDelegate")}</p>}
      {relayAddress && (
        <button
          className="ui-button ui-button--secondary"
          type="button"
          disabled={busy}
          onClick={() => void recover()}
        >
          {t("recover")}
        </button>
      )}
      {activeReview && (
        <div className="genesis-batch-review" role="status">
          <p>{t("delegate", { address: ROBINHOOD_CALIBUR })}</p>
          <p>{t("relayer", { address: activeReview.relayer })}</p>
          <p>
            {t("funding", {
              amount: formatEther(activeReview.fundingAmount),
              balance: formatEther(activeReview.existingBalance),
            })}
          </p>
          <p>{t("maximumFee", { amount: formatEther(activeReview.maximumActivationFee) })}</p>
          <button
            className="ui-button ui-button--primary"
            type="button"
            disabled={busy}
            onClick={() => void activate()}
          >
            {busy ? t("activating") : t("fundAndSign")}
          </button>
          <button
            className="ui-button ui-button--secondary"
            type="button"
            disabled={busy}
            onClick={() => setReview(null)}
          >
            {t("cancel")}
          </button>
        </div>
      )}
      {result && (
        <p role="status">
          {t("result", {
            activation: result.activationHash,
            refund: result.refundHash ?? t("notConfirmed"),
            balance: formatEther(result.remainingBalance),
          })}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
