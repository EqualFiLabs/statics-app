"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatUnits } from "viem";
import { buildClosePositionCall } from "@statics-protocol/sdk/phase-one";
import { AddressDisplay } from "@/components/protocol/AddressDisplay";
import { ActionReview } from "@/components/phase-one/ActionReview";
import { usePhaseOneAction } from "@/hooks/usePhaseOneAction";
import { loadIndexedPhaseOnePosition } from "@/lib/indexer/phase-one";
import type { PhaseOneDeployment } from "@/lib/deployments/types";

export function PhaseOnePositionDetail({
  deployment,
  positionId,
}: {
  deployment: PhaseOneDeployment;
  positionId: bigint;
}) {
  const t = useTranslations("positionDetail");
  const p = useTranslations("phaseOne");
  const action = usePhaseOneAction(deployment, String(positionId));
  const [closed, setClosed] = useState(false);
  const position = useQuery({
    queryKey: [
      "phase-one-position",
      deployment.descriptor.deploymentId,
      action.wallet,
      String(positionId),
      "detail",
    ],
    enabled: Boolean(action.wallet),
    retry: false,
    queryFn: () => loadIndexedPhaseOnePosition(positionId, deployment.descriptor.deploymentId),
  });
  const owned = position.data?.owner.toLowerCase() === action.wallet?.toLowerCase();
  const close = () =>
    action.prepare(async () => ({
      label: t("closePosition"),
      details: [t("closeReady")],
      execute: async () => {
        await action.send({
          kind: "phase-one-close-position",
          label: t("closePosition"),
          amount: `Position #${positionId}`,
          to: deployment.contracts.diamond,
          data: buildClosePositionCall(positionId),
        });
        setClosed(true);
      },
    }));
  if (closed)
    return (
      <section className="position-panel">
        <Link href="/app/positions">← {t("allPositions")}</Link>
        <p>{p("closed")}</p>
      </section>
    );
  return (
    <div className="position-detail">
      <Link href="/app/positions">← {t("allPositions")}</Link>
      <section className="position-panel">
        <div className="position-section-heading">
          <div>
            <p className="dapp-section-label">{t("yourPosition")}</p>
            <h2>Position #{String(positionId)}</h2>
          </div>
        </div>
        {position.isError && <p role="alert">{position.error.message}</p>}
        {position.data && (
          <>
            <AddressDisplay
              address={position.data.owner}
              chainId={deployment.descriptor.chainId}
              label={t("owner")}
            />
            <dl>
              <div>
                <dt>{t("activeLegs")}</dt>
                <dd>{String(position.data.activeLegCount)}</dd>
              </div>
              <div>
                <dt>{p("staked")}</dt>
                <dd>{formatUnits(position.data.stakedBalance, 18)}</dd>
              </div>
            </dl>
          </>
        )}
        {owned && (
          <>
            <Link
              className="position-card-link"
              href={`/app/rewards/staking?positionId=${positionId}`}
            >
              {p("rewards")} →
            </Link>
            <Link className="position-card-link" href={`/app/liquidity?positionId=${positionId}`}>
              {p("liquidity")} →
            </Link>
          </>
        )}
      </section>
      <p>{p("unsupported")}</p>
      <section className="position-close">
        <div>
          <h3>{t("closePosition")}</h3>
          <p>{p("closeHelp")}</p>
        </div>
        <button
          className="dollar-submit"
          type="button"
          disabled={
            !owned ||
            !action.ready ||
            action.busy ||
            position.data?.activeLegCount !== 0n ||
            position.data?.unresolvedObligationCount !== 0n ||
            position.data?.stakedBalance !== 0n
          }
          onClick={() => void close()}
        >
          {p("close")}
        </button>
      </section>
      <ActionReview action={action} />
    </div>
  );
}
