"use client";

import { useQuery } from "@tanstack/react-query";
import { formatUnits, getAddress, parseUnits } from "viem";
import { useState } from "react";
import { usePublicClient } from "wagmi";

import {
  buildClaimCreatorRevenueCall,
  buildDistributePartnerRevenueCall,
  staticsAbi,
} from "@statics-protocol/sdk";

import { loadBasketCatalog, loadTokenMetadata } from "@/lib/baskets/baskets";
import { readClientDollarDeployment, verifyDollarDeployment } from "@/lib/dollar/deployment";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { useWalletState } from "@/providers/wallet-context";

const deploymentState = readClientDollarDeployment();

export function ProtocolRevenueCard() {
  const walletState = useWalletState();
  const publicClient = usePublicClient();
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creatorMinimums, setCreatorMinimums] = useState<Record<string, string>>({});

  const revenue = useQuery({
    queryKey: [
      "protocol-revenue",
      wallet,
      deploymentState.status === "configured" ? deploymentState.deployment.protocolCommit : null,
    ],
    enabled:
      deploymentState.status === "configured" &&
      Boolean(publicClient && wallet) &&
      walletState.status === "ready" &&
      walletState.isTargetChain,
    queryFn: async () => {
      if (!publicClient || !wallet || deploymentState.status !== "configured")
        throw new Error("No verified deployment.");
      const deployment = deploymentState.deployment;
      await verifyDollarDeployment(publicClient, deployment);
      const [catalog, partnerRecipient, tipBps] = await Promise.all([
        loadBasketCatalog(publicClient, deployment, wallet),
        publicClient.readContract({
          address: deployment.contracts.diamond,
          abi: staticsAbi,
          functionName: "partnerRecipient",
        }),
        publicClient.readContract({
          address: deployment.contracts.diamond,
          abi: staticsAbi,
          functionName: "partnerDistributionTipBps",
        }),
      ]);
      const assets = [
        ...new Set(
          [
            deployment.contracts.weth,
            deployment.contracts.dollar,
            deployment.genesis?.token,
            ...catalog.baskets.flatMap((basket) => [
              basket.token.address,
              ...basket.constituents.map((item) => item.token.address),
            ]),
          ].filter((asset): asset is `0x${string}` => Boolean(asset))
        ),
      ];
      const tokens = await Promise.all(
        assets.map((asset) => loadTokenMetadata(publicClient, asset))
      );
      const rows = await Promise.all(
        tokens.map(async (token) => ({
          token,
          creatorCredit: await publicClient.readContract({
            address: deployment.contracts.diamond,
            abi: staticsAbi,
            functionName: "creatorRewardCredit",
            args: [wallet, token.address],
          }),
          partnerAccrued: await publicClient.readContract({
            address: deployment.contracts.diamond,
            abi: staticsAbi,
            functionName: "partnerAccrued",
            args: [partnerRecipient, token.address],
          }),
        }))
      );
      return {
        rows: rows.filter((row) => row.creatorCredit > 0n || row.partnerAccrued > 0n),
        partnerRecipient: getAddress(partnerRecipient),
        tipBps,
      };
    },
  });

  if (!wallet || deploymentState.status !== "configured") return null;
  const transact = async (
    key: string,
    kind: "claim-creator-revenue" | "distribute-partner-revenue",
    label: string,
    amount: string,
    data: `0x${string}`
  ) => {
    setBusy(key);
    setError(null);
    try {
      await executeProtocolTransaction({
        publicClient: publicClient!,
        wallet,
        chainId: deploymentState.deployment.chainId,
        kind,
        label,
        amount,
        to: deploymentState.deployment.contracts.diamond,
        data,
        sendTransaction: walletState.sendEvmTransaction,
        describeError: (caught) =>
          caught instanceof Error ? caught.message : "Revenue transaction failed.",
      });
      await revenue.refetch();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Revenue transaction failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="position-panel">
      <div className="position-section-heading">
        <div>
          <p className="dapp-section-label">Protocol revenue</p>
          <h2>Creator and partner rewards</h2>
          <p>
            Index creators pull their 5% share. Anyone may distribute StonkBrokers revenue and
            receive the configured caller tip.
          </p>
        </div>
      </div>
      {error && (
        <div className="dapp-error" role="alert">
          {error}
        </div>
      )}
      {revenue.isLoading ? (
        <p>Loading revenue…</p>
      ) : revenue.data?.rows.length ? (
        <div className="position-grid">
          {revenue.data.rows.map(({ token, creatorCredit, partnerAccrued }) => {
            const minimumText =
              creatorMinimums[token.address] ?? formatUnits(creatorCredit, token.decimals);
            let minimumReceived: bigint | null = null;
            try {
              minimumReceived = parseUnits(minimumText, token.decimals);
            } catch {
              minimumReceived = null;
            }
            return (
              <article className="ui-card" key={token.address}>
                <h3>{token.symbol}</h3>
                <p>Creator credit: {formatUnits(creatorCredit, token.decimals)}</p>
                <label>
                  Minimum received
                  <input
                    inputMode="decimal"
                    value={minimumText}
                    onChange={(event) =>
                      setCreatorMinimums((current) => ({
                        ...current,
                        [token.address]: event.target.value,
                      }))
                    }
                  />
                </label>
                <button
                  disabled={
                    busy !== null ||
                    creatorCredit === 0n ||
                    minimumReceived === null ||
                    minimumReceived > creatorCredit
                  }
                  onClick={() =>
                    void transact(
                      `creator-${token.address}`,
                      "claim-creator-revenue",
                      `Claim ${token.symbol} creator revenue`,
                      `${formatUnits(creatorCredit, token.decimals)} ${token.symbol}`,
                      buildClaimCreatorRevenueCall(token.address, wallet, minimumReceived!)
                    )
                  }
                >
                  {busy === `creator-${token.address}` ? "Claiming…" : "Claim creator revenue"}
                </button>
                <p className="dapp-help">
                  Lower this only if the token charges a transfer fee; a failed transfer keeps the
                  credit available.
                </p>
                <p>StonkBrokers accrued: {formatUnits(partnerAccrued, token.decimals)}</p>
                <p>Caller tip: {Number(revenue.data.tipBps) / 100}%</p>
                <button
                  disabled={busy !== null || partnerAccrued === 0n}
                  onClick={() =>
                    void transact(
                      `partner-${token.address}`,
                      "distribute-partner-revenue",
                      `Distribute ${token.symbol} partner revenue`,
                      `${formatUnits(partnerAccrued, token.decimals)} ${token.symbol}`,
                      buildDistributePartnerRevenueCall(
                        revenue.data!.partnerRecipient,
                        token.address
                      )
                    )
                  }
                >
                  {busy === `partner-${token.address}`
                    ? "Distributing…"
                    : "Distribute and earn tip"}
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <p>No creator or partner revenue is currently claimable.</p>
      )}
    </section>
  );
}
