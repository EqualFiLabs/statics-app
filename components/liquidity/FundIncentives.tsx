"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { erc20Abi, formatUnits, type Hex } from "viem";
import { usePublicClient } from "wagmi";
import type { PhaseOneDeployment, PublicPoolToken } from "@/lib/deployments/types";
import { usePhaseOneAction } from "@/hooks/usePhaseOneAction";
import { ActionReview } from "@/components/phase-one/ActionReview";
import { ReviewDrawer } from "@/components/rewards/ReviewDrawer";
import {
  STATICS_REWARD_SLOT,
  creatorCalls,
  readPoolRewards,
  resolveTokens,
  type RewardSlot,
} from "@/lib/phase-one/creator";
import { formatRewardAmount } from "@/lib/protocol/ux";
import { parseLocalizedUnits } from "@/lib/i18n/amounts";
import { useAppLocale } from "@/i18n/client";
import styles from "./creator-pools.module.css";

type Pool = Readonly<{
  poolId: Hex;
  token0: PublicPoolToken;
  token1: PublicPoolToken;
  liquidityEnabled?: boolean;
}>;

/** Reward streams for one pool, with token metadata. Shared by the pool page and creator page. */
export function usePoolRewards(
  deployment: PhaseOneDeployment,
  poolId: Hex,
  known: ReadonlyMap<string, PublicPoolToken>
) {
  const client = usePublicClient({ chainId: deployment.descriptor.chainId });
  return useQuery({
    queryKey: ["phase-one-creator", deployment.descriptor.deploymentId, "rewards", poolId],
    enabled: Boolean(client),
    staleTime: 30_000,
    retry: false,
    queryFn: async () => {
      const state = await readPoolRewards(client!, deployment, poolId);
      const tokens = await resolveTokens(
        client!,
        state.rewards.map((slot) => slot.asset),
        known
      );
      return { ...state, tokens };
    },
  });
}

export function rewardDate(seconds: bigint, locale: string) {
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(
    new Date(Number(seconds) * 1000)
  );
}

