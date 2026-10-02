"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { formatUnits, getAddress, parseEventLogs, parseUnits } from "viem";
import { usePublicClient } from "wagmi";

import { staticsAbi } from "@statics-protocol/sdk/phase-one";

import type { PhaseOneDeployment } from "@/lib/deployments/types";
import { verifyPhaseOneDeploymentCached } from "@/lib/deployments/verify-phase-one";
import {
  advancePublicLiquidityWorkflow,
  createPublicLiquidityWorkflow,
  savePublicLiquidityWorkflow,
  type PublicLiquidityWorkflow,
} from "@/lib/phase-one/liquidity-workflow";
import {
  buildCreatePositionNftTransaction,
  buildProvidePublicLiquidityTransaction,
  quotePublicLiquidity,
  readPublicLiquidityApprovals,
} from "@/lib/phase-one/liquidity";
import { listedPublicPool, readPublicPoolPreflight } from "@/lib/phase-one/pools";
import {
  executePhaseOneTransaction,
  verifyErc20Allowance,
  verifyManagedLiquidity,
  verifyPositionOwner,
} from "@/lib/phase-one/transactions";
import { protocolQueryKeys } from "@/lib/protocol/query-keys";
import { useWalletState } from "@/providers/wallet-context";

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "The Phase 1 liquidity action failed.";
}

