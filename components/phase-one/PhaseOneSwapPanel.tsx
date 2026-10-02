"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { formatUnits, getAddress, parseUnits, erc20Abi } from "viem";
import { usePublicClient } from "wagmi";

import type { PhaseOneDeployment } from "@/lib/deployments/types";
import { verifyPhaseOneDeploymentCached } from "@/lib/deployments/verify-phase-one";
import { listedPublicPool, readPublicPoolPreflight } from "@/lib/phase-one/pools";
import {
  buildPublicExactInputSwap,
  quotePublicExactInputSwap,
  readPublicSwapApprovalPlan,
  swapDeadline,
} from "@/lib/phase-one/swaps";
import {
  executePhaseOneTransaction,
  verifyErc20Allowance,
  verifyExactErc20SwapBalanceChanges,
  verifyMarketSwapReceipt,
} from "@/lib/phase-one/transactions";
import { protocolQueryKeys } from "@/lib/protocol/query-keys";
import { slippagePercentToBps } from "@/lib/portal/slippage";
import {
  ProtocolSlippageControl,
  useProtocolSlippage,
} from "@/components/protocol/ProtocolSlippage";
import { useWalletState } from "@/providers/wallet-context";

function amountLabel(value: bigint, decimals: number, symbol: string): string {
  return `${formatUnits(value, decimals)} ${symbol}`;
}

function describePhaseOneError(error: unknown): string {
  return error instanceof Error ? error.message : "The Phase 1 action failed.";
}

