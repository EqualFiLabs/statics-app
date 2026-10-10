"use client";
import { useRef, useState } from "react";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import type { PositionRewardPortfolio } from "@/lib/phase-one/reward-portfolio";
import type { usePhaseOneAction } from "@/hooks/usePhaseOneAction";
import {
  claimScopeIncomplete,
  scopeRewardAmounts,
  type RewardClaimScope,
} from "@/lib/rewards/earn";
import { BatchRewardClaim } from "./BatchRewardClaim";

/** Keeps a reviewed claim outside rows that can disappear when obligations resolve. */
export function useTableRewardClaim({
  deployment,
  action,
  rows,
  loading,
  incomplete,
  context,
}: {
  deployment: PhaseOneDeployment;
  action: ReturnType<typeof usePhaseOneAction>;
  rows: readonly PositionRewardPortfolio[];
  loading: boolean;
  incomplete: boolean;
  context: string;
}) {
  const identity = `${deployment.descriptor.deploymentId}:${deployment.descriptor.chainId}:${deployment.contracts.diamond}:${action.wallet}:${action.walletState.chainId}:${context}`;
  const sequence = useRef(0);
  type Request = {
    identity: string;
    sequence: number;
    rows: readonly PositionRewardPortfolio[];
    scope: RewardClaimScope;
    label: string;
    accessibleLabel: string;
  };
  const [state, setState] = useState<{ identity: string; request: Request | null }>({
    identity,
    request: null,
  });
  if (state.identity !== identity) setState({ identity, request: null });
  const request = state.identity === identity ? state.request : null;
  const setRequest = (request: Request | null) => setState({ identity, request });
  const collect = (
    scope: RewardClaimScope,
    label: string,
    accessibleLabel = label,
    compact = true
  ) => (
    <button
      type="button"
      className={
        compact ? "ui-button ui-button--secondary ui-button--sm" : "ui-button ui-button--primary"
      }
      aria-label={accessibleLabel}
      disabled={
        !action.ready ||
        loading ||
        incomplete ||
        claimScopeIncomplete(rows, scope) ||
        scopeRewardAmounts(rows, scope).length === 0 ||
        request?.identity === identity
      }
      onClick={() =>
        setRequest({ identity, sequence: ++sequence.current, rows, scope, label, accessibleLabel })
      }
    >
      {label}
    </button>
  );
  const review =
    request?.identity === identity ? (
      <BatchRewardClaim
        key={request.sequence}
        deployment={deployment}
        rows={request.rows}
        loading={false}
        incomplete={false}
        scope={request.scope}
        scopeKey={`${identity}:${request.sequence}`}
        label={request.label}
        accessibleLabel={request.accessibleLabel}
        autoReview
        hideTrigger
        onDismiss={() => setRequest(null)}
      />
    ) : null;
  return { collect, review };
}
