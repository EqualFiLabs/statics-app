"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { erc20Abi, formatEther, formatUnits, getAddress, parseEventLogs, type Address } from "viem";
import { staticsAbi, staticsGaugeIncentivesAbi } from "@statics-protocol/sdk/phase-one";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import type { IndexedPhaseOnePosition } from "@/lib/indexer/phase-one";
import {
  buildCreateAndStakeTransaction,
  buildPositionStakingTransaction,
  buildStaticsStakeApproval,
} from "@/lib/phase-one/staking";
import { parseLocalizedUnits } from "@/lib/i18n/amounts";
import { earnHref, rewardDisplay } from "@/lib/rewards/earn";
import { earnPositionStatus, type EarnPositionRow } from "@/lib/rewards/position-table";
import {
  defaultStakeTarget,
  previewStake,
  previewUnstake,
  roundedEligibility,
  unstakeAvailable,
  type StakePreview,
} from "@/lib/rewards/stake-preview";
import { formatDuration } from "@/lib/rewards/time";
import { waitForIndexedPosition } from "@/lib/rewards/indexed-position";
import { useAppLocale } from "@/i18n/client";
import { useEarnPositionTable } from "@/hooks/useEarnPositionTable";
import type { usePhaseOneAction } from "@/hooks/usePhaseOneAction";
import { ActionReview } from "@/components/phase-one/ActionReview";
import { ReviewDrawer } from "./ReviewDrawer";
import { RewardAssetModal, type RewardAssetOption } from "./RewardAssetModal";
import styles from "./earn.module.css";

const PICKER_PAGE = 5;

