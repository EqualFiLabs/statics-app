"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { formatEther, getAddress } from "viem";
import { usePublicClient } from "wagmi";
import {
  buildRecoverGenesisCreditCall,
  staticsGenesisCreditAbi,
} from "@statics-protocol/sdk/genesis-credit";

import { EmptyState, UnconfiguredSurface } from "@/components/common/EmptyState";
import { AddressDisplay } from "@/components/protocol/AddressDisplay";
import type { LaunchDeployment } from "@/lib/deployments/types";
import { verifyLaunchDeployment } from "@/lib/deployments/verify-launch";
import { currentGenesisVaultAbi } from "@/lib/genesis/current-vault";
import { loadRecoverableGenesisCredits } from "@/lib/indexer/statics";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { formatTokenAmountGrouped } from "@/lib/protocol/ux";
import { useDeployment } from "@/providers/deployment-context";
import { useWalletState } from "@/providers/wallet-context";

type RecoveryCredit = Readonly<{
  genesisId: bigint;
  owner: `0x${string}`;
  principal: bigint;
  maturity: bigint;
  recoverableAt: bigint;
  unusedCredit: bigint;
  callerIncentive: bigint;
  genesisDistribution: bigint;
}>;

function describeRecoveryError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/rejected/i.test(message)) return "The wallet request was rejected.";
  if (message.includes("CreditNotRecoverable")) return "This credit is not recoverable yet.";
  if (message.includes("CreditNotActive")) return "This Operator credit is no longer active.";
  return message || "The recovery transaction failed.";
}

function displayTimestamp(timestamp: bigint): string {
  return new Date(Number(timestamp) * 1_000).toLocaleString();
}

export function GenesisRecoveriesPage() {
  const { active } = useDeployment();
  if (!active.launch) return <UnconfiguredSurface subject="Operator recoveries" />;
  return <LaunchGenesisRecoveries deployment={active.launch} />;
}

/**
 * Permissionless recovery of other people's defaulted Genesis credit.
 *
 * This is keeper work, not Genesis ownership, which is why it has its own
 * destination: it used to sit as the first tab on My Operators, so every holder
 * had to step past somebody else's liquidations to reach their own NFTs.
 */
