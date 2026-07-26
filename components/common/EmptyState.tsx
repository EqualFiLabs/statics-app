"use client";

import Link from "next/link";

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

/**
 * Maps a derived surface state onto the right message and the right action.
 *
 * The wallet-level states say the same thing everywhere, so they live here
 * rather than being rewritten (and drifting) on each page. Only the genuinely
 * empty case is surface-specific, and each page supplies that.
 */
export function SurfaceEmptyState({ state, subject, empty, onRetry }: SurfaceEmptyStateProps) {
  const wallet = useWalletState();

  switch (state) {
    case "signed-out":
      return (
        <EmptyState
          title={`Sign in to see your ${subject}`}
          // Phrased to avoid subject-verb agreement: `subject` is sometimes a
          // mass noun ("activity"), which made "your activity are" ungrammatical.
          description="Your Statics account is tied to your wallet. Sign in, or connect one you already have."
          action={{ label: "Sign in", onClick: wallet.login }}
        />
      );

    case "wallet-missing":
      return (
        <EmptyState
          title="Create your wallet"
          description={`You are signed in, but you do not have a wallet yet. Create one to start using Statics.`}
          action={{
            label: wallet.busyAction === "create" ? "Creating…" : "Create wallet",
            onClick: () => void wallet.createWallet(),
            disabled: wallet.busyAction !== null,
          }}
        />
      );

    case "wrong-network":
      return (
        <EmptyState
          title="You are on the wrong network"
          description={`Switch to ${wallet.networkName} to load your ${subject}.`}
          action={{
            label: wallet.busyAction === "switch" ? "Switching…" : "Switch network",
            onClick: () => void wallet.switchNetwork(),
            disabled: wallet.busyAction !== null,
          }}
        />
      );

    case "loading":
      return (
        <EmptyState
          title={`Loading your ${subject}…`}
          description="This should only take a moment."
        />
      );

    case "error":
      return (
        <EmptyState
          tone="error"
          title={`Could not load your ${subject}`}
          description="Something went wrong reading from the network. Your funds are not affected."
          action={onRetry ? { label: "Try again", onClick: onRetry } : undefined}
        />
      );

    case "empty":
      return <EmptyState {...empty} />;

    default:
      return null;
  }
}
