"use client";
import { useQuery } from "@tanstack/react-query";
import { useAppLocale } from "@/i18n/client";
import { useTranslations } from "next-intl";
import { staticsRangeGaugeAbi, staticsGaugeIncentivesAbi } from "@statics-protocol/sdk/phase-one";
import type { Hex } from "viem";
import { usePhaseOneAction } from "@/hooks/usePhaseOneAction";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import { RewardAmounts } from "./RewardAmounts";
import styles from "./earn.module.css";
export function BribeSchedule({
  deployment,
  poolId,
  share,
}: {
  deployment: PhaseOneDeployment;
  poolId: Hex;
  share: "lp" | "allocator";
}) {
  const locale = useAppLocale(),
    t = useTranslations("earnUx"),
    action = usePhaseOneAction(deployment);
  const streams = useQuery({
    queryKey: [
      "phase-one-gauges",
      deployment.descriptor.deploymentId,
      action.wallet,
      "funding",
      poolId,
      share,
    ],
    enabled: action.ready,
    staleTime: 30_000,
    retry: false,
    queryFn: async () => {
      const client = action.publicClient!,
        address = deployment.contracts.diamond;
      const config = await client.readContract({
        address,
        abi: staticsRangeGaugeAbi,
        functionName: "poolRewardConfig",
        args: [poolId],
      });
      return Promise.all(
        Array.from({ length: Math.max(0, config.slotCount - 1) }, (_, index) => index + 1).map(
          async (slot) => {
            const stream =
              share === "lp"
                ? await client.readContract({
                    address,
                    abi: staticsRangeGaugeAbi,
                    functionName: "poolRewardStream",
                    args: [poolId, slot],
                  })
                : await client.readContract({
                    address,
                    abi: staticsGaugeIncentivesAbi,
                    functionName: "gaugeAllocatorReward",
                    args: [poolId, slot],
                  });
            return {
              asset: stream.asset,
              budget: stream.periodBudget,
              emitted: stream.periodEmitted,
              start: stream.periodStart,
              finish: stream.periodFinish,
            };
          }
        )
      );
    },
  });
  return (
    <section aria-label={t("funding")} className={styles.breakdown}>
      {streams.isError ? (
        <p>{t("unavailable")}</p>
      ) : !streams.data ? (
        <p>{t("loading")}</p>
      ) : streams.data.length ? (
        streams.data.map((stream, index) => (
          <div className={styles.row} key={index}>
            <p>{t("funded")}</p>
            <RewardAmounts
              deployment={deployment}
              includeZero
              amounts={[{ asset: stream.asset, amount: stream.budget }]}
            />
            <p className={styles.muted}>{t("emitted")}</p>
            <RewardAmounts
              deployment={deployment}
              includeZero
              amounts={[{ asset: stream.asset, amount: stream.emitted }]}
            />
            <p className={styles.muted}>
              {t("schedule", {
                start: new Date(stream.start * 1000).toLocaleString(locale),
                finish: new Date(stream.finish * 1000).toLocaleString(locale),
              })}
            </p>
          </div>
        ))
      ) : (
        <p>{t("noFunding")}</p>
      )}
    </section>
  );
}
