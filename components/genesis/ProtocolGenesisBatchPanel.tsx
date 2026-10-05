"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatEther, getAddress, keccak256 } from "viem";
import { usePublicClient } from "wagmi";
import { staticsAbi, staticsTokenAbi } from "@statics-protocol/sdk";

import type { DollarDeployment } from "@/lib/dollar/deployment";
import { verifyDollarDeployment } from "@/lib/dollar/deployment";
import {
  delegationFromCode,
  delegationMatchesReview,
  planAtomicChunks,
  prepareErc7821Batch,
  submitErc7821Batch,
  type PreparedAtomicBatch,
} from "@/lib/genesis/atomic-batch";
import { ROBINHOOD_CALIBUR_CODE_HASH } from "@/lib/genesis/calibur";
import { BrowserCaliburActivationPanel } from "@/components/genesis/BrowserCaliburActivationPanel";
import {
  buildProtocolGenesisBatch,
  type ProtocolBatchAction,
  type ProtocolBatchOperator,
} from "@/lib/genesis/protocol-batch-planner";
import { rewardAssetsNeedingCheckpoint } from "@/lib/positions/staking";
import { useWalletState } from "@/providers/wallet-context";

type Operator = Readonly<{
  id: bigint;
  state: Readonly<{ tier: number; linkedPositionId: bigint }>;
}>;
type Plan = ReturnType<typeof buildProtocolGenesisBatch>;
type Reviewed = Readonly<{
  items: readonly Operator[];
  plan: Plan;
  prepared: PreparedAtomicBatch;
}>;
// Privy's delegated-EOA self-call passed live Robinhood Chain conformance.
// External wallet and wallet_sendCalls transports remain unverified.
const verifiedPublicDelegateCodeHashes: readonly `0x${string}`[] = [ROBINHOOD_CALIBUR_CODE_HASH];

function sameCalls(left: Plan, right: Plan): boolean {
  return (
    left.batch.calls.length === right.batch.calls.length &&
    left.batch.calls.every(
      (call, index) =>
        call.to === right.batch.calls[index].to &&
        call.data === right.batch.calls[index].data &&
        call.value === right.batch.calls[index].value
    )
  );
}

