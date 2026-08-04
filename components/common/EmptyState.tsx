"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import type { SurfaceStateKind } from "@/lib/surface-state";
import { useWalletState } from "@/providers/wallet-context";

export type EmptyStateAction = Readonly<{
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}>;

export type EmptyStateProps = Readonly<{
  title: string;
  description: string;
  action?: EmptyStateAction;
  /** Rendered under the primary action for a lower-commitment alternative. */
  secondary?: Readonly<{ label: string; href: string }>;
  tone?: "neutral" | "error";
}>;

/**
 * The one empty state. Replaces the three near-identical implementations that
 * had grown across the app (.basket-empty, .position-empty, .activity-empty).
 *
 * An empty state without an action is a dead end, so `action` is what these
 * are for -- the old ones described what to do next in prose and then offered
 * no way to do it.
 */
export function EmptyState({ title, description, action, secondary, tone }: EmptyStateProps) {
  return (
    <div className={`ui-empty${tone === "error" ? " is-error" : ""}`}>
      <h3 className="ui-empty-title">{title}</h3>
      <p className="ui-empty-description">{description}</p>
      {action && (
        <div className="ui-empty-actions">
          {action.href ? (
            <Link className="ui-button ui-button--primary" href={action.href}>
              {action.label}
            </Link>
          ) : (
            <button
              className="ui-button ui-button--primary"
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
            >
              {action.label}
            </button>
          )}
          {secondary && (
            <Link className="ui-button ui-button--secondary" href={secondary.href}>
              {secondary.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export type SurfaceEmptyStateProps = Readonly<{
  state: SurfaceStateKind;
  /**
   * What this surface lists, lowercase and plural: "positions", "baskets".
   * Used for the wallet-level copy that is identical on every surface.
   */
  subject: string;
  /** Copy for the one state that genuinely means "you have nothing yet". */
  empty: EmptyStateProps;
  /** Retries the failed read. */
  onRetry?: () => void;
}>;

export type SurfaceBoundaryProps = SurfaceEmptyStateProps &
  Readonly<{
    children: React.ReactNode;
  }>;

/**
 * Maps a derived surface state onto the right message and the right action.
 *
 * The wallet-level states say the same thing everywhere, so they live here
 * rather than being rewritten (and drifting) on each page. Only the genuinely
 * empty case is surface-specific, and each page supplies that.
 */
export function SurfaceEmptyState({ state, subject, empty, onRetry }: SurfaceEmptyStateProps) {
  const wallet = useWalletState();
  const t = useTranslations("surface");

  switch (state) {
    case "unconfigured":
      return (
        <EmptyState
          tone="error"
          title={t("notConfigured")}
          description={t("notConfiguredDescription")}
        />
      );

    case "signed-out":
      return (
        <EmptyState
          title={t("signInTitle", { subject })}
          // Phrased to avoid subject-verb agreement: `subject` is sometimes a
          // mass noun ("activity"), which made "your activity are" ungrammatical.
          description={t("signInDescription")}
          action={{ label: t("signIn"), onClick: wallet.login }}
        />
      );

    case "wallet-missing":
      return (
        <EmptyState
          title={t("createWallet")}
          description={t("createWalletDescription")}
          action={{
            label: wallet.busyAction === "create" ? t("creating") : t("create"),
            onClick: () => void wallet.createWallet(),
            disabled: wallet.busyAction !== null,
          }}
        />
      );

    case "wrong-network":
      return (
        <EmptyState
          title={t("wrongNetwork")}
          description={t("wrongNetworkDescription", { network: wallet.networkName, subject })}
          action={{
            label: wallet.busyAction === "switch" ? t("switching") : t("switch"),
            onClick: () => void wallet.switchNetwork(),
            disabled: wallet.busyAction !== null,
          }}
        />
      );

    case "loading":
      return <EmptyState title={t("loading", { subject })} description={t("loadingDescription")} />;

    case "error":
      return (
        <EmptyState
          tone="error"
          title={t("error", { subject })}
          description={t("errorDescription")}
          action={onRetry ? { label: t("retry"), onClick: onRetry } : undefined}
        />
      );

    case "empty":
      return <EmptyState {...empty} />;

    default:
      return null;
  }
}

/**
 * Keeps every data surface on one runtime path. A boundary either renders the
 * real surface or the one shared explanation for why it is unavailable.
 */
export function SurfaceBoundary({
  state,
  subject,
  empty,
  onRetry,
  children,
}: SurfaceBoundaryProps) {
  if (state === "ready") return children;
  return <SurfaceEmptyState state={state} subject={subject} empty={empty} onRetry={onRetry} />;
}

export function UnconfiguredSurface({ subject }: { subject: string }) {
  const t = useTranslations("surface");
  return (
    <SurfaceEmptyState
      state="unconfigured"
      subject={subject}
      empty={{ title: t("unavailable", { subject }), description: t("noDeployment") }}
    />
  );
}