/** Compact card on the pool page: what streams now, and a button anyone can use to fund. */
export function PoolIncentivesCard({
  deployment,
  pool,
  known,
}: {
  deployment: PhaseOneDeployment;
  pool: Pool;
  known: ReadonlyMap<string, PublicPoolToken>;
}) {
  const t = useTranslations("creatorPools");
  const locale = useAppLocale();
  const rewards = usePoolRewards(deployment, pool.poolId, known);
  const [open, setOpen] = useState(false);
  const streaming = rewards.data?.rewards.filter((slot) => slot.remaining > 0n) ?? [];
  const fundable =
    pool.liquidityEnabled !== false &&
    rewards.data?.fundingEnabled &&
    rewards.data.rewards.some((slot) => slot.slot !== STATICS_REWARD_SLOT);
  return (
    <section className={`ui-card ${styles.poolCard}`} aria-labelledby="pool-incentives">
      <h3 id="pool-incentives">{t("fundTitle")}</h3>
      {rewards.isLoading && <p role="status">{t("loading")}</p>}
      {rewards.error && (
        <p className="dapp-inline-error" role="alert">
          {rewards.error.message}
        </p>
      )}
      {streaming.length > 0 && (
        <dl className={styles.streamList}>
          {streaming.map((slot) => {
            const token = rewards.data!.tokens.get(slot.asset.toLowerCase());
            return (
              <div key={slot.slot}>
                <dt>
                  {token?.symbol ?? slot.asset.slice(0, 8)}
                  {slot.slot === STATICS_REWARD_SLOT && <span> · {t("protocol")}</span>}
                </dt>
                <dd>
                  {token ? formatRewardAmount(slot.remaining, token.decimals) : "—"} ·{" "}
                  {t("endsOn", { date: rewardDate(slot.periodFinish, locale) })}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
      {rewards.isSuccess && !fundable && (
        <p className={styles.muted}>
          {rewards.data.fundingEnabled && pool.liquidityEnabled !== false
            ? t("noRewardTokens")
            : t("fundingUnavailable")}
        </p>
      )}
      <button
        className="ui-button"
        type="button"
        disabled={!fundable}
        onClick={() => setOpen(true)}
      >
        {t("fundIncentives")}
      </button>
      {open && (
        <FundIncentivesDialog
          deployment={deployment}
          pool={pool}
          known={known}
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  );
}

export function FundIncentivesDialog({
  deployment,
  pool,
  known,
  initialSlot,
  onClose,
}: {
  deployment: PhaseOneDeployment;
  pool: Pool;
  known: ReadonlyMap<string, PublicPoolToken>;
  initialSlot?: number;
  onClose: () => void;
}) {
  const t = useTranslations("creatorPools");
  const locale = useAppLocale();
  const action = usePhaseOneAction(deployment, `fund:${pool.poolId}`);
  const rewards = usePoolRewards(deployment, pool.poolId, known);
  const slots = rewards.data?.rewards.filter((slot) => slot.slot !== STATICS_REWARD_SLOT) ?? [];
  const [picked, setPicked] = useState<number | undefined>(initialSlot);
  const slot: RewardSlot | undefined = slots.find((s) => s.slot === picked) ?? slots[0];
  const token = slot ? rewards.data!.tokens.get(slot.asset.toLowerCase()) : undefined;
  const [input, setInput] = useState("");
  const balance = useQuery({
    queryKey: [
      "phase-one-creator",
      deployment.descriptor.deploymentId,
      "funding-balance",
      action.wallet,
      slot?.asset,
    ],
    enabled: Boolean(action.publicClient && action.wallet && slot),
    queryFn: () =>
      action.publicClient!.readContract({
        address: slot!.asset,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [action.wallet!],
      }),
  });
  let amount: bigint | null = null;
  try {
    amount = token && input.trim() ? parseLocalizedUnits(input, token.decimals, locale) : null;
  } catch {
    amount = null;
  }
  const format = (value: bigint) =>
    token ? `${formatRewardAmount(value, token.decimals)} ${token.symbol}` : "";
  const allocators = slot && amount ? (amount * BigInt(slot.allocatorShareBps)) / 10_000n : 0n;
  const fundingEnabled = rewards.data?.fundingEnabled && pool.liquidityEnabled !== false;
  const short = amount !== null && balance.data !== undefined && amount > balance.data;
  const review = () =>
    void action.prepare(async () => {
      if (!fundingEnabled) throw new Error(t("fundingUnavailable"));
      if (!slot || !token || amount === null || amount <= 0n) throw new Error(t("enterAmount"));
      const reviewed = { slot: slot.slot, share: slot.allocatorShareBps, asset: slot.asset };
      return {
        label: t("fundReview", { symbol: token.symbol }),
        details: [
          t("fundAmount", { amount: format(amount) }),
          t("fundSplit", { lps: format(amount - allocators), allocators: format(allocators) }),
          t("scheduleNote"),
          t("approvalNote", { symbol: token.symbol }),
        ],
        execute: async () => {
          const allowance = await action.publicClient!.readContract({
            address: reviewed.asset,
            abi: erc20Abi,
            functionName: "allowance",
            args: [action.wallet!, deployment.contracts.diamond],
          });
          if (allowance < amount) {
            const approval = creatorCalls.approve(
              reviewed.asset,
              deployment.contracts.diamond,
              amount
            );
            await action.send({
              kind: "phase-one-approve-token",
              label: t("approve", { symbol: token.symbol }),
              amount: format(amount),
              ...approval,
            });
          }
          // A changed allocator share reverts instead of splitting funds differently than reviewed.
          const fund = creatorCalls.fund(
            deployment,
            pool.poolId,
            reviewed.slot,
            amount,
            0n,
            reviewed.share
          );
          await action.send({
            kind: "phase-one-fund-incentives",
            label: t("fundReview", { symbol: token.symbol }),
            amount: format(amount),
            ...fund,
          });
          onClose();
        },
      };
    });
  return (
    <ReviewDrawer title={t("fundTitle")} variant="modal" busy={action.busy} onClose={onClose}>
      <div className={styles.fund}>
        {/* The review replaces the form, so its Confirm button never falls below the fold. */}
        {action.review && (
          <button
            className={styles.back}
            type="button"
            disabled={action.busy}
            onClick={action.cancel}
          >
            ← {t("editFunding")}
          </button>
        )}
        {!action.review && (
          <>
            <p className={styles.muted}>{t("fundHelp")}</p>
            {rewards.isLoading && <p role="status">{t("loading")}</p>}
            {(rewards.error || balance.error) && (
              <p className="dapp-inline-error" role="alert">
                {(rewards.error ?? balance.error)!.message}
              </p>
            )}
            {rewards.isSuccess && !fundingEnabled && (
              <p role="status" className={styles.muted}>
                {t("fundingUnavailable")}
              </p>
            )}
            {rewards.isSuccess && slots.length === 0 && (
              <p className={styles.muted}>{t("noRewardTokens")}</p>
            )}
            {slots.length > 1 && (
              <div className={styles.segmented} role="group" aria-label={t("rewardToken")}>
                {slots.map((entry) => (
                  <button
                    key={entry.slot}
                    type="button"
                    aria-pressed={entry.slot === slot?.slot}
                    onClick={() => {
                      setPicked(entry.slot);
                      action.cancel();
                    }}
                  >
                    {rewards.data!.tokens.get(entry.asset.toLowerCase())?.symbol ??
                      entry.asset.slice(0, 8)}
                  </button>
                ))}
              </div>
            )}
            {slot && token && (
              <>
                <div className={styles.amountBox}>
                  <div>
                    <label className={styles.srOnly} htmlFor="fund-amount">
                      {t("amountLabel", { symbol: token.symbol })}
                    </label>
                    <input
                      id="fund-amount"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="0"
                      value={input}
                      onChange={(event) => {
                        setInput(event.target.value);
                        action.cancel();
                      }}
                    />
                    <span className={styles.tokenChip}>{token.symbol}</span>
                  </div>
                  <div className={styles.amountMeta}>
                    <span>
                      {balance.data !== undefined && t("balance", { amount: format(balance.data) })}
                    </span>
                    {balance.data !== undefined && balance.data > 0n && (
                      <button
                        type="button"
                        onClick={() => {
                          // Exact balance in the locale's decimal separator, so Max never rounds up.
                          const exact = formatUnits(balance.data!, token.decimals);
                          setInput(locale === "es" ? exact.replace(".", ",") : exact);
                          action.cancel();
                        }}
                      >
                        {t("max")}
                      </button>
                    )}
                  </div>
                </div>
                <dl className={styles.split}>
                  <div>
                    <dt>{t("toLps")}</dt>
                    <dd>{amount ? format(amount - allocators) : "—"}</dd>
                  </div>
                  <div>
                    <dt>{t("toAllocators", { percent: slot.allocatorShareBps / 100 })}</dt>
                    <dd>{amount ? format(allocators) : "—"}</dd>
                  </div>
                </dl>
                <p className={styles.muted}>{t("scheduleNote")}</p>
                <p className={styles.note}>{t("fundNote")}</p>
                {!action.review && (
                  <button
                    className="dollar-submit"
                    type="button"
                    disabled={
                      !fundingEnabled ||
                      amount === null ||
                      amount <= 0n ||
                      balance.data === undefined ||
                      short ||
                      action.busy ||
                      !action.ready
                    }
                    onClick={review}
                  >
                    {short
                      ? t("insufficient", { symbol: token.symbol })
                      : amount
                        ? t("reviewFunding")
                        : t("enterAmount")}
                  </button>
                )}
              </>
            )}
          </>
        )}
        <ActionReview action={action} inline />
      </div>
    </ReviewDrawer>
  );
}
