"use client";

import { useQuery } from "@tanstack/react-query";
import { formatUnits, getAddress, parseUnits } from "viem";
import { useState } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("protocolRevenue");
  const walletState = useWalletState();
  const publicClient = usePublicClient();
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creatorMinimums, setCreatorMinimums] = useState<Record<string, string>>({});
  const [creatorAdvanced, setCreatorAdvanced] = useState<Record<string, boolean>>({});

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
          <p className="dapp-section-label">{t("sectionLabel")}</p>
          <h2>{t("title")}</h2>
          <p>{t("description")}</p>
        </div>
      </div>
      {error && (
        <div className="dapp-error" role="alert">
          {error}
        </div>
      )}
      {revenue.isLoading ? (
        <p>{t("loading")}</p>
      ) : revenue.data?.rows.length ? (
        <div className="position-grid">
          {revenue.data.rows.map(({ token, creatorCredit, partnerAccrued }) => {
            const minimumText =
              creatorMinimums[token.address] ?? formatUnits(creatorCredit, token.decimals);
            const advanced = creatorAdvanced[token.address] ?? false;
            let minimumReceived: bigint | null = null;
            try {
              minimumReceived = advanced ? parseUnits(minimumText, token.decimals) : creatorCredit;
            } catch {
              minimumReceived = null;
            }
            return (
              <article className="ui-card" key={token.address}>
                <h3>{token.symbol}</h3>
                <p>{t("creatorCredit", { amount: formatUnits(creatorCredit, token.decimals) })}</p>
                <p>{t("fullCredit")}</p>
                <details className="liquidity-position-diagnostics">
                  <summary>{t("advancedTolerance")}</summary>
                  <label className="protocol-checkbox">
                    <input
                      type="checkbox"
                      checked={advanced}
                      onChange={(event) =>
                        setCreatorAdvanced((current) => ({
                          ...current,
                          [token.address]: event.target.checked,
                        }))
                      }
                    />
                    {t("transferFeeToken")}
                  </label>
                  {advanced && (
                    <label>
                      {t("minimumReceived")}
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
                  )}
                  <p className="dapp-help">{t("toleranceHelp")}</p>
                </details>
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
                  {busy === `creator-${token.address}` ? t("claiming") : t("claimCreator")}
                </button>
                <p>
                  {t("partnerAccrued", { amount: formatUnits(partnerAccrued, token.decimals) })}
                </p>
                <p>{t("callerTip", { percent: Number(revenue.data.tipBps) / 100 })}</p>
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
                  {busy === `partner-${token.address}` ? t("distributing") : t("distribute")}
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <p>{t("empty")}</p>
      )}
    </section>
  );
}