function LaunchGenesisRecoveries({ deployment }: { deployment: LaunchDeployment }) {
  const walletState = useWalletState();
  const publicClient = usePublicClient({ chainId: deployment.descriptor.chainId });
  const queryClient = useQueryClient();
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;
  const [busy, setBusy] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);

  const epoch = useQuery({
    queryKey: ["genesis-vault-epoch", deployment.descriptor.deploymentId],
    enabled: Boolean(publicClient),
    queryFn: async () => {
      if (!publicClient) throw new Error("The deployment RPC is unavailable.");
      const accounting = await publicClient.readContract({
        address: deployment.contracts.vault,
        abi: currentGenesisVaultAbi,
        functionName: "vaultAccounting",
      });
      return accounting.epochActive;
    },
  });

  const recoveries = useQuery({
    queryKey: ["launch-genesis-recoveries", deployment.descriptor.deploymentId],
    enabled: Boolean(publicClient && epoch.data === false),
    queryFn: async (): Promise<readonly RecoveryCredit[]> => {
      if (!publicClient) return [];
      await verifyLaunchDeployment(publicClient, deployment);
      const block = await publicClient.getBlock({ blockTag: "latest" });
      const indexed = await loadRecoverableGenesisCredits(
        block.timestamp,
        deployment.descriptor.deploymentId
      );
      const checked = await Promise.all(
        indexed.map(async (candidate): Promise<RecoveryCredit | null> => {
          const [credit, quote] = await Promise.all([
            publicClient.readContract({
              address: deployment.contracts.vault,
              abi: staticsGenesisCreditAbi,
              functionName: "credit",
              args: [candidate.genesisId],
            }),
            publicClient
              .readContract({
                address: deployment.contracts.vault,
                abi: staticsGenesisCreditAbi,
                functionName: "quoteGenesisCreditRecovery",
                args: [candidate.genesisId],
              })
              .catch(() => null),
          ]);
          if (!credit.active || !quote || BigInt(credit.recoverableAt) >= block.timestamp)
            return null;
          return {
            genesisId: candidate.genesisId,
            owner: getAddress(credit.owner),
            principal: credit.principal,
            maturity: BigInt(credit.maturity),
            recoverableAt: BigInt(credit.recoverableAt),
            unusedCredit: quote.unusedCredit,
            callerIncentive: quote.callerIncentive,
            genesisDistribution: quote.genesisDistribution,
          };
        })
      );
      return checked.filter((item): item is RecoveryCredit => item !== null);
    },
  });

  const recover = async (credit: RecoveryCredit) => {
    if (!publicClient) return;
    if (!wallet) {
      if (walletState.status === "wallet-missing") void walletState.createWallet();
      else walletState.connectWallet();
      return;
    }
    if (!walletState.isTargetChain) {
      await walletState.switchNetwork();
      return;
    }
    setBusy(credit.genesisId);
    setError(null);
    try {
      await verifyLaunchDeployment(publicClient, deployment);
      await executeProtocolTransaction({
        publicClient,
        wallet,
        chainId: deployment.descriptor.chainId,
        deploymentId: deployment.descriptor.deploymentId,
        kind: "recover-genesis-credit",
        label: `Recover Operator #${credit.genesisId}`,
        amount: `${formatEther(credit.callerIncentive)} STATICS caller incentive`,
        to: deployment.contracts.vault,
        data: buildRecoverGenesisCreditCall(credit.genesisId),
        sendTransaction: walletState.sendEvmTransaction,
        describeError: describeRecoveryError,
        verifyConfirmation: async () => {
          const current = await publicClient.readContract({
            address: deployment.contracts.vault,
            abi: staticsGenesisCreditAbi,
            functionName: "credit",
            args: [credit.genesisId],
          });
          if (current.active) throw new Error("Recovery is not reflected onchain yet.");
        },
      });
      await queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey.includes(deployment.descriptor.deploymentId) &&
          ["launch-genesis", "genesis-vault"].some((prefix) =>
            String(query.queryKey[0]).startsWith(prefix)
          ),
      });
    } catch (cause) {
      setError(describeRecoveryError(cause));
      await recoveries.refetch();
    } finally {
      setBusy(null);
    }
  };

  if (epoch.data !== false) {
    return (
      <EmptyState
        title="Recovery opens after the Genesis Epoch"
        description="Operator credit cannot be opened, and so cannot default, while the Epoch is running."
        secondary={{ label: "Back to My Operators", href: "/app/genesis" }}
      />
    );
  }

  return (
    <div className="genesis-page">
      {error && (
        <p className="dapp-inline-error" role="alert">
          {error}
        </p>
      )}
      {recoveries.isLoading ? (
        <p className="dapp-loading">Loading recoverable Operator credits…</p>
      ) : recoveries.error ? (
        <p className="dapp-inline-error" role="alert">
          Recovery discovery is temporarily unavailable because the deployment indexer could not be
          reached. Owned Operators management remains available.
        </p>
      ) : !recoveries.data?.length ? (
        <EmptyState
          title="No recoverable Operator credits"
          description="No indexed credit is currently eligible for permissionless recovery."
          secondary={{ label: "Back to My Operators", href: "/app/genesis" }}
        />
      ) : (
        <div className="genesis-grid">
          {recoveries.data.map((credit) => (
            <article className="ui-card genesis-card" key={credit.genesisId.toString()}>
              <h2 className="ui-section-title">Operator #{credit.genesisId.toString()}</h2>
              <AddressDisplay
                address={credit.owner}
                chainId={deployment.descriptor.chainId}
                label="Current owner"
              />
              <dl className="genesis-recovery-figures">
                <div>
                  <dt>Principal</dt>
                  <dd>{formatTokenAmountGrouped(credit.principal, 18, 0)} STATICS</dd>
                </div>
                <div>
                  <dt>Unused credit</dt>
                  <dd>{formatTokenAmountGrouped(credit.unusedCredit, 18, 2)} STATICS</dd>
                </div>
                <div>
                  <dt>Your incentive</dt>
                  <dd className="is-accent">
                    {formatTokenAmountGrouped(credit.callerIncentive, 18, 2)} STATICS
                  </dd>
                </div>
                <div>
                  <dt>To the Genesis holder</dt>
                  <dd>{formatTokenAmountGrouped(credit.genesisDistribution, 18, 2)} STATICS</dd>
                </div>
                <div>
                  <dt>Matured</dt>
                  <dd>{displayTimestamp(credit.maturity)}</dd>
                </div>
                <div>
                  <dt>Recoverable since</dt>
                  <dd>{displayTimestamp(credit.recoverableAt)}</dd>
                </div>
              </dl>
              <button
                className="ui-button ui-button--primary ui-button--block"
                type="button"
                disabled={busy !== null && busy !== credit.genesisId}
                onClick={() => void recover(credit)}
              >
                {busy === credit.genesisId ? "Recovering…" : `Recover Operator #${credit.genesisId}`}
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