export function EarnStakeForm({
  deployment,
  action,
  positions,
  requestedPositionId,
}: {
  deployment: PhaseOneDeployment;
  action: ReturnType<typeof usePhaseOneAction>;
  positions: readonly IndexedPhaseOnePosition[];
  requestedPositionId?: bigint;
}) {
  const t = useTranslations("earnStake");
  const locale = useAppLocale();
  const queryClient = useQueryClient();
  const id = deployment.descriptor.deploymentId;
  const [mode, setMode] = useState<"stake" | "unstake">("stake");
  const [amountInput, setAmountInput] = useState("");
  const [targetChoice, setTargetChoice] = useState<string | null>(null);
  const [pageChoice, setPageChoice] = useState<number | null>(null);
  /** Position ID, or "new", whose reward-asset modal is open. */
  const [assetsFor, setAssetsFor] = useState<string | null>(null);
  /** Which kind of review the shared drawer is showing. */
  const [reviewKind, setReviewKind] = useState<"stake" | "create" | "assets">("stake");
  const [newAssets, setNewAssets] = useState<readonly Address[] | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // The wallet balance is read on its own so a failed rule read never hides it (or Max).
  const balance = useQuery({
    queryKey: [
      "earn-wallet-balance",
      id,
      deployment.descriptor.chainId,
      action.wallet,
      deployment.contracts.statics,
    ],
    enabled: action.ready,
    staleTime: 30_000,
    retry: false,
    queryFn: () =>
      action.publicClient!.readContract({
        address: deployment.contracts.statics,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [action.wallet!],
      }),
  });
  const params = useQuery({
    queryKey: ["phase-one-position", id, action.wallet, "stake-rules"],
    enabled: action.ready,
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      const client = action.publicClient!,
        diamond = deployment.contracts.diamond;
      const [creationFee, cooldown, eligibilityDelay, eligibilityBucketSize, maximumRewardAssets] =
        await Promise.all([
          client.readContract({
            address: diamond,
            abi: staticsAbi,
            functionName: "positionCreationFee",
          }),
          client.readContract({
            address: diamond,
            abi: staticsGaugeIncentivesAbi,
            functionName: "gaugeAllocationCooldown",
          }),
          client.readContract({
            address: diamond,
            abi: staticsAbi,
            functionName: "rewardEligibilityDelay",
          }),
          client.readContract({
            address: diamond,
            abi: staticsAbi,
            functionName: "rewardEligibilityBucketSize",
          }),
          client.readContract({
            address: diamond,
            abi: staticsAbi,
            functionName: "maxRewardAssetsPerPosition",
          }),
        ]);
      return {
        creationFee,
        cooldown: BigInt(cooldown),
        eligibilityDelay: BigInt(eligibilityDelay),
        eligibilityBucketSize: BigInt(eligibilityBucketSize),
        maximumRewardAssets,
      };
    },
  });

  // Positions are paged five at a time, largest stake first. Only the visible page, the
  // selected position and the largest position are read on-chain.
  const sorted = [...positions].sort((a, b) =>
    a.stakedBalance === b.stakedBalance
      ? a.positionId < b.positionId
        ? -1
        : 1
      : a.stakedBalance > b.stakedBalance
        ? -1
        : 1
  );
  const largestIndexed = sorted[0] ?? null;
  const target = targetChoice ?? defaultStakeTarget(positions, requestedPositionId);
  // Unstaking needs an existing position; fall back to the largest one.
  const effectiveTarget =
    mode === "unstake" && target === "new" && largestIndexed
      ? String(largestIndexed.positionId)
      : target;
  const targetIndex = sorted.findIndex(
    (position) => String(position.positionId) === effectiveTarget
  );
  const pageCount = Math.max(1, Math.ceil(sorted.length / PICKER_PAGE));
  const page = Math.min(
    pageChoice ?? (targetIndex >= 0 ? Math.floor(targetIndex / PICKER_PAGE) : 0),
    pageCount - 1
  );
  const pagePositions = sorted.slice(page * PICKER_PAGE, (page + 1) * PICKER_PAGE);
  const pinned =
    targetIndex >= 0 && !pagePositions.includes(sorted[targetIndex]) ? sorted[targetIndex] : null;
  const detailPositions = [
    ...new Set([
      ...pagePositions,
      ...(pinned ? [pinned] : []),
      ...(largestIndexed ? [largestIndexed] : []),
    ]),
  ];
  const { rows, now } = useEarnPositionTable(deployment, action, detailPositions);
  const rowOf = (positionId: bigint) => rows.find((row) => row.positionId === positionId);
  const targetRow = rows.find((row) => String(row.positionId) === effectiveTarget) ?? null;
  const chosenNewAssets =
    newAssets ??
    (largestIndexed ? rowOf(largestIndexed.positionId)?.selectedAssets : undefined) ??
    [];
  const shortAddress = (asset: Address) => `${asset.slice(0, 6)}…${asset.slice(-4)}`;
  const knownTokens: RewardAssetOption[] = [
    ...new Map(
      [
        { address: deployment.contracts.statics, symbol: "STATICS", name: "Statics" },
        ...deployment.supportedPools.flatMap((pool) => [pool.token0, pool.token1]),
      ].map((token) => [
        token.address.toLowerCase(),
        { address: token.address, symbol: token.symbol, name: token.name },
      ])
    ).values(),
  ];
  // Every known token, plus anything the position already holds that the manifest lacks.
  const assetOptions = (held: readonly Address[]): RewardAssetOption[] => [
    ...knownTokens,
    ...held
      .filter(
        (asset) => !knownTokens.some((token) => token.address.toLowerCase() === asset.toLowerCase())
      )
      .map((address) => ({ address, symbol: shortAddress(address), name: t("unknownToken") })),
  ];
  const symbolOf = (asset: Address) =>
    knownTokens.find((token) => token.address.toLowerCase() === asset.toLowerCase())?.symbol ??
    shortAddress(asset);

  let amount: bigint | null = null;
  try {
    amount = amountInput.trim() ? parseLocalizedUnits(amountInput, 18, locale) : null;
  } catch {
    amount = null;
  }
  const available =
    mode === "stake"
      ? balance.data
      : targetRow?.allocation
        ? unstakeAvailable(targetRow)
        : undefined;
  // No preview (and so no review) until the chain clock is known.
  const rules =
    params.data && now !== undefined
      ? {
          now,
          eligibilityDelay: params.data.eligibilityDelay,
          eligibilityBucketSize: params.data.eligibilityBucketSize,
          allocationCooldown: params.data.cooldown,
        }
      : null;
  const preview: StakePreview | null =
    amount && amount > 0n && rules
      ? mode === "stake"
        ? previewStake({ amount, target: targetRow, newAssetCount: chosenNewAssets.length }, rules)
        : targetRow
          ? previewUnstake({ amount, target: targetRow })
          : null
      : null;
  const amountError = !amountInput.trim()
    ? null
    : amount === null
      ? t("invalidAmount")
      : amount <= 0n
        ? t("positiveAmount")
        : mode === "stake" && available !== undefined && amount > available
          ? t("insufficientBalance")
          : preview?.kind === "unstake" && preview.exceedsAvailable
            ? t("exceedsAvailable")
            : null;
  const assetLimitExceeded =
    mode === "stake" &&
    effectiveTarget === "new" &&
    params.data !== undefined &&
    BigInt(chosenNewAssets.length) > params.data.maximumRewardAssets;
  const canReview =
    action.ready &&
    !action.busy &&
    Boolean(preview) &&
    available !== undefined &&
    amount !== null &&
    amount > 0n &&
    !amountError &&
    !assetLimitExceeded &&
    (effectiveTarget === "new"
      ? mode === "stake" &&
        (!largestIndexed ||
          newAssets !== null ||
          Boolean(rowOf(largestIndexed.positionId)?.selectedAssets))
      : Boolean(
          targetRow &&
          !targetRow.unavailable &&
          targetRow.allocation &&
          targetRow.selectedAssets &&
          targetRow.rewardSelections
        ));

  const statics = (value: bigint) => rewardDisplay(value, 18).display;
  const at = (seconds: bigint) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(Number(seconds) * 1000)
    );
  const previewLines = (value: StakePreview): string[] => {
    if (value.kind === "create")
      return [
        t("preview.create", { fee: formatEther(params.data?.creationFee ?? 0n) }),
        value.assetCount
          ? t("preview.newEarning", { count: value.assetCount, time: at(value.earningFrom) })
          : t("preview.noAssetsNew"),
        ...(value.cooldownUntil
          ? [t("preview.newCooldown", { time: at(value.cooldownUntil) })]
          : []),
      ];
    if (value.kind === "stake")
      return [
        t("preview.total", { id: String(value.positionId), amount: statics(value.total) }),
        ...(value.assetCount
          ? value.earning.map((entry) =>
              t(entry.pendingStake > 0n ? "preview.pendingEarning" : "preview.assetEarning", {
                symbol: symbolOf(entry.asset),
                time:
                  entry.earliest === entry.latest
                    ? at(entry.earliest)
                    : `${at(entry.earliest)} – ${at(entry.latest)}`,
              })
            )
          : [t("preview.noAssets", { id: String(value.positionId) })]),
        ...(value.cooldownUntil
          ? [t("preview.cooldown", { id: String(value.positionId), time: at(value.cooldownUntil) })]
          : []),
      ];
    return [
      t("preview.remaining", { id: String(value.positionId), amount: statics(value.remaining) }),
      ...(value.assets.length
        ? value.assets.map((entry) =>
            t("preview.unstakeAsset", {
              symbol: symbolOf(entry.asset),
              maturing: statics(entry.fromMaturing),
              earning: statics(entry.fromEarning),
            })
          )
        : [t("preview.unstakeNoAssets")]),
    ];
  };

  const clearReview = () => {
    action.cancel();
    setProgress(null);
  };
  const choose = (next: string) => {
    clearReview();
    setSuccess(null);
    setTargetChoice(next);
  };
  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (query) =>
        [
          "phase-one-positions",
          "phase-one-position",
          "phase-one-rewards",
          "phase-one-gauges",
        ].includes(String(query.queryKey[0])) &&
        query.queryKey[1] === id &&
        query.queryKey.includes(action.wallet),
    });

  const review = () =>
    action.prepare(async () => {
      if (!amount || !action.publicClient || !action.wallet || !params.data || !preview)
        throw new Error(t("unavailable"));
      const value = amount;
      const reviewedFee = params.data.creationFee;
      const reviewedAssets = [...chosenNewAssets];
      const label =
        preview.kind === "create"
          ? t("label.create")
          : preview.kind === "stake"
            ? t("label.stake", { id: String(preview.positionId) })
            : t("label.unstake", { id: String(preview.positionId) });
      const details = [`${formatUnits(value, 18)} STATICS`, ...previewLines(preview)];
      return {
        label,
        details,
        execute: async () => {
          const client = action.publicClient!,
            wallet = action.wallet!;
          if (preview.kind !== "unstake") {
            const allowance = await client.readContract({
              address: deployment.contracts.statics,
              abi: erc20Abi,
              functionName: "allowance",
              args: [wallet, deployment.contracts.diamond],
            });
            const approval = buildStaticsStakeApproval({ deployment, allowance, required: value });
            if (approval.needed) {
              setProgress(t("approveInWallet"));
              await action.send({
                kind: "phase-one-approve-token",
                label: t("label.approve"),
                amount: `${formatUnits(value, 18)} STATICS`,
                to: approval.target,
                data: approval.calldata,
              });
            }
          }
          setProgress(t("confirmInWallet"));
          let createdId: bigint | null = null;
          if (preview.kind === "create") {
            const transaction = await buildCreateAndStakeTransaction({
              publicClient: client,
              deployment,
              amount: value,
              receiver: wallet,
              rewardAssets: reviewedAssets,
            });
            if (transaction.value !== reviewedFee) throw new Error(t("feeChanged"));
            await action.send({
              kind: "phase-one-create-position",
              label,
              amount: `${formatUnits(value, 18)} STATICS + ${formatEther(transaction.value)} ETH`,
              to: transaction.target,
              data: transaction.calldata,
              value: transaction.value,
              // The new Position ID is only known from the receipt.
              verifyConfirmation: async (receipt) => {
                const created = parseEventLogs({
                  abi: staticsAbi,
                  eventName: "StakingPositionCreated",
                  logs: receipt.logs,
                }).find(
                  (event) =>
                    event.address.toLowerCase() === deployment.contracts.diamond.toLowerCase() &&
                    getAddress(event.args.owner) === wallet
                );
                if (!created) throw new Error(t("creationMissing"));
                createdId = created.args.positionId;
              },
            });
          } else {
            const transaction = buildPositionStakingTransaction({
              deployment,
              positionId: preview.positionId,
              action:
                preview.kind === "stake"
                  ? { kind: "stake", amount: value }
                  : { kind: "unstake", amount: value, receiver: wallet },
            });
            await action.send({
              kind: preview.kind === "stake" ? "phase-one-stake" : "phase-one-unstake",
              label,
              amount: `${formatUnits(value, 18)} STATICS`,
              to: transaction.target,
              data: transaction.calldata,
            });
          }
          await Promise.all([refresh(), balance.refetch()]);
          let indexed = true;
          if (createdId !== null) {
            setProgress(t("waitingForIndexer"));
            indexed = await waitForIndexedPosition({
              queryClient,
              deploymentId: id,
              wallet,
              positionId: createdId,
            });
            // Select the new position so the next action targets it.
            setTargetChoice(String(createdId));
            setPageChoice(null);
          }
          setProgress(null);
          setAmountInput("");
          setSuccess(indexed ? label : t("indexerSlow", { label }));
        },
      };
    });

  const saveAssets = (positionId: bigint, next: readonly Address[]) => {
    const row = rowOf(positionId);
    const current = row?.selectedAssets ?? [];
    const has = (list: readonly Address[], asset: Address) =>
      list.some((entry) => entry.toLowerCase() === asset.toLowerCase());
    const additions = next.filter((asset) => !has(current, asset));
    const removals = current.filter((asset) => !has(next, asset));
    if (!additions.length && !removals.length) return;
    setSuccess(null);
    setReviewKind("assets");
    void action.prepare(async () => {
      const label = t("label.assets", { id: String(positionId) });
      const transactions = [
        ...(removals.length
          ? [
              buildPositionStakingTransaction({
                deployment,
                positionId,
                action: { kind: "opt-out", assets: removals },
              }),
            ]
          : []),
        ...(additions.length
          ? [
              buildPositionStakingTransaction({
                deployment,
                positionId,
                action: { kind: "opt-in", assets: additions },
              }),
            ]
          : []),
      ];
      return {
        label,
        details: [
          ...additions.map((asset) => t("assetAdded", { symbol: symbolOf(asset) })),
          ...removals.map((asset) => t("assetRemoved", { symbol: symbolOf(asset) })),
          ...(additions.length && params.data && now !== undefined
            ? [
                t("assetsEarningFrom", {
                  time: at(
                    roundedEligibility(now, {
                      now,
                      eligibilityDelay: params.data.eligibilityDelay,
                      eligibilityBucketSize: params.data.eligibilityBucketSize,
                      allocationCooldown: params.data.cooldown,
                    })
                  ),
                }),
              ]
            : []),
          ...(removals.length ? [t("assetsRemovedHelp")] : []),
          t("transactionCount", { count: transactions.length }),
        ],
        execute: async () => {
          for (const transaction of transactions) {
            setProgress(t("confirmInWallet"));
            await action.send({
              kind: "phase-one-reward-selection",
              label,
              amount: t("assetChangeAmount", {
                added: additions.length,
                removed: removals.length,
              }),
              to: transaction.target,
              data: transaction.calldata,
            });
          }
          setProgress(null);
          setSuccess(label);
          await refresh();
        },
      };
    });
  };
  const assetsButton = (key: string, count: number | undefined, max: bigint | undefined) => (
    <button
      type="button"
      className={`ui-button ui-button--secondary ui-button--sm ${styles.assetsButton}`}
      disabled={action.busy || count === undefined}
      aria-label={t("assetsFor", {
        target: key === "new" ? t("newPosition") : t("position", { id: key }),
      })}
      onClick={() => {
        clearReview();
        setAssetsFor(key);
      }}
    >
      {t("assetsButton", {
        count: count === undefined ? "…" : String(count),
        max: max === undefined ? "—" : String(max),
      })}
    </button>
  );
  const modalRow = assetsFor && assetsFor !== "new" ? rowOf(BigInt(assetsFor)) : undefined;

  return (
    <>
      <section className={`ui-card ${styles.stakeForm}`} aria-label={t("title")}>
        <div className={styles.stakeFormHeading}>
          <h2>{t("title")}</h2>
          <div className="earn-mode" role="group" aria-label={t("mode")}>
            {(["stake", "unstake"] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                className="ui-button"
                aria-pressed={mode === kind}
                disabled={action.busy}
                onClick={() => {
                  clearReview();
                  setSuccess(null);
                  setMode(kind);
                  setAmountInput("");
                }}
              >
                {t(`modes.${kind}`)}
              </button>
            ))}
          </div>
        </div>

        <label className="basket-field">
          {t("amount")}
          <div className="earn-amount-field">
            <input
              aria-label={t("amount")}
              value={amountInput}
              inputMode="decimal"
              placeholder="0"
              disabled={action.busy}
              aria-invalid={Boolean(amountError)}
              aria-describedby="earn-stake-amount-help"
              onChange={(event) => {
                clearReview();
                setSuccess(null);
                setAmountInput(event.target.value);
              }}
            />
            <button
              type="button"
              className="ui-button ui-button--ghost ui-button--sm"
              disabled={action.busy || !available}
              onClick={() => {
                clearReview();
                setAmountInput(formatUnits(available!, 18));
              }}
            >
              {t("max")}
            </button>
          </div>
        </label>
        <p id="earn-stake-amount-help" className={amountError ? "dapp-inline-error" : "earn-muted"}>
          {amountError ??
            (mode === "stake"
              ? t("walletBalance", { amount: available === undefined ? "—" : statics(available) })
              : t("availableToUnstake", {
                  amount: available === undefined ? "—" : statics(available),
                }))}
        </p>

        <fieldset className={styles.positionPicker} disabled={action.busy}>
          <legend>{mode === "stake" ? t("into") : t("from")}</legend>
          {[...(pinned ? [pinned] : []), ...pagePositions].map((position) => {
            const row: EarnPositionRow = rowOf(position.positionId) ?? {
              positionId: position.positionId,
              stakedBalance: position.stakedBalance,
              liquidityLegs: position.activeLegCount,
              unavailable: false,
            };
            const value = String(row.positionId);
            const status = earnPositionStatus(row, now);
            const cooldownLeft =
              now !== undefined && row.allocation && row.allocation.nextAllocationAt > now
                ? row.allocation.nextAllocationAt - now
                : 0n;
            const free = row.allocation ? unstakeAvailable(row) : undefined;
            return (
              <div
                key={value}
                className={styles.pickerOption}
                data-checked={effectiveTarget === value}
              >
                <label className={styles.pickerLabel}>
                  <input
                    type="radio"
                    name="earn-stake-target"
                    value={value}
                    checked={effectiveTarget === value}
                    disabled={mode === "unstake" && free === 0n}
                    onChange={() => choose(value)}
                  />
                  <span className={styles.pickerMain}>
                    <strong>
                      {t("position", { id: value })}
                      {position === pinned && (
                        <span className={styles.cellMeta}>{t("selectedElsewhere")}</span>
                      )}
                    </strong>
                    <span className={styles.cellMeta}>
                      {mode === "stake"
                        ? t("optionStake", {
                            staked: statics(row.stakedBalance),
                            assets: row.selectedAssets ? String(row.selectedAssets.length) : "…",
                            max: String(row.maximumRewardAssets ?? "—"),
                          })
                        : t("optionUnstake", {
                            available: free === undefined ? "…" : statics(free),
                            staked: statics(row.stakedBalance),
                          })}
                    </span>
                  </span>
                  {status === "earning-nothing" && (
                    <span className={styles.statusPill} data-tone="negative">
                      {t("noAssetsTag")}
                    </span>
                  )}
                  {cooldownLeft > 0n && (
                    <span className={styles.statusPill} data-tone="warning">
                      {t("cooldownTag", { time: formatDuration(cooldownLeft) })}
                    </span>
                  )}
                </label>
                {assetsButton(value, row.selectedAssets?.length, row.maximumRewardAssets)}
              </div>
            );
          })}
          {sorted.length > PICKER_PAGE && (
            <div className={styles.pickerPager}>
              <button
                type="button"
                className="ui-button ui-button--secondary ui-button--sm"
                aria-label={t("previousPage")}
                disabled={page === 0}
                onClick={() => setPageChoice(page - 1)}
              >
                ‹
              </button>
              <span className={styles.cellMeta} aria-live="polite">
                {t("pageRange", {
                  from: page * PICKER_PAGE + 1,
                  to: Math.min((page + 1) * PICKER_PAGE, sorted.length),
                  total: sorted.length,
                })}
              </span>
              <button
                type="button"
                className="ui-button ui-button--secondary ui-button--sm"
                aria-label={t("nextPage")}
                disabled={page >= pageCount - 1}
                onClick={() => setPageChoice(page + 1)}
              >
                ›
              </button>
            </div>
          )}
          {mode === "stake" && (
            <div className={styles.pickerOption} data-checked={effectiveTarget === "new"}>
              <label className={styles.pickerLabel}>
                <input
                  type="radio"
                  name="earn-stake-target"
                  value="new"
                  checked={effectiveTarget === "new"}
                  onChange={() => choose("new")}
                />
                <span className={styles.pickerMain}>
                  <strong>{t("newPosition")}</strong>
                  <span className={styles.cellMeta}>
                    {t("newPositionFee", { fee: formatEther(params.data?.creationFee ?? 0n) })}
                  </span>
                </span>
              </label>
              {assetsButton("new", chosenNewAssets.length, params.data?.maximumRewardAssets)}
            </div>
          )}
        </fieldset>

        {assetLimitExceeded && (
          <p className="dapp-inline-error">
            {t("assetLimit", { max: String(params.data?.maximumRewardAssets) })}
          </p>
        )}

        {preview && !amountError && (
          <div className={styles.stakePreview} role="status" aria-live="polite">
            <h3>{t("whatHappens")}</h3>
            <ul>
              {previewLines(preview).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {((preview.kind === "stake" && preview.assetCount === 0) ||
              (preview.kind === "create" && preview.assetCount === 0)) && (
              <button
                type="button"
                className="ui-button ui-button--ghost ui-button--sm"
                onClick={() =>
                  setAssetsFor(preview.kind === "stake" ? String(preview.positionId) : "new")
                }
              >
                {t("chooseAssets")}
              </button>
            )}
          </div>
        )}
        {preview?.kind === "unstake" && preview.exceedsAvailable && preview.locked > 0n && (
          <p className="earn-muted">
            {t("lockedHelp", { amount: statics(preview.locked) })}{" "}
            <Link href={earnHref("allocations", { positionId: preview.positionId })}>
              {t("deallocate")}
            </Link>
          </p>
        )}

        {action.review || action.busy || action.error ? (
          <ReviewDrawer
            title={action.review?.label ?? t("preparing")}
            busy={action.busy}
            onClose={clearReview}
          >
            {/* The drawer's × already cancels asset updates and position creation. */}
            <ActionReview action={action} showCancel={reviewKind === "stake"} />
            {action.busy && <p role="status">{progress ?? t("preparing")}</p>}
          </ReviewDrawer>
        ) : null}
        <button
          type="button"
          className="ui-button ui-button--primary ui-button--block"
          disabled={!canReview}
          onClick={() => {
            setSuccess(null);
            setReviewKind(preview?.kind === "create" ? "create" : "stake");
            void review();
          }}
        >
          {action.busy && !action.review ? t("preparing") : t(`review.${mode}`)}
        </button>
        {success && (
          <p role="status" className="earn-success">
            {t("confirmed", { label: success })}
          </p>
        )}
        {(params.isError || targetRow?.unavailable) && (
          <p className="dapp-inline-error" role="alert">
            {t("unavailable")}
          </p>
        )}
      </section>
      {assetsFor && (assetsFor === "new" || modalRow?.selectedAssets) && (
        <RewardAssetModal
          title={assetsFor === "new" ? t("assetsTitleNew") : t("assetsTitle", { id: assetsFor })}
          options={assetOptions(assetsFor === "new" ? chosenNewAssets : modalRow!.selectedAssets!)}
          initial={assetsFor === "new" ? chosenNewAssets : modalRow!.selectedAssets!}
          maximum={
            assetsFor === "new" ? params.data?.maximumRewardAssets : modalRow!.maximumRewardAssets
          }
          maturity={assetsFor === "new" ? undefined : modalRow!.assetMaturity}
          now={now}
          onCancel={() => setAssetsFor(null)}
          onConfirm={(assets) => {
            const key = assetsFor;
            setAssetsFor(null);
            if (key === "new") setNewAssets(assets);
            else saveAssets(BigInt(key), assets);
          }}
        />
      )}
    </>
  );
}
