"use client";
import { useTranslations } from "next-intl";
import type { usePhaseOneAction } from "@/hooks/usePhaseOneAction";

export function ActionReview({ action }: { action: ReturnType<typeof usePhaseOneAction> }) {
  const t = useTranslations("phaseOne");
  return (
    <>
      {!action.ready && (
        <button
          className="dollar-submit"
          type="button"
          onClick={() => {
            if (action.walletState.status === "wallet-missing")
              void action.walletState.createWallet();
            else if (action.walletState.status === "ready") void action.walletState.switchNetwork();
            else action.walletState.login();
          }}
        >
          {action.walletState.status === "ready"
            ? t("switchNetwork", { network: action.walletState.networkName })
            : t("connect")}
        </button>
      )}
      {action.error && (
        <p className="dapp-inline-error" role="alert">
          {action.error}
        </p>
      )}
      {action.review && (
        <section className="position-panel" aria-label={t("review")}>
          <h3>{action.review.label}</h3>
          <ul>
            {action.review.details.map((detail, index) => (
              <li key={index}>{detail}</li>
            ))}
          </ul>
          <button
            className="dollar-submit"
            type="button"
            disabled={action.busy || !action.ready}
            onClick={() => void action.confirm()}
          >
            {action.busy ? t("waiting") : t("confirm")}
          </button>
          <button type="button" disabled={action.busy} onClick={action.cancel}>
            {t("cancel")}
          </button>
        </section>
      )}
    </>
  );
}
