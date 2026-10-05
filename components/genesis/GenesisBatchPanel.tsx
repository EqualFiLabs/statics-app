"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  formatEther,
  getAddress,
  keccak256,
  parseEther,
  type Address,
  type PublicClient,
} from "viem";
import { usePublicClient } from "wagmi";
import {
  dopplerStaticsTokenAbi,
  genesisActivationRegistryAbi,
  genesisLaunchDistributorAbi,
  staticsGenesisAbi,
} from "@statics-protocol/sdk";
import { staticsGenesisCreditAbi } from "@statics-protocol/sdk/genesis-credit";

import type { LaunchDeployment } from "@/lib/deployments/types";
import { verifyLaunchDeployment } from "@/lib/deployments/verify-launch";
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
import type { OwnedGenesis } from "@/lib/genesis/owned";
import {
  buildLaunchBatchPreview,
  type LaunchBatchAction,
  type LaunchBatchPreview,
} from "@/lib/genesis/launch-batch-planner";
import { oneIndexedGenesisTierCosts } from "@/lib/genesis/activation-costs";
import { currentGenesisVaultAbi } from "@/lib/genesis/current-vault";
import { useWalletState } from "@/providers/wallet-context";

type ReviewedBatch = Readonly<{
  items: readonly OwnedGenesis[];
  preview: LaunchBatchPreview;
  prepared: PreparedAtomicBatch;
}>;

// Privy's delegated-EOA self-call passed live Robinhood Chain conformance.
// External wallet and wallet_sendCalls transports remain unverified.
const verifiedMainnetDelegateCodeHashes: readonly `0x${string}`[] = [ROBINHOOD_CALIBUR_CODE_HASH];

function sameCalls(left: LaunchBatchPreview, right: LaunchBatchPreview): boolean {
  return (
    left.action === right.action &&
    left.batch.calls.length === right.batch.calls.length &&
    left.batch.calls.every(
      (call, index) =>
        call.to === right.batch.calls[index].to &&
        call.data === right.batch.calls[index].data &&
        call.value === right.batch.calls[index].value
    )
  );
}

async function freshOwnedItems(
  publicClient: PublicClient,
  deployment: LaunchDeployment,
  wallet: Address,
  selected: readonly OwnedGenesis[]
): Promise<OwnedGenesis[]> {
  return Promise.all(
    selected.map(async (item) => {
      const [owner, tier, registered, credit] = await Promise.all([
        publicClient.readContract({
          address: deployment.contracts.genesis,
          abi: staticsGenesisAbi,
          functionName: "ownerOf",
          args: [item.id],
        }),
        publicClient.readContract({
          address: deployment.contracts.activationRegistry,
          abi: genesisActivationRegistryAbi,
          functionName: "tierOf",
          args: [item.id],
        }),
        publicClient.readContract({
          address: deployment.contracts.launchDistributor,
          abi: genesisLaunchDistributorAbi,
          functionName: "registered",
          args: [item.id],
        }),
        publicClient.readContract({
          address: deployment.contracts.vault,
          abi: staticsGenesisCreditAbi,
          functionName: "credit",
          args: [item.id],
        }),
      ]);
      if (getAddress(owner) !== wallet)
        throw new Error(`Wallet no longer owns Operator #${item.id}.`);
      return {
        ...item,
        tier: Number(tier),
        registered,
        creditActive: credit.active,
        creditPrincipal: credit.principal,
      };
    })
  );
}

