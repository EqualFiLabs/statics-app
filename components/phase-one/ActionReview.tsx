"use client";
import { useTranslations } from "next-intl";
import type { usePhaseOneAction } from "@/hooks/usePhaseOneAction";
import { ReviewDrawer } from "@/components/rewards/ReviewDrawer";
import styles from "./action-review.module.css";

/**
 * Connection prompts and errors render in place; a prepared review opens as a modal closed by its
 * close icon. Inside an existing dialog (`inline`) the review renders in place instead of stacking a
 * second modal, and that dialog's own close control cancels it. Neither has a Cancel button.
 */
export function ActionReview({
  action,
  inline = false,
}: {
  action: ReturnType<typeof usePhaseOneAction>;
  /** True inside a dialog whose own close control already cancels the review. */
  inline?: boolean;
}) {
  const t = useTranslations("phaseOne");
  const inDialog = inline;
  const review = action.review;
  const details = review && (
    <>
      <ul>
        {review.details.map((detail, index) => (
          <li key={index}>{detail}</li>
        ))}
      </ul>
      {!inDialog && action.error && (
        <p className="dapp-inline-error" role="alert">
          {action.error}
        </p>
      )}
      <button
        className="dollar-submit"
        type="button"
        disabled={action.busy || !action.ready}
        onClick={() => void action.confirm()}
      >
        {action.busy ? t("waiting") : t("confirm")}
      </button>
    </>
  );
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
      {action.error && (inDialog || !review) && (
        <p className="dapp-inline-error" role="alert">
          {action.error}
        </p>
      )}
      {review &&
        (inDialog ? (
          <section className="position-panel" aria-label={t("review")}>
            <h3>{review.label}</h3>
            {details}
          </section>
        ) : (
          <ReviewDrawer
            title={review.label}
            variant="modal"
            busy={action.busy}
            onClose={action.cancel}
          >
            <div className={styles.review}>{details}</div>
          </ReviewDrawer>
        ))}
    </>
  );
}