export function PhaseOneLiquidityPanel({ deployment }: { deployment: PhaseOneDeployment }) {
  const publicClient = usePublicClient();
  const walletState = useWalletState();
  const queryClient = useQueryClient();
  const [poolIndex, setPoolIndex] = useState(0);
  const [positionIdInput, setPositionIdInput] = useState("");
  const [tickLowerInput, setTickLowerInput] = useState("");
  const [tickUpperInput, setTickUpperInput] = useState("");
  const [amount0Input, setAmount0Input] = useState("");
  const [amount1Input, setAmount1Input] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<PublicLiquidityWorkflow | null>(null);
  const wallet = walletState.address ? getAddress(walletState.address) : null;
  const supported = deployment.supportedPools.filter((candidate) => candidate.enabled);
  const selected = supported[poolIndex] ?? supported[0] ?? null;
  const pool = selected ? listedPublicPool(selected) : null;

  const preflight = useQuery({
    queryKey: protocolQueryKeys.phaseOnePool(
      deployment.descriptor.deploymentId,
      pool?.poolId ?? "unselected"
    ),
    enabled: Boolean(publicClient && pool),
    queryFn: async () => {
      if (!publicClient || !pool) throw new Error("No public pool is selected.");
      await verifyPhaseOneDeploymentCached(publicClient, deployment);
      return readPublicPoolPreflight(publicClient, deployment, pool);
    },
  });

  const spacing = pool?.poolKey.tickSpacing ?? 1;
  const defaultLower = preflight.data
    ? Math.floor((preflight.data.tick - spacing * 100) / spacing) * spacing
    : 0;
  const defaultUpper = preflight.data
    ? Math.ceil((preflight.data.tick + spacing * 100) / spacing) * spacing
    : spacing;
  const tickLower = Number(tickLowerInput || defaultLower);
  const tickUpper = Number(tickUpperInput || defaultUpper);
  let amount0 = 0n;
  let amount1 = 0n;
  try {
    amount0 = pool && amount0Input ? parseUnits(amount0Input, pool.token0.decimals) : 0n;
    amount1 = pool && amount1Input ? parseUnits(amount1Input, pool.token1.decimals) : 0n;
  } catch {
    amount0 = 0n;
    amount1 = 0n;
  }
  let quote: ReturnType<typeof quotePublicLiquidity> | null = null;
  try {
    quote =
      preflight.data && pool && (amount0 > 0n || amount1 > 0n)
        ? quotePublicLiquidity({
            sqrtPriceX96: preflight.data.sqrtPriceX96,
            currentTick: preflight.data.tick,
            tickSpacing: pool.poolKey.tickSpacing,
            tickLower,
            tickUpper,
            amount0Maximum: amount0,
            amount1Maximum: amount1,
          })
        : null;
  } catch {
    quote = null;
  }

  const persist = (next: PublicLiquidityWorkflow) => {
    setWorkflow(next);
    if (typeof window !== "undefined") savePublicLiquidityWorkflow(window.localStorage, next);
  };

  const createPosition = async () => {
    if (!publicClient || !wallet || !pool) return;
    setPending(true);
    setError(null);
    const initial = createPublicLiquidityWorkflow({
      deploymentId: deployment.descriptor.deploymentId,
      chainId: deployment.descriptor.chainId,
      wallet,
      poolId: pool.poolId,
      intentId: crypto.randomUUID(),
    });
    persist(initial);
    try {
      await verifyPhaseOneDeploymentCached(publicClient, deployment);
      const transaction = await buildCreatePositionNftTransaction({
        publicClient,
        deployment,
        receiver: wallet,
      });
      const createdPosition = { id: 0n };
      let positionWorkflow = initial;
      await executePhaseOneTransaction({
        deployment,
        publicClient,
        wallet,
        kind: "phase-one-create-position",
        label: "Create PositionNFT",
        amount: `${formatUnits(transaction.value, 18)} native token fee`,
        to: transaction.target,
        data: transaction.calldata,
        value: transaction.value,
        sendTransaction: walletState.sendEvmTransaction,
        describeError,
        onSubmitted: (hash) => {
          positionWorkflow = advancePublicLiquidityWorkflow(initial, {
            status: "position-confirming",
            transactionHash: hash,
          });
          persist(positionWorkflow);
        },
        verifyConfirmation: async (receipt) => {
          const event = parseEventLogs({
            abi: staticsAbi,
            logs: receipt.logs,
            eventName: "PositionCreated",
          }).find((candidate) => getAddress(candidate.args.owner) === wallet);
          if (!event) throw new Error("The confirmed transaction did not create a PositionNFT.");
          createdPosition.id = event.args.positionId;
          await verifyPositionOwner({
            publicClient,
            deployment,
            positionId: event.args.positionId,
            owner: wallet,
          });
        },
      });
      if (createdPosition.id === 0n) throw new Error("The new PositionNFT ID is unavailable.");
      const createdPositionId = createdPosition.id;
      setPositionIdInput(createdPositionId.toString());
      persist(
        advancePublicLiquidityWorkflow(positionWorkflow, {
          status: "liquidity-ready",
          positionId: createdPositionId,
        })
      );
      await queryClient.invalidateQueries({
        queryKey: ["phase-one-positions", deployment.descriptor.deploymentId],
      });
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setPending(false);
    }
  };

  const provideLiquidity = async () => {
    if (!publicClient || !wallet || !pool || !quote || !positionIdInput) return;
    setPending(true);
    setError(null);
    try {
      const positionId = BigInt(positionIdInput);
      await verifyPhaseOneDeploymentCached(publicClient, deployment);
      const approvals = await readPublicLiquidityApprovals({
        publicClient,
        deployment,
        pool,
        owner: wallet,
        amount0Maximum: quote.maximumAmount0,
        amount1Maximum: quote.maximumAmount1,
      });
      for (const approval of approvals.filter((candidate) => candidate.needed)) {
        const token = approval.token === pool.token0.address ? pool.token0 : pool.token1;
        await executePhaseOneTransaction({
          deployment,
          publicClient,
          wallet,
          kind: "phase-one-approve-token",
          label: `Enable ${token.symbol} for managed liquidity`,
          amount: `${formatUnits(approval.required, token.decimals)} ${token.symbol}`,
          to: approval.target,
          data: approval.calldata,
          sendTransaction: walletState.sendEvmTransaction,
          describeError,
          verifyConfirmation: () =>
            verifyErc20Allowance({
              publicClient,
              token: approval.token,
              owner: wallet,
              spender: deployment.contracts.diamond,
              minimum: approval.required,
            }),
        });
      }
      const block = await publicClient.getBlock();
      const transaction = buildProvidePublicLiquidityTransaction({
        deployment,
        pool,
        positionId,
        quote,
        deadline: block.timestamp + 1_200n,
      });
      let activeWorkflow = workflow;
      if (!activeWorkflow || activeWorkflow.positionId !== positionId.toString()) {
        activeWorkflow = advancePublicLiquidityWorkflow(
          createPublicLiquidityWorkflow({
            deploymentId: deployment.descriptor.deploymentId,
            chainId: deployment.descriptor.chainId,
            wallet,
            poolId: pool.poolId,
            intentId: crypto.randomUUID(),
          }),
          { status: "liquidity-ready", positionId }
        );
      }
      let liquidityWorkflow = activeWorkflow;
      await executePhaseOneTransaction({
        deployment,
        publicClient,
        wallet,
        kind: "phase-one-provide-liquidity",
        label: `Provide ${pool.token0.symbol}/${pool.token1.symbol} liquidity`,
        amount: `${formatUnits(quote.maximumAmount0, pool.token0.decimals)} ${pool.token0.symbol} and ${formatUnits(quote.maximumAmount1, pool.token1.decimals)} ${pool.token1.symbol}`,
        to: transaction.target,
        data: transaction.calldata,
        sendTransaction: walletState.sendEvmTransaction,
        describeError,
        onSubmitted: (hash) => {
          liquidityWorkflow = advancePublicLiquidityWorkflow(activeWorkflow!, {
            status: "liquidity-confirming",
            transactionHash: hash,
          });
          persist(liquidityWorkflow);
        },
        verifyConfirmation: () =>
          verifyManagedLiquidity({
            publicClient,
            deployment,
            positionId,
            poolId: pool.poolId,
            expectedLiquidity: quote.liquidity,
          }),
      });
      persist(advancePublicLiquidityWorkflow(liquidityWorkflow, { status: "complete" }));
      await queryClient.invalidateQueries({
        queryKey: ["phase-one-liquidity", deployment.descriptor.deploymentId],
      });
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setPending(false);
    }
  };

  if (!pool) return <p>No reviewed Phase 1 public pools are enabled for this deployment.</p>;
  return (
    <section aria-label="Phase 1 public liquidity">
      <h2>Public pool liquidity</h2>
      <p>Create or reuse a Statics PositionNFT, then provide concentrated liquidity.</p>
      <label>
        Pool
        <select value={poolIndex} onChange={(event) => setPoolIndex(Number(event.target.value))}>
          {supported.map((candidate, index) => (
            <option key={candidate.poolId} value={index}>
              {candidate.token0.symbol}/{candidate.token1.symbol}
            </option>
          ))}
        </select>
      </label>
      <label>
        PositionNFT ID
        <input
          value={positionIdInput}
          onChange={(event) => setPositionIdInput(event.target.value)}
        />
      </label>
      <button type="button" disabled={pending || !wallet} onClick={createPosition}>
        Create PositionNFT
      </button>
      <label>
        Lower tick
        <input
          value={tickLowerInput}
          placeholder={String(defaultLower)}
          onChange={(event) => setTickLowerInput(event.target.value)}
        />
      </label>
      <label>
        Upper tick
        <input
          value={tickUpperInput}
          placeholder={String(defaultUpper)}
          onChange={(event) => setTickUpperInput(event.target.value)}
        />
      </label>
      <label>
        Maximum {pool.token0.symbol}
        <input value={amount0Input} onChange={(event) => setAmount0Input(event.target.value)} />
      </label>
      <label>
        Maximum {pool.token1.symbol}
        <input value={amount1Input} onChange={(event) => setAmount1Input(event.target.value)} />
      </label>
      {quote && (
        <p>
          Estimated use: {formatUnits(quote.estimatedAmount0, pool.token0.decimals)}{" "}
          {pool.token0.symbol}
          {" and "}
          {formatUnits(quote.estimatedAmount1, pool.token1.decimals)} {pool.token1.symbol}. Range is
          {quote.range.inRange ? " currently active" : " currently out of range"}.
        </p>
      )}
      {workflow && <p role="status">Workflow: {workflow.status}</p>}
      {error && <p role="alert">{error}</p>}
      <button
        type="button"
        disabled={pending || !wallet || !positionIdInput || !quote}
        onClick={provideLiquidity}
      >
        {pending ? "Confirming" : "Review liquidity provision"}
      </button>
    </section>
  );
}
