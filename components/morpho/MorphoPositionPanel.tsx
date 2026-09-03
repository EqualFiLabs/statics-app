"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { encodeFunctionData, formatUnits, getAddress } from "viem";
import { usePublicClient } from "wagmi";

import {
  basketTokenAbi,
  buildBorrowMorphoUsdCall,
  buildDeployMorphoCollateralCall,
  buildRecallMorphoCollateralCall,
  buildRepayMorphoUsdCall,
  buildSyncMorphoCall,
} from "@statics-protocol/sdk";

import type { PositionRecord } from "@/lib/positions/positions";
import { useProtocolSurface } from "@/components/protocol/ProtocolAvailability";
import { parseLocalizedUnits } from "@/lib/i18n/amounts";
import { useAppLocale } from "@/i18n/client";
import { loadMorphoPosition, maximumBorrowShares, maximumRepayAssets } from "@/lib/morpho/morpho";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { useWalletState } from "@/providers/wallet-context";

function display(value: bigint, decimals = 18, precision = 4): string {
  const [whole, fraction = ""] = formatUnits(value, decimals).split(".");
  const short = fraction.slice(0, precision).replace(/0+$/, "");
  return short ? `${whole}.${short}` : whole;
}

function percent(value: bigint | null): string {
  if (value === null) return "No debt";
  return `${(Number(value) / 1e16).toFixed(2)}%`;
}

function describe(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/rejected/i.test(message)) return "The wallet request was rejected.";
  if (message.includes("InsufficientAvailableCollateral")) {
    return "The Position no longer has enough available collateral.";
  }
  if (message.includes("insufficient liquidity")) return "This market has insufficient liquidity.";
  return message || "The Morpho action failed.";
}