export function PhaseOneSwapPanel({ deployment }: { deployment: PhaseOneDeployment }) {
  const publicClient = usePublicClient();
  const walletState = useWalletState();
  const queryClient = useQueryClient();
  const slippage = useProtocolSlippage();
  const [poolIndex, setPoolIndex] = useState(0);
  const [zeroForOne, setZeroForOne] = useState(true);
  const [amountInput, setAmountInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wallet = walletState.address ? getAddress(walletState.address) : null;
  const supported = deployment.supportedPools.filter((pool) => pool.enabled);
  const selected = supported[poolIndex] ?? supported[0] ?? null;
  const pool = selected ? listedPublicPool(selected) : null;
  const inputToken = pool ? (zeroForOne ? pool.token0 : pool.token1) : null;
  const outputToken = pool ? (zeroForOne ? pool.token1 : pool.token0) : null;
  let amountIn = 0n;
  try {
    amountIn = inputToken && amountInput ? parseUnits(amountInput, inputToken.decimals) : 0n;
  } catch {
    amountIn = 0n;
  }

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

  const quote = useQuery({
    queryKey: protocolQueryKeys.phaseOneSwapQuote(
      deployment.descriptor.deploymentId,
      pool?.poolId ?? "unselected",
      inputToken?.address ?? deployment.contracts.statics,
      amountIn
    ),
    enabled: Boolean(
      publicClient && pool && inputToken && preflight.data?.swappable && amountIn > 0n
    ),
    queryFn: async () => {
      if (!publicClient || !pool || !inputToken || !preflight.data)
        throw new Error("Swap quote is unavailable.");
      return quotePublicExactInputSwap({
        publicClient,
        deployment,
        preflight: preflight.data,
        inputToken: inputToken.address,
        amountIn,
        account: wallet ?? undefined,
      });
    },
  });

  const approvals = useQuery({
    queryKey: protocolQueryKeys.phaseOneSwapApprovals(
      deployment.descriptor.deploymentId,
      wallet,
      inputToken?.address ?? deployment.contracts.statics,
      amountIn
    ),
    enabled: Boolean(publicClient && wallet && inputToken && amountIn > 0n),
    queryFn: async () => {
      if (!publicClient || !wallet || !inputToken)
        throw new Error("Swap approvals are unavailable.");
      const block = await publicClient.getBlock();
      return readPublicSwapApprovalPlan({
        publicClient,
        deployment,
        owner: wallet,
        token: inputToken.address,
        amount: amountIn,
        currentTimestamp: Number(block.timestamp),
      });
    },
  });

  const submit = async () => {
    if (!publicClient || !wallet || !pool || !inputToken || !outputToken || !quote.data) return;
    const slippageBps = slippagePercentToBps(slippage);
    if (slippageBps === null) return;
    setPending(true);
    setError(null);
    try {
      await verifyPhaseOneDeploymentCached(publicClient, deployment);
      const freshPreflight = await readPublicPoolPreflight(publicClient, deployment, pool);
      const freshQuote = await quotePublicExactInputSwap({
        publicClient,
        deployment,
        preflight: freshPreflight,
        inputToken: inputToken.address,
        amountIn,
        account: wallet,
      });
      const block = await publicClient.getBlock();
      let approvalPlan = await readPublicSwapApprovalPlan({
        publicClient,
        deployment,
        owner: wallet,
        token: inputToken.address,
        amount: amountIn,
        currentTimestamp: Number(block.timestamp),
      });
      if (approvalPlan.tokenApprovalCall) {
        await executePhaseOneTransaction({
          deployment,
          publicClient,
          wallet,
          kind: "phase-one-approve-token",
          label: `Enable ${inputToken.symbol} for Permit2`,
          amount: amountLabel(amountIn, inputToken.decimals, inputToken.symbol),
          to: approvalPlan.tokenApprovalCall.target,
          data: approvalPlan.tokenApprovalCall.calldata,
          sendTransaction: walletState.sendEvmTransaction,
          describeError: describePhaseOneError,
          verifyConfirmation: () =>
            verifyErc20Allowance({
              publicClient,
              token: inputToken.address,
              owner: wallet,
              spender: deployment.contracts.permit2,
              minimum: amountIn,
            }),
        });
      }
      approvalPlan = await readPublicSwapApprovalPlan({
        publicClient,
        deployment,
        owner: wallet,
        token: inputToken.address,
        amount: amountIn,
        currentTimestamp: Number(block.timestamp),
      });
      if (approvalPlan.permit2ApprovalCall) {
        await executePhaseOneTransaction({
          deployment,
          publicClient,
          wallet,
          kind: "phase-one-approve-permit2",
          label: `Enable ${inputToken.symbol} for the swap router`,
          amount: amountLabel(amountIn, inputToken.decimals, inputToken.symbol),
          to: approvalPlan.permit2ApprovalCall.target,
          data: approvalPlan.permit2ApprovalCall.calldata,
          sendTransaction: walletState.sendEvmTransaction,
          describeError: describePhaseOneError,
          verifyConfirmation: async () => {
            const refreshed = await readPublicSwapApprovalPlan({
              publicClient,
              deployment,
              owner: wallet,
              token: inputToken.address,
              amount: amountIn,
              currentTimestamp: Number((await publicClient.getBlock()).timestamp),
            });
            if (!refreshed.ready) throw new Error("Confirmed Permit2 approvals are not usable.");
          },
        });
      }
      const transaction = buildPublicExactInputSwap({
        deployment,
        pool,
        quote: freshQuote,
        slippageBps,
        deadline: swapDeadline(Number(block.timestamp)),
      });
      const [inputBalanceBefore, outputBalanceBefore] = await Promise.all([
        publicClient.readContract({
          address: inputToken.address,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [wallet],
        }),
        publicClient.readContract({
          address: outputToken.address,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [wallet],
        }),
      ]);
      await executePhaseOneTransaction({
        deployment,
        publicClient,
        wallet,
        kind: "phase-one-swap",
        label: `Swap ${inputToken.symbol} for ${outputToken.symbol}`,
        amount: amountLabel(amountIn, inputToken.decimals, inputToken.symbol),
        to: transaction.target,
        data: transaction.calldata,
        value: transaction.value,
        sendTransaction: walletState.sendEvmTransaction,
        describeError: describePhaseOneError,
        verifyConfirmation: async (receipt) => {
          verifyMarketSwapReceipt({ receipt, deployment, poolId: pool.poolId });
          const [inputBalanceAfter, outputBalanceAfter] = await Promise.all([
            publicClient.readContract({
              address: inputToken.address,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [wallet],
            }),
            publicClient.readContract({
              address: outputToken.address,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [wallet],
            }),
          ]);
          verifyExactErc20SwapBalanceChanges({
            inputBalanceBefore,
            inputBalanceAfter,
            outputBalanceBefore,
            outputBalanceAfter,
            exactAmountIn: amountIn,
            minimumAmountOut: transaction.minimumAmountOut,
          });
        },
      });
      setAmountInput("");
      await queryClient.invalidateQueries({
        queryKey: ["phase-one-pool", deployment.descriptor.deploymentId],
      });
    } catch (failure) {
      setError(describePhaseOneError(failure));
    } finally {
      setPending(false);
    }
  };

  if (!pool || !inputToken || !outputToken) {
    return <p>No reviewed Phase 1 public pools are enabled for this deployment.</p>;
  }
  return (
    <section aria-label="Phase 1 public swap">
      <h2>Public pool swap</h2>
      <p>Direct single-pool routing. No imported pool is used as an intermediary.</p>
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
      <button type="button" onClick={() => setZeroForOne((current) => !current)} disabled={pending}>
        {inputToken.symbol} to {outputToken.symbol}
      </button>
      <label>
        Amount
        <input
          value={amountInput}
          inputMode="decimal"
          onChange={(event) => setAmountInput(event.target.value)}
          disabled={pending}
        />
      </label>
      <ProtocolSlippageControl />
      {preflight.data && (
        <dl>
          <div>
            <dt>Native LP fee</dt>
            <dd>{preflight.data.nativeLpFee / 10_000}%</dd>
          </div>
          <div>
            <dt>Statics input fee</dt>
            <dd>{preflight.data.feeRate.inputFeeBps / 100}%</dd>
          </div>
          <div>
            <dt>Statics output fee</dt>
            <dd>{preflight.data.feeRate.outputFeeBps / 100}%</dd>
          </div>
          <div>
            <dt>Managed POL share</dt>
            <dd>{preflight.data.allocation.managedPolShareBps / 100}%</dd>
          </div>
          <div>
            <dt>Global staker share</dt>
            <dd>{preflight.data.allocation.staticsStakerShareBps / 100}%</dd>
          </div>
          <div>
            <dt>Creator share</dt>
            <dd>5%</dd>
          </div>
          <div>
            <dt>Treasury share</dt>
            <dd>{preflight.data.allocation.treasuryShareBps / 100}%</dd>
          </div>
        </dl>
      )}
      {preflight.data?.gauge.freshness.stale && (
        <p role="status">
          Gauge maintenance is behind by {preflight.data.gauge.freshness.periodsBehind} periods.
          Trading remains available unless this swap crosses a managed range boundary; catch-up is
          permissionless.
        </p>
      )}
      {quote.data && (
        <p>
          Quote: {amountLabel(quote.data.amountOut, outputToken.decimals, outputToken.symbol)}.
          Estimated Statics fees:{" "}
          {amountLabel(quote.data.fees.staticsInputFee, inputToken.decimals, inputToken.symbol)}{" "}
          input and{" "}
          {amountLabel(quote.data.fees.staticsOutputFee, outputToken.decimals, outputToken.symbol)}{" "}
          output.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <button
        type="button"
        disabled={pending || !wallet || !quote.data || approvals.isLoading}
        onClick={submit}
      >
        {pending ? "Confirming" : !wallet ? "Connect wallet" : "Review direct swap"}
      </button>
    </section>
  );
}