export function ProtocolGenesisBatchPanel({
  deployment,
  operators,
  positions,
  onConfirmed,
}: {
  deployment: DollarDeployment;
  operators: readonly Operator[];
  positions: readonly { positionId: bigint }[];
  onConfirmed: () => Promise<unknown>;
}) {
  const t = useTranslations("operators.bulk");
  const walletState = useWalletState();
  const publicClient = usePublicClient({ chainId: deployment.chainId });
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;
  const [action, setAction] = useState<ProtocolBatchAction>("activate");
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
  const [targetTier, setTargetTier] = useState(1);
  const [positionIds, setPositionIds] = useState<Record<string, string>>({});
  const [reviewed, setReviewed] = useState<readonly Reviewed[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedHashes, setConfirmedHashes] = useState<readonly string[]>([]);
  const [confirmedIds, setConfirmedIds] = useState<readonly bigint[]>([]);
  if (!wallet || !deployment.genesis || operators.length < 2) return null;
  if (
    deployment.source !== "development-environment" &&
    (deployment.chainId !== 4663 || walletState.walletKind !== "embedded")
  ) {
    return (
      <section className="ui-card genesis-panel" aria-label={t("title")}>
        <div className="genesis-panel-head">
          <h3>{t("title")}</h3>
          <p>{t("pendingVerification")}</p>
        </div>
        <p className="genesis-note">{t("unsupported")}</p>
      </section>
    );
  }

  const selected = operators.filter((operator) => selectedIds.includes(operator.id.toString()));
  const allowedTargets = [deployment.contracts.diamond, deployment.genesis.token];

  const makePlan = async (group: readonly Operator[]): Promise<Plan> => {
    if (!publicClient) throw new Error("The deployment RPC is unavailable.");
    await verifyDollarDeployment(publicClient, deployment);
    const fresh: ProtocolBatchOperator[] = await Promise.all(
      group.map(async (operator) => {
        const state = await publicClient.readContract({
          address: deployment.contracts.diamond,
          abi: staticsAbi,
          functionName: "genesisState",
          args: [operator.id],
        });
        return {
          id: operator.id,
          tier: Number(state.tier),
          linkedPositionId: state.linkedPositionId,
          targetTier,
          positionId: positionIds[operator.id.toString()]
            ? BigInt(positionIds[operator.id.toString()])
            : undefined,
        };
      })
    );
    const checkpointPositions = fresh
      .map((operator) => (action === "link" ? operator.positionId : operator.linkedPositionId))
      .filter((positionId): positionId is bigint => Boolean(positionId && positionId > 0n));
    const rewardAssetLists = await Promise.all(
      [...new Set(checkpointPositions.map(String))].map((id) =>
        publicClient.readContract({
          address: deployment.contracts.diamond,
          abi: staticsAbi,
          functionName: "positionRewardAssets",
          args: [BigInt(id)],
        })
      )
    );
    const rewardAssetsToCheckpoint = await rewardAssetsNeedingCheckpoint(publicClient, deployment, [
      ...new Set(rewardAssetLists.flat()),
    ]);
    const costs =
      action === "activate"
        ? await Promise.all(
            [1, 2, 3, 4].map((tier) =>
              publicClient.readContract({
                address: deployment.contracts.diamond,
                abi: staticsAbi,
                functionName: "genesisActivationCost",
                args: [tier],
              })
            )
          )
        : undefined;
    const [balance, allowance] =
      action === "activate"
        ? await Promise.all([
            publicClient.readContract({
              address: deployment.genesis!.token,
              abi: staticsTokenAbi,
              functionName: "balanceOf",
              args: [wallet],
            }),
            publicClient.readContract({
              address: deployment.genesis!.token,
              abi: staticsTokenAbi,
              functionName: "allowance",
              args: [wallet, deployment.contracts.diamond],
            }),
          ])
        : [undefined, undefined];
    return buildProtocolGenesisBatch({
      deployment,
      action,
      operators: fresh,
      costs,
      balance,
      allowance,
      rewardAssetsToCheckpoint,
    });
  };

  const prepare = async (plan: Plan): Promise<PreparedAtomicBatch> => {
    if (!publicClient) throw new Error("The deployment RPC is unavailable.");
    const code = await publicClient.getCode({ address: wallet });
    const delegate = delegationFromCode(code);
    const delegateCode = delegate ? await publicClient.getCode({ address: delegate }) : undefined;
    const verified =
      deployment.source === "development-environment" && delegateCode
        ? [keccak256(delegateCode)]
        : verifiedPublicDelegateCodeHashes;
    return prepareErc7821Batch({
      publicClient,
      wallet,
      batch: plan.batch,
      allowedTargets,
      verifiedDelegateCodeHashes: verified,
    });
  };

  const review = async () => {
    setBusy(true);
    setError(null);
    setReviewed(null);
    setConfirmedHashes([]);
    setConfirmedIds([]);
    try {
      if (!walletState.isTargetChain) {
        await walletState.switchNetwork();
        throw new Error("Review again after switching networks.");
      }
      await makePlan(selected);
      const chunks = await planAtomicChunks({
        items: selected,
        prepare: async (group) => {
          const plan = await makePlan(group);
          return { plan, prepared: await prepare(plan) };
        },
      });
      setReviewed(chunks.map((chunk) => ({ items: chunk.items, ...chunk.prepared })));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!reviewed || !publicClient) return;
    setBusy(true);
    setError(null);
    try {
      if (!walletState.isTargetChain) throw new Error("Switch back to the Operator network.");
      for (const chunk of reviewed) {
        const plan = await makePlan(chunk.items);
        if (!sameCalls(chunk.plan, plan)) {
          throw new Error("Operator state changed. Review the remaining chunks again.");
        }
        const prepared = await prepare(plan);
        if (!delegationMatchesReview(chunk.prepared, prepared)) {
          throw new Error("Wallet delegation changed. Review the remaining chunks again.");
        }
        const hash = await submitErc7821Batch({
          publicClient,
          wallet,
          chainId: deployment.chainId,
          prepared,
          batch: plan.batch,
          sendTransaction: walletState.sendEvmTransaction,
        });
        setConfirmedHashes((hashes) => [...hashes, hash]);
        setConfirmedIds((ids) => [...ids, ...chunk.items.map((operator) => operator.id)]);
        setSelectedIds((ids) =>
          ids.filter((id) => !chunk.items.some((done) => done.id.toString() === id))
        );
        await onConfirmed();
      }
      setReviewed(null);
    } catch (cause) {
      setReviewed(null);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ui-card genesis-panel" aria-label={t("title")}>
      <div className="genesis-panel-head">
        <h3>{t("title")}</h3>
        <p>{t("protocolDescription")}</p>
      </div>
      {deployment.source !== "development-environment" && <BrowserCaliburActivationPanel />}
      <label className="ui-field">
        {t("action")}
        <select
          value={action}
          disabled={busy}
          onChange={(event) => {
            setAction(event.target.value as ProtocolBatchAction);
            setSelectedIds([]);
            setReviewed(null);
          }}
        >
          <option value="activate">{t("activate")}</option>
          <option value="link">{t("link")}</option>
          <option value="unlink">{t("unlink")}</option>
        </select>
      </label>
      {action === "activate" && (
        <label className="ui-field">
          {t("targetTier")}
          <select
            value={targetTier}
            disabled={busy}
            onChange={(event) => {
              setTargetTier(Number(event.target.value));
              setReviewed(null);
            }}
          >
            {[1, 2, 3, 4].map((tier) => (
              <option key={tier} value={tier}>
                {t("tier", { tier })}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="genesis-batch-selection">
        {operators.map((operator) => {
          const key = operator.id.toString();
          const available =
            action === "activate"
              ? operator.state.tier < targetTier
              : action === "link"
                ? operator.state.tier > 0 && operator.state.linkedPositionId === 0n
                : operator.state.linkedPositionId > 0n;
          return (
            <div key={key}>
              <label>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(key)}
                  disabled={busy || !available}
                  onChange={(event) => {
                    setSelectedIds((ids) =>
                      event.target.checked ? [...ids, key] : ids.filter((id) => id !== key)
                    );
                    setReviewed(null);
                  }}
                />
                {t("operator", { id: key })}
              </label>
              {action === "link" && selectedIds.includes(key) && (
                <select
                  aria-label={t("positionFor", { id: key })}
                  value={positionIds[key] ?? ""}
                  disabled={busy}
                  onChange={(event) => {
                    setPositionIds((ids) => ({ ...ids, [key]: event.target.value }));
                    setReviewed(null);
                  }}
                >
                  <option value="">{t("choosePosition")}</option>
                  {positions.map((position) => (
                    <option
                      key={position.positionId.toString()}
                      value={position.positionId.toString()}
                    >
                      {t("position", { id: position.positionId.toString() })}
                    </option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>
      <button
        className="ui-button ui-button--secondary"
        type="button"
        disabled={busy || selected.length < 2}
        onClick={() => void review()}
      >
        {busy ? t("checking") : t("review")}
      </button>
      {reviewed && (
        <div className="genesis-batch-review" role="status">
          <p>
            {t("summary", {
              operators: reviewed.reduce((sum, chunk) => sum + chunk.items.length, 0),
              calls: reviewed.reduce((sum, chunk) => sum + chunk.plan.batch.calls.length, 0),
            })}
          </p>
          <p>{t("chunks", { count: reviewed.length })}</p>
          {reviewed.some((chunk) => chunk.plan.tokenAmount > 0n) && (
            <p>
              {t("required", {
                amount: formatEther(
                  reviewed.reduce((sum, chunk) => sum + chunk.plan.tokenAmount, 0n)
                ),
              })}
            </p>
          )}
          {reviewed.some((chunk) => chunk.plan.approvalAmount > 0n) && (
            <p>
              {t("temporaryApproval", {
                amount: formatEther(
                  reviewed.reduce((sum, chunk) => sum + chunk.plan.approvalAmount, 0n)
                ),
              })}
            </p>
          )}
          {reviewed.map((chunk, chunkIndex) => (
            <div key={chunkIndex}>
              <p>
                {t("chunk", { number: chunkIndex + 1, count: reviewed.length })} ·{" "}
                {t("estimatedGas", { amount: chunk.prepared.gasLimit.toString() })}
              </p>
              <ol>
                {chunk.plan.batch.labels.map((label, index) => (
                  <li key={`${label}-${index}`}>{label}</li>
                ))}
              </ol>
            </div>
          ))}
          <button
            className="ui-button ui-button--primary"
            type="button"
            disabled={busy}
            onClick={() => void submit()}
          >
            {t("confirm")}
          </button>
        </div>
      )}
      {confirmedHashes.map((hash) => (
        <p key={hash} role="status">
          {t("confirmed", { hash })}
        </p>
      ))}
      {confirmedIds.length > 0 && (
        <ul>
          {confirmedIds.map((id) => (
            <li key={id.toString()}>{t("operatorConfirmed", { id: id.toString() })}</li>
          ))}
        </ul>
      )}
      {error && (
        <p className="dapp-inline-error" role="alert">
          {error}
        </p>
      )}
      <p className="genesis-note">{t("unsupported")}</p>
    </section>
  );
}
