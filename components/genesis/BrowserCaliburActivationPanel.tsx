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
  quoteBrowserCaliburRevocation,
  refundBrowserRelay,
  revokeCaliburWithBrowserRelay,
  type BrowserRelayQuote,
  type BrowserRelayResult,
  type BrowserRelayRevocationQuote,
  type BrowserRelayRevocationResult,
} from "@/lib/genesis/browser-calibur-relay";
import { delegationFromCode } from "@/lib/genesis/atomic-batch";
import { REVOCABLE_ROBINHOOD_CALIBUR_DELEGATES, ROBINHOOD_CALIBUR } from "@/lib/genesis/calibur";
import { useWalletState } from "@/providers/wallet-context";

type Review =
  | { action: "activate"; quote: BrowserRelayQuote }
  | { action: "revoke"; quote: BrowserRelayRevocationQuote };

export function BrowserCaliburActivationPanel() {
  const t = useTranslations("operators.bulk.activation");
  const walletState = useWalletState();
  const publicClient = usePublicClient({ chainId: 4663 });
  const { signAuthorization } = useSign7702Authorization();
  const wallet = walletState.address ? getAddress(walletState.address) : null;
  const [review, setReview] = useState<Review | null>(null);
  const [reviewWallet, setReviewWallet] = useState<Address | null>(null);
  const [result, setResult] = useState<
    | { action: "activate"; value: BrowserRelayResult }
    | { action: "revoke"; value: BrowserRelayRevocationResult }
    | null
  >(null);
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
            : REVOCABLE_ROBINHOOD_CALIBUR_DELEGATES.some(
                  (known) => known === delegationFromCode(code)
                )
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

  const fundRelay = async (to: Address, value: bigint, action: "activate" | "revoke") => {
    if (!wallet || !publicClient) throw new Error("Connected wallet changed. Review again.");
    const gasEstimate = await publicClient.estimateGas({ account: wallet, to, value });
    return walletState.sendEvmTransaction({
      wallet,
      chainId: 4663,
      to,
      data: "0x",
      value,
      gasLimit: gasEstimate + 10_000n,
      presentation: {
        action: action === "activate" ? "Fund Calibur activation" : "Fund Calibur removal",
        description: "Fund a short lived browser relayer. Unused ETH will be returned.",
        buttonText: "Confirm funding",
        contractName: "Temporary Calibur relayer",
      },
    });
  };

  const check = async (action: "activate" | "revoke") => {
    setBusy(true);
    setError(null);
    setReview(null);
    setResult(null);
    try {
      if (!ready || !wallet || !publicClient) {
        throw new Error("Connect a Privy embedded wallet on Robinhood Chain 4663.");
      }
      const nextReview: Review =
        action === "activate"
          ? { action, quote: await quoteBrowserCaliburRelay(publicClient, wallet) }
          : { action, quote: await quoteBrowserCaliburRevocation(publicClient, wallet) };
      setRelayAddress(nextReview.quote.relayer);
      setReview(nextReview);
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
      if (!ready || !wallet || !publicClient || activeReview?.action !== "activate") {
        throw new Error("Review Calibur activation again with the connected wallet.");
      }
      const current = await quoteBrowserCaliburRelay(publicClient, wallet);
      if (
        current.relayer !== activeReview.quote.relayer ||
        current.fundingAmount > activeReview.quote.fundingAmount
      ) {
        throw new Error("Relayer or network fees changed. Review activation again.");
      }
      const outcome = await activateCaliburWithBrowserRelay({
        publicClient,
        wallet,
        signAuthorization,
        onProgress: setMessage,
        sendFunding: (to, value): Promise<Hex> => fundRelay(to, value, "activate"),
      });
      setResult({ action: "activate", value: outcome });
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

  const revoke = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!ready || !wallet || !publicClient || activeReview?.action !== "revoke") {
        throw new Error("Review Calibur removal again with the connected wallet.");
      }
      const outcome = await revokeCaliburWithBrowserRelay({
        publicClient,
        wallet,
        review: activeReview.quote,
        signAuthorization,
        onProgress: setMessage,
        sendFunding: (to, value): Promise<Hex> => fundRelay(to, value, "revoke"),
      });
      setResult({ action: "revoke", value: outcome });
      setDelegation("fresh");
      setRelayAddress(outcome.relayer);
      setReview(null);
      setMessage(
        t(outcome.relayExecutionReverted ? "revocationClearedAfterRevert" : "revocationConfirmed")
      );
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
          onClick={() => void check("activate")}
        >
          {busy ? t("checking") : t("review")}
        </button>
      )}
      {delegation === "calibur" && (
        <>
          <p>{t("alreadyActive")}</p>
          <button
            className="ui-button ui-button--secondary"
            type="button"
            disabled={busy || !ready}
            onClick={() => void check("revoke")}
          >
            {busy ? t("checking") : t("reviewRevocation")}
          </button>
        </>
      )}
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
          {activeReview.action === "revoke" && <p>{t("revocationWarning")}</p>}
          <p>
            {t("delegate", {
              address:
                activeReview.action === "revoke" ? activeReview.quote.delegate : ROBINHOOD_CALIBUR,
            })}
          </p>
          <p>{t("relayer", { address: activeReview.quote.relayer })}</p>
          <p>
            {t("funding", {
              amount: formatEther(activeReview.quote.fundingAmount),
              balance: formatEther(activeReview.quote.existingBalance),
            })}
          </p>
          <p>
            {t(activeReview.action === "revoke" ? "maximumRemovalFee" : "maximumFee", {
              amount: formatEther(activeReview.quote.maximumActivationFee),
            })}
          </p>
          <button
            className="ui-button ui-button--primary"
            type="button"
            disabled={busy}
            onClick={() => void (activeReview.action === "revoke" ? revoke() : activate())}
          >
            {busy
              ? t(activeReview.action === "revoke" ? "revoking" : "activating")
              : t(activeReview.action === "revoke" ? "fundAndRevoke" : "fundAndSign")}
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
      {result?.action === "activate" && (
        <p role="status">
          {t("result", {
            activation: result.value.activationHash,
            refund: result.value.refundHash ?? t("notConfirmed"),
            balance: formatEther(result.value.remainingBalance),
          })}
        </p>
      )}
      {result?.action === "revoke" && (
        <p role="status">
          {t("revocationResult", {
            removal: result.value.revocationHash,
            refund: result.value.refundHash ?? t("notConfirmed"),
            balance: formatEther(result.value.remainingBalance),
          })}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