export function MorphoPositionPanel({ position }: { position: PositionRecord }) {
  const locale = useAppLocale();
  const walletState = useWalletState();
  const publicClient = usePublicClient();
  const protocol = useProtocolSurface();
  const deployment = protocol.deployment;
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;
  const markets = deployment.morpho?.markets ?? [];
  const [selectedId, setSelectedId] = useState<string>(markets[0]?.marketId ?? "");
  const [collateralInput, setCollateralInput] = useState("");
  const [borrowInput, setBorrowInput] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selected = markets.find((market) => market.marketId === selectedId) ?? markets[0];

  const snapshot = useQuery({
    queryKey: ["morpho-position", deployment.deploymentId, position.positionId, selected?.marketId],
    enabled: Boolean(publicClient && wallet && selected && walletState.isTargetChain),
    queryFn: () => {
      if (!publicClient || !selected) throw new Error("Morpho market unavailable.");
      return loadMorphoPosition(publicClient, deployment, selected, position.positionId);
    },
  });
  const walletUsd = useQuery({
    queryKey: ["morpho-wallet-usd", deployment.deploymentId, wallet],
    enabled: Boolean(publicClient && wallet && deployment.morpho && walletState.isTargetChain),
    queryFn: async () => {
      if (!publicClient || !wallet) throw new Error("Wallet unavailable.");
      const [balance, allowance] = await Promise.all([
        publicClient.readContract({
          address: deployment.contracts.dollar,
          abi: basketTokenAbi,
          functionName: "balanceOf",
          args: [wallet],
        }),
        publicClient.readContract({
          address: deployment.contracts.dollar,
          abi: basketTokenAbi,
          functionName: "allowance",
          args: [wallet, deployment.contracts.diamond],
        }),
      ]);
      return { balance, allowance };
    },
  });

  const availableSource = useMemo(() => {
    if (!selected || !snapshot.data) return 0n;
    if (selected.kind === "statics") {
      return position.stakedBalance > snapshot.data.tracked.trackedCollateral
        ? position.stakedBalance - snapshot.data.tracked.trackedCollateral
        : 0n;
    }
    const basket = position.collateral.find((item) => item.basket.basketId === selected.basketId);
    if (!basket) return 0n;
    const reserved = basket.lockedShares + snapshot.data.tracked.trackedCollateral;
    return basket.depositedShares > reserved ? basket.depositedShares - reserved : 0n;
  }, [position, selected, snapshot.data]);

  const parse = (value: string) => {
    try {
      return parseLocalizedUnits(value, 18, locale);
    } catch {
      return 0n;
    }
  };
  const collateralAmount = parse(collateralInput);
  const borrowAmount = parse(borrowInput);

  const run = async (key: string, action: () => Promise<void>) => {
    if (!wallet || !publicClient) return;
    if (!walletState.isTargetChain) {
      await walletState.switchNetwork();
      return;
    }
    setPending(key);
    setError(null);
    try {
      await action();
      await Promise.all([snapshot.refetch(), walletUsd.refetch()]);
    } catch (cause) {
      setError(describe(cause));
    } finally {
      setPending(null);
    }
  };

  const send = async (
    kind: Parameters<typeof executeProtocolTransaction>[0]["kind"],
    label: string,
    to: `0x${string}`,
    data: `0x${string}`,
    amount: string
  ) => {
    if (!wallet || !publicClient) return;
    await executeProtocolTransaction({
      publicClient,
      wallet,
      chainId: deployment.chainId,
      deploymentId: deployment.deploymentId,
      kind,
      label,
      amount,
      to,
      data,
      sendTransaction: walletState.sendEvmTransaction,
      describeError: describe,
    });
  };

  if (!deployment.morpho || !markets.length) return null;
  const collateralSymbol = selected?.kind === "statics" ? "STATICS" : "TPA1";
  const debt = snapshot.data?.health.borrowedAssets ?? 0n;

  return (
    <section className="ui-card position-morpho" aria-labelledby="position-morpho-title">
      <div className="remaining-section-heading">
        <div>
          <p className="dapp-section-label">Morpho Blue</p>
          <h3 id="position-morpho-title">Borrow USDstx against this Position</h3>
          <p>
            Collateral stays owned by the Position. Deployed collateral cannot also back a Statics
            basket loan.
          </p>
        </div>
      </div>

      <label className="dollar-field">
        <span>Collateral market</span>
        <select
          value={selected?.marketId ?? ""}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          {markets.map((market) => (
            <option key={market.marketId} value={market.marketId}>
              {market.kind === "statics" ? "Staked STATICS / USDstx" : "TPA1 / USDstx"}
            </option>
          ))}
        </select>
      </label>

      {snapshot.isLoading ? (
        <p className="dapp-loading">Loading Morpho position…</p>
      ) : snapshot.isError ? (
        <p className="dapp-inline-error" role="alert">
          {describe(snapshot.error)}
        </p>
      ) : snapshot.data ? (
        <>
          <dl className="genesis-figures">
            <div>
              <dt>Available in Position</dt>
              <dd>
                {display(availableSource)} {collateralSymbol}
              </dd>
            </div>
            <div>
              <dt>Deployed collateral</dt>
              <dd>
                {display(snapshot.data.tracked.actualCollateral)} {collateralSymbol}
              </dd>
            </div>
            <div>
              <dt>USDstx debt</dt>
              <dd>{display(debt)} USDstx</dd>
            </div>
            <div>
              <dt>Health factor</dt>
              <dd>{percent(snapshot.data.health.healthFactorWad)}</dd>
            </div>
            <div>
              <dt>Borrow headroom</dt>
              <dd>{display(snapshot.data.health.borrowHeadroomAssets)} USDstx</dd>
            </div>
            <div>
              <dt>Market liquidity</dt>
              <dd>{display(snapshot.data.market.availableLiquidity)} USDstx</dd>
            </div>
          </dl>

          <div className="dollar-action-grid">
            <label className="dollar-field">
              <span>Collateral amount</span>
              <input
                inputMode="decimal"
                value={collateralInput}
                onChange={(event) => setCollateralInput(event.target.value)}
                placeholder="0.0"
              />
            </label>
            <div className="testnet-faucet-actions">
              <button
                className="ui-button ui-button--primary"
                type="button"
                disabled={
                  pending !== null || collateralAmount <= 0n || collateralAmount > availableSource
                }
                onClick={() =>
                  void run("deploy", () =>
                    send(
                      "deploy-morpho-collateral",
                      `Deploy ${collateralSymbol} to Morpho`,
                      deployment.contracts.diamond,
                      buildDeployMorphoCollateralCall(
                        position.positionId,
                        selected!.marketId,
                        collateralAmount
                      ),
                      `${display(collateralAmount)} ${collateralSymbol}`
                    )
                  )
                }
              >
                {pending === "deploy" ? "Deploying…" : "Deploy collateral"}
              </button>
              <button
                className="ui-button ui-button--secondary"
                type="button"
                disabled={
                  pending !== null ||
                  collateralAmount <= 0n ||
                  collateralAmount > snapshot.data.tracked.trackedCollateral
                }
                onClick={() =>
                  void run("recall", () =>
                    send(
                      "recall-morpho-collateral",
                      `Recall ${collateralSymbol} from Morpho`,
                      deployment.contracts.diamond,
                      buildRecallMorphoCollateralCall(
                        position.positionId,
                        selected!.marketId,
                        collateralAmount
                      ),
                      `${display(collateralAmount)} ${collateralSymbol}`
                    )
                  )
                }
              >
                {pending === "recall" ? "Recalling…" : "Recall collateral"}
              </button>
            </div>

            <label className="dollar-field">
              <span>Borrow USDstx</span>
              <input
                inputMode="decimal"
                value={borrowInput}
                onChange={(event) => setBorrowInput(event.target.value)}
                placeholder="0.0"
              />
            </label>
            <div className="testnet-faucet-actions">
              <button
                className="ui-button ui-button--primary"
                type="button"
                disabled={
                  pending !== null ||
                  borrowAmount <= 0n ||
                  borrowAmount > snapshot.data.health.borrowHeadroomAssets ||
                  borrowAmount > snapshot.data.market.availableLiquidity
                }
                onClick={() =>
                  void run("borrow", () =>
                    send(
                      "borrow-morpho",
                      "Borrow USDstx from Morpho",
                      deployment.contracts.diamond,
                      buildBorrowMorphoUsdCall(
                        position.positionId,
                        selected!.marketId,
                        borrowAmount,
                        maximumBorrowShares(borrowAmount, snapshot.data!.market.market),
                        wallet!
                      ),
                      `${display(borrowAmount)} USDstx`
                    )
                  )
                }
              >
                {pending === "borrow" ? "Borrowing…" : "Borrow USDstx"}
              </button>
              <button
                className="ui-button ui-button--secondary"
                type="button"
                disabled={
                  pending !== null ||
                  snapshot.data.position.borrowShares === 0n ||
                  (walletUsd.data?.balance ?? 0n) <
                    maximumRepayAssets(
                      snapshot.data.position.borrowShares,
                      snapshot.data.market.market
                    )
                }
                onClick={() =>
                  void run("repay", async () => {
                    const maxAssets = maximumRepayAssets(
                      snapshot.data!.position.borrowShares,
                      snapshot.data!.market.market
                    );
                    if ((walletUsd.data?.allowance ?? 0n) < maxAssets) {
                      await send(
                        "approve-dollar",
                        "Approve USDstx repayment",
                        deployment.contracts.dollar,
                        encodeFunctionData({
                          abi: basketTokenAbi,
                          functionName: "approve",
                          args: [deployment.contracts.diamond, maxAssets],
                        }),
                        `${display(maxAssets)} USDstx`
                      );
                      return;
                    }
                    await send(
                      "repay-morpho",
                      "Repay all Morpho debt",
                      deployment.contracts.diamond,
                      buildRepayMorphoUsdCall(
                        position.positionId,
                        selected!.marketId,
                        0n,
                        snapshot.data!.position.borrowShares,
                        maxAssets
                      ),
                      `${display(maxAssets)} USDstx maximum`
                    );
                  })
                }
              >
                {pending === "repay"
                  ? (walletUsd.data?.allowance ?? 0n) <
                    maximumRepayAssets(
                      snapshot.data.position.borrowShares,
                      snapshot.data.market.market
                    )
                    ? "Approving…"
                    : "Repaying…"
                  : (walletUsd.data?.allowance ?? 0n) <
                      maximumRepayAssets(
                        snapshot.data.position.borrowShares,
                        snapshot.data.market.market
                      )
                    ? "Approve USDstx"
                    : "Repay all"}
              </button>
              <button
                className="ui-button ui-button--secondary"
                type="button"
                disabled={pending !== null || !snapshot.data.accountDeployed}
                onClick={() =>
                  void run("sync", () =>
                    send(
                      "sync-morpho",
                      "Synchronize Morpho collateral",
                      deployment.contracts.diamond,
                      buildSyncMorphoCall(position.positionId, selected!.marketId),
                      "Position accounting"
                    )
                  )
                }
              >
                {pending === "sync" ? "Syncing…" : "Sync after liquidation"}
              </button>
            </div>
          </div>
        </>
      ) : null}
      {error && (
        <p className="dapp-inline-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
