"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatEther, formatUnits, parseEventLogs } from "viem";
import {
  buildCreatePositionCall,
  buildClosePositionCall,
  staticsAbi,
} from "@statics-protocol/sdk/phase-one";
import { AddressDisplay } from "@/components/protocol/AddressDisplay";
import { ActionReview } from "@/components/phase-one/ActionReview";
import { usePhaseOneAction } from "@/hooks/usePhaseOneAction";
import { usePhaseOnePositions } from "@/hooks/usePhaseOnePositions";
import { loadIndexedPhaseOnePosition } from "@/lib/indexer/phase-one";
import type { PhaseOneDeployment } from "@/lib/deployments/types";

export function PhaseOnePositions({ deployment }: { deployment: PhaseOneDeployment }) {
  const t = useTranslations("positions");
  const p = useTranslations("phaseOne");
  const action = usePhaseOneAction(deployment);
  const [createdId, setCreatedId] = useState<bigint | null>(null);
  const positions = usePhaseOnePositions(deployment.descriptor.deploymentId, action.wallet);
  const fee = useQuery({
    queryKey: ["phase-one-creation-fee", deployment.descriptor.deploymentId],
    enabled: action.ready,
    staleTime: 60_000,
    queryFn: () =>
      action.publicClient!.readContract({
        address: deployment.contracts.diamond,
        abi: staticsAbi,
        functionName: "positionCreationFee",
      }),
  });
  const create = () =>
    action.prepare(async () => {
      if (!action.publicClient || !action.wallet) throw new Error(p("connect"));
      const creationFee = await action.publicClient.readContract({
        address: deployment.contracts.diamond,
        abi: staticsAbi,
        functionName: "positionCreationFee",
      });
      return {
        label: t("create"),
        details: [t("creationFee", { fee: formatEther(creationFee) })],
        execute: async () => {
          await action.send({
            kind: "phase-one-create-position",
            label: t("create"),
            amount: `${formatEther(creationFee)} ETH`,
            to: deployment.contracts.diamond,
            data: buildCreatePositionCall(action.wallet!),
            value: creationFee,
            verifyConfirmation: async (receipt) => {
              const event = parseEventLogs({
                abi: staticsAbi,
                logs: receipt.logs,
                eventName: "PositionCreated",
              }).find(
                (entry) =>
                  entry.address.toLowerCase() === deployment.contracts.diamond.toLowerCase()
              );
              if (event) setCreatedId(event.args.positionId);
            },
          });
        },
      };
    });
  return (
    <section className="position-catalog" aria-labelledby="position-catalog-title">
      <div className="position-section-heading">
        <div>
          <p className="dapp-section-label">{t("subject")}</p>
          <h2 id="position-catalog-title">{t("title")}</h2>
          <p>{p("createDescription")}</p>
          {fee.data !== undefined && (
            <small>{t("creationFee", { fee: formatEther(fee.data) })}</small>
          )}
        </div>
        <button
          className="dollar-submit"
          type="button"
          disabled={!action.ready || action.busy}
          onClick={() => void create()}
        >
          {action.busy ? t("creating") : t("create")}
        </button>
      </div>
      <ActionReview action={action} />
      {positions.isError && <p role="alert">{String(positions.error.message)}</p>}
      {createdId !== null && !positions.items.some((item) => item.positionId === createdId) && (
        <Link className="position-card-link" href={`/app/positions/${createdId}`}>
          {t("positionNumber", { id: String(createdId) })} →
        </Link>
      )}
      {positions.data && positions.items.length === 0 && <p>{p("empty")}</p>}
      <div className="position-grid">
        {positions.items.map((position) => (
          <article className="position-card" key={String(position.positionId)}>
            <div>
              <Link href={`/app/positions/${position.positionId}`}>
                {t("positionNumber", { id: String(position.positionId) })}
              </Link>
              <span>{t("activeLegs", { count: String(position.activeLegCount) })}</span>
            </div>
            <AddressDisplay
              address={position.owner}
              chainId={deployment.descriptor.chainId}
              label={t("owner")}
            />
            <dl>
              <div>
                <dt>{t("globalStake")}</dt>
                <dd>{formatUnits(position.stakedBalance, 18)} STATICS</dd>
              </div>
            </dl>
            <Link className="position-card-link" href={`/app/positions/${position.positionId}`}>
              {t("manage")} →
            </Link>
          </article>
        ))}
      </div>
      {positions.hasNextPage && (
        <button
          type="button"
          disabled={positions.isFetchingNextPage}
          onClick={() => void positions.fetchNextPage()}
        >
          {p("loadMore")}
        </button>
      )}
    </section>
  );
}

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
          kind: "close-position",
          label: t("closePosition"),
          amount: `Position #${positionId}`,
          to: deployment.contracts.diamond,
          data: buildClosePositionCall(positionId),
        });
      },
    }));
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
            <Link className="position-card-link" href={`/app/rewards?positionId=${positionId}`}>
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