export function GenesisBatchPanel({
  deployment,
  items,
  onConfirmed,
}: {
  deployment: LaunchDeployment;
  items: readonly OwnedGenesis[];
  onConfirmed: () => Promise<void>;
}) {
  const t = useTranslations("operators.bulk");
  const walletState = useWalletState();
  const publicClient = usePublicClient({ chainId: deployment.descriptor.chainId });
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;
  const [action, setAction] = useState<LaunchBatchAction>("activate");
  const [targetTier, setTargetTier] = useState(1);
  const [creditAmountInput, setCreditAmountInput] = useState("");
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
  const [reviewed, setReviewed] = useState<readonly ReviewedBatch[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedHashes, setConfirmedHashes] = useState<readonly string[]>([]);
  const [confirmedIds, setConfirmedIds] = useState<readonly bigint[]>([]);

  const selected = useMemo(
    () => items.filter((item) => selectedIds.includes(item.id.toString())),
    [items, selectedIds]
  );
  if (items.length < 2 || !wallet) return null;
  if (
    deployment.source !== "development-fixture" &&
    (deployment.descriptor.chainId !== 4663 || walletState.walletKind !== "embedded")
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

  const allowedTargets = [
    deployment.contracts.statics,
    deployment.contracts.genesis,
    deployment.contracts.activationRegistry,
    deployment.contracts.launchDistributor,
    deployment.contracts.vault,
  ];

  const makePreview = async (group: readonly OwnedGenesis[]): Promise<LaunchBatchPreview> => {
    if (!publicClient) throw new Error("The deployment RPC is unavailable.");
    await verifyLaunchDeployment(publicClient, deployment);
    const fresh = await freshOwnedItems(publicClient, deployment, wallet, group);
    const creditAction =
      action === "open-credit" || action === "draw-credit" || action === "extend-credit";
    let creditAmount: bigint | undefined;
    let nativeFees: bigint[] | undefined;
    if (creditAction) {
      if (action !== "extend-credit") {
        try {
          creditAmount = parseEther(creditAmountInput);
        } catch {
          throw new Error("Enter a valid credit amount per Operator.");
        }
        if (creditAmount <= 0n) throw new Error("Enter a positive credit amount per Operator.");
      }
      if (action !== "extend-credit") {
        const [paused, accounting] = await Promise.all([
          publicClient.readContract({
            address: deployment.contracts.vault,
            abi: staticsGenesisCreditAbi,
            functionName: "creditIncreasesPaused",
          }),
          publicClient.readContract({
            address: deployment.contracts.vault,
            abi: currentGenesisVaultAbi,
            functionName: "vaultAccounting",
          }),
        ]);
        if (paused) throw new Error("Credit increases are paused.");
        if (accounting.epochActive) throw new Error("Genesis credit opens after the Epoch.");
        const limits = await Promise.all(
          fresh.map((item) =>
            publicClient.readContract({
              address: deployment.contracts.vault,
              abi: staticsGenesisCreditAbi,
              functionName: action === "open-credit" ? "creditLimit" : "creditAvailable",
              args: [item.id],
            })
          )
        );
        if (limits.some((limit) => limit < creditAmount!)) {
          throw new Error("The requested amount exceeds an Operator's available credit.");
        }
        const quote = await publicClient.readContract({
          address: deployment.contracts.vault,
          abi: staticsGenesisCreditAbi,
          functionName: "quoteGenesisCredit",
          args: [creditAmount!],
        });
        nativeFees = fresh.map(() => quote.totalNativeFee);
      } else {
        const quotes = await Promise.all(
          fresh.map((item) =>
            publicClient.readContract({
              address: deployment.contracts.vault,
              abi: staticsGenesisCreditAbi,
              functionName: "quoteGenesisCreditExtension",
              args: [item.id],
            })
          )
        );
        nativeFees = quotes.map((quote) => quote.totalNativeFee);
      }
    }
    const spender =
      action === "activate" ? deployment.contracts.activationRegistry : deployment.contracts.vault;
    const [balance, allowance, nftApproved, costs] = await Promise.all([
      action === "activate" || action === "repay"
        ? publicClient.readContract({
            address: deployment.contracts.statics,
            abi: dopplerStaticsTokenAbi,
            functionName: "balanceOf",
            args: [wallet],
          })
        : Promise.resolve(0n),
      action === "activate" || action === "repay"
        ? publicClient.readContract({
            address: deployment.contracts.statics,
            abi: dopplerStaticsTokenAbi,
            functionName: "allowance",
            args: [wallet, spender],
          })
        : Promise.resolve(0n),
      action === "redeem"
        ? publicClient.readContract({
            address: deployment.contracts.genesis,
            abi: staticsGenesisAbi,
            functionName: "isApprovedForAll",
            args: [wallet, deployment.contracts.vault],
          })
        : Promise.resolve(false),
      action === "activate"
        ? Promise.all(
            [1, 2, 3, 4].map((tier) =>
              publicClient.readContract({
                address: deployment.contracts.activationRegistry,
                abi: genesisActivationRegistryAbi,
                functionName: "tierCost",
                args: [tier],
              })
            )
          ).then(oneIndexedGenesisTierCosts)
        : Promise.resolve([]),
    ]);
    return buildLaunchBatchPreview({
      action,
      deployment,
      selected: fresh,
      wallet,
      targetTier,
      tierCosts: costs,
      staticsBalance: balance,
      currentAllowance: allowance,
      nftApprovedForVault: nftApproved,
      creditAmount,
      nativeFees,
    });
  };

  const prepare = async (preview: LaunchBatchPreview): Promise<PreparedAtomicBatch> => {
    if (!publicClient) throw new Error("The deployment RPC is unavailable.");
    const code = await publicClient.getCode({ address: wallet });
    const delegate = delegationFromCode(code);
    const delegateCode = delegate ? await publicClient.getCode({ address: delegate }) : undefined;
    const localVerifiedHashes =
      deployment.source === "development-fixture" && delegateCode
        ? [keccak256(delegateCode)]
        : verifiedMainnetDelegateCodeHashes;
    return prepareErc7821Batch({
      publicClient,
      wallet,
      batch: preview.batch,
      allowedTargets,
      verifiedDelegateCodeHashes: localVerifiedHashes,
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
        throw new Error("Review the batch again after switching networks.");
      }
      await makePreview(selected);
      const chunks = await planAtomicChunks({
        items: selected,
        prepare: async (group) => {
          const preview = await makePreview(group);
          return { preview, prepared: await prepare(preview) };
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
        const freshPreview = await makePreview(chunk.items);
        if (!sameCalls(chunk.preview, freshPreview)) {
          throw new Error("Operator state changed. Review the remaining chunks again.");
        }
        const prepared = await prepare(freshPreview);
        if (!delegationMatchesReview(chunk.prepared, prepared)) {
          throw new Error("Wallet delegation changed. Review the remaining chunks again.");
        }
        const hash = await submitErc7821Batch({
          publicClient,
          wallet,
          chainId: deployment.descriptor.chainId,
          prepared,
          batch: freshPreview.batch,
          sendTransaction: walletState.sendEvmTransaction,
        });
        setConfirmedHashes((hashes) => [...hashes, hash]);
        setConfirmedIds((ids) => [...ids, ...freshPreview.operatorIds]);
        setSelectedIds((ids) =>
          ids.filter((id) => !freshPreview.operatorIds.some((done) => done.toString() === id))
        );
        await onConfirmed();
      }
      setReviewed(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setReviewed(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ui-card genesis-panel" aria-label={t("title")}>
      <div className="genesis-panel-head">
        <h3>{t("title")}</h3>
        <p>{t("launchDescription")}</p>
      </div>
      {deployment.source !== "development-fixture" && <BrowserCaliburActivationPanel />}
      <label className="ui-field">
        {t("action")}
        <select
          value={action}
          disabled={busy}
          onChange={(event) => {
            setAction(event.target.value as LaunchBatchAction);
            setSelectedIds([]);
            setReviewed(null);
          }}
        >
          <option value="activate">{t("activate")}</option>
          <option value="register">{t("register")}</option>
          <option value="open-credit">{t("openCredit")}</option>
          <option value="draw-credit">{t("drawCredit")}</option>
          <option value="extend-credit">{t("extendCredit")}</option>
          <option value="repay">{t("repay")}</option>
          <option value="redeem">{t("redeem")}</option>
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
      {(action === "open-credit" || action === "draw-credit") && (
        <label className="ui-field">
          {t("creditPerOperator")}
          <input
            inputMode="decimal"
            value={creditAmountInput}
            disabled={busy}
            onChange={(event) => {
              setCreditAmountInput(event.target.value);
              setReviewed(null);
            }}
          />
        </label>
      )}
      <div className="genesis-batch-selection">
        {items.map((item) => {
          const available =
            action === "activate"
              ? item.tier < targetTier
              : action === "register"
                ? !item.registered
                : action === "open-credit"
                  ? !item.creditActive
                  : action === "draw-credit" || action === "extend-credit"
                    ? item.creditActive
                    : action === "repay"
                      ? item.creditActive && item.creditPrincipal > 0n
                      : !item.creditActive;
          return (
            <label key={item.id.toString()}>
              <input
                type="checkbox"
                checked={selectedIds.includes(item.id.toString())}
                disabled={busy || !available}
                onChange={(event) => {
                  setSelectedIds((ids) =>
                    event.target.checked
                      ? [...ids, item.id.toString()]
                      : ids.filter((id) => id !== item.id.toString())
                  );
                  setReviewed(null);
                }}
              />
              {t("operator", { id: item.id.toString() })}
            </label>
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
              operators: reviewed.reduce((sum, chunk) => sum + chunk.preview.operatorIds.length, 0),
              calls: reviewed.reduce((sum, chunk) => sum + chunk.preview.batch.calls.length, 0),
            })}
          </p>
          <p>{t("chunks", { count: reviewed.length })}</p>
          {reviewed.some((chunk) => chunk.preview.tokenAmount > 0n) && (
            <p>
              {t(action === "open-credit" || action === "draw-credit" ? "borrowed" : "required", {
                amount: formatEther(
                  reviewed.reduce((sum, chunk) => sum + chunk.preview.tokenAmount, 0n)
                ),
              })}
            </p>
          )}
          {reviewed.some((chunk) => chunk.preview.nativeAmount > 0n) && (
            <p>
              {t("nativeFees", {
                amount: formatEther(
                  reviewed.reduce((sum, chunk) => sum + chunk.preview.nativeAmount, 0n)
                ),
              })}
            </p>
          )}
          {reviewed.some((chunk) => chunk.preview.approvalAmount > 0n) && (
            <p>
              {t("temporaryApproval", {
                amount: formatEther(
                  reviewed.reduce((sum, chunk) => sum + chunk.preview.approvalAmount, 0n)
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
                {chunk.preview.batch.labels.map((label, index) => (
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
