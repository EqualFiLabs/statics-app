"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  decodeFunctionResult,
  encodeFunctionData,
  formatUnits,
  getAddress,
  parseUnits,
} from "viem";
import { usePublicClient } from "wagmi";

import {
  buildQuoteV4ExactInputSingleCall,
  buildV4ExactInputSingleSwap,
  dopplerStaticsTokenAbi,
  permit2AllowanceAbi,
  v4StateViewReadAbi,
  v4QuoterAbi,
} from "@statics-protocol/sdk";

import { EmptyState } from "@/components/common/EmptyState";
import { AmountPercentageSlider } from "@/components/protocol/PercentageSlider";
import {
  ProtocolSlippageControl,
  useProtocolSlippage,
} from "@/components/protocol/ProtocolSlippage";
import { minimumWithSlippage } from "@/lib/baskets/baskets";
import {
  maximumTokenApproval,
  poolKeyForLaunch,
  settlementForTrade,
  tokenAddress,
  tradeDirections,
  tradeSymbol,
  zeroForTrade,
} from "@/lib/trade/canonical-market";
import {
  MAX_PERMIT2_ALLOWANCE,
  MAX_PERMIT2_EXPIRATION,
  hasUsablePermit2Allowance,
} from "@/lib/protocol/approvals";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { applyPercent } from "@/lib/protocol/ux";
import { slippagePercentToBps } from "@/lib/portal/slippage";
import { useDeployment } from "@/providers/deployment-context";
import { useWalletState } from "@/providers/wallet-context";
import type { LaunchDeployment } from "@/lib/deployments/types";

const PERMIT_TTL = 20n * 60n;

function display(value: bigint): string {
  const [whole, fraction = ""] = formatUnits(value, 18).split(".");
  const compact = fraction.slice(0, 6).replace(/0+$/, "");
  return compact ? `${whole}.${compact}` : whole;
}

function describeTradeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/rejected/i.test(message)) return "The wallet request was rejected.";
  if (/insufficient/i.test(message)) return message;
  return message || "The canonical market transaction failed.";
}

export function TradePage() {
  const { active } = useDeployment();
  if (!active.deployment || active.deployment.kind !== "launch") {
    return (
      <EmptyState
        title="Canonical market not deployed"
        description={
          active.descriptor.unavailableReason ??
          "This deployment does not contain the canonical STATICS/WETH market."
        }
      />
    );
  }
  return <LaunchTrade deployment={active.deployment} />;
}

function LaunchTrade({ deployment }: { deployment: LaunchDeployment }) {
  const walletState = useWalletState();
  const publicClient = usePublicClient({ chainId: deployment.descriptor.chainId });
  const queryClient = useQueryClient();
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;
  const [directionIndex, setDirectionIndex] = useState(0);
  const [amountInput, setAmountInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const direction = tradeDirections[directionIndex]!;
  const inputSymbol = tradeSymbol(direction.input);
  const outputSymbol = tradeSymbol(direction.output);
  const inputToken = tokenAddress(deployment, direction.input);
  const slippageBps = slippagePercentToBps(useProtocolSlippage());
  let amount = 0n;
  try {
    amount = parseUnits(amountInput || "0", 18);
  } catch {
    amount = 0n;
  }

  const marketState = useQuery({
    queryKey: ["launch-market", deployment.descriptor.deploymentId, wallet],
    enabled: Boolean(publicClient),
    queryFn: async () => {
      if (!publicClient) throw new Error("Robinhood RPC is unavailable.");
      const [liquidity, staticsBalance, wethBalance, ethBalance] = await Promise.all([
        publicClient.readContract({
          address: deployment.contracts.stateView,
          abi: v4StateViewReadAbi,
          functionName: "getLiquidity",
          args: [deployment.market.poolId],
        }),
        wallet
          ? publicClient.readContract({
              address: deployment.contracts.statics,
              abi: dopplerStaticsTokenAbi,
              functionName: "balanceOf",
              args: [wallet],
            })
          : 0n,
        wallet
          ? publicClient.readContract({
              address: deployment.contracts.weth,
              abi: dopplerStaticsTokenAbi,
              functionName: "balanceOf",
              args: [wallet],
            })
          : 0n,
        wallet ? publicClient.getBalance({ address: wallet }) : 0n,
      ]);
      return { liquidity, staticsBalance, wethBalance, ethBalance };
    },
  });
  const inputBalance =
    direction.input === "eth"
      ? marketState.data?.ethBalance
      : direction.input === "weth"
        ? marketState.data?.wethBalance
        : marketState.data?.staticsBalance;

  const quote = useQuery({
    queryKey: [
      "launch-trade-quote",
      deployment.descriptor.deploymentId,
      direction.input,
      direction.output,
      amount.toString(),
    ],
    enabled: Boolean(publicClient) && amount > 0n && (marketState.data?.liquidity ?? 0n) > 0n,
    queryFn: async () => {
      if (!publicClient) throw new Error("Robinhood RPC is unavailable.");
      const result = await publicClient.call({
        account: wallet ?? undefined,
        to: deployment.contracts.quoter,
        data: buildQuoteV4ExactInputSingleCall(
          poolKeyForLaunch(deployment),
          zeroForTrade(deployment, direction.input),
          amount
        ),
      });
      if (!result.data) throw new Error("The canonical quoter returned no result.");
      const [amountOut] = decodeFunctionResult({
        abi: v4QuoterAbi,
        functionName: "quoteExactInputSingle",
        data: result.data,
      });
      if (amountOut === 0n) throw new Error("This amount produces no output.");
      return { amount, amountOut, directionIndex };
    },
  });
  const currentQuote =
    quote.data?.amount === amount && quote.data.directionIndex === directionIndex
      ? quote.data
      : null;
  const minimumOut =
    currentQuote && slippageBps !== null
      ? minimumWithSlippage(currentQuote.amountOut, slippageBps)
      : null;

  const submit = async () => {
    if (!publicClient || !wallet || !currentQuote || minimumOut === null || minimumOut === 0n)
      return;
    setPending(true);
    setError(null);
    try {
      const balance =
        direction.input === "eth"
          ? await publicClient.getBalance({ address: wallet })
          : await publicClient.readContract({
              address: inputToken,
              abi: dopplerStaticsTokenAbi,
              functionName: "balanceOf",
              args: [wallet],
            });
      if (balance < amount) throw new Error(`Insufficient ${inputSymbol} balance.`);
      const block = await publicClient.getBlock();

      if (direction.input !== "eth") {
        const tokenAllowance = await publicClient.readContract({
          address: inputToken,
          abi: dopplerStaticsTokenAbi,
          functionName: "allowance",
          args: [wallet, deployment.contracts.permit2],
        });
        if (tokenAllowance < amount) {
          await executeProtocolTransaction({
            publicClient,
            wallet,
            chainId: deployment.descriptor.chainId,
            kind: "approve-swap",
            label: `Enable ${inputSymbol} swaps`,
            amount: `Maximum ${inputSymbol}`,
            to: inputToken,
            data: maximumTokenApproval(deployment.contracts.permit2),
            sendTransaction: walletState.sendEvmTransaction,
            describeError: describeTradeError,
          });
        }
        const permit2 = await publicClient.readContract({
          address: deployment.contracts.permit2,
          abi: permit2AllowanceAbi,
          functionName: "allowance",
          args: [wallet, inputToken, deployment.contracts.universalRouter],
        });
        if (!hasUsablePermit2Allowance(permit2[0], permit2[1], amount, Number(block.timestamp))) {
          await executeProtocolTransaction({
            publicClient,
            wallet,
            chainId: deployment.descriptor.chainId,
            kind: "approve-permit2",
            label: `Authorize ${inputSymbol} swaps`,
            amount: `Maximum ${inputSymbol}`,
            to: deployment.contracts.permit2,
            data: encodeFunctionData({
              abi: permit2AllowanceAbi,
              functionName: "approve",
              args: [
                inputToken,
                deployment.contracts.universalRouter,
                MAX_PERMIT2_ALLOWANCE,
                MAX_PERMIT2_EXPIRATION,
              ],
            }),
            sendTransaction: walletState.sendEvmTransaction,
            describeError: describeTradeError,
          });
        }
      }

      const fresh = await publicClient.call({
        account: wallet,
        to: deployment.contracts.quoter,
        data: buildQuoteV4ExactInputSingleCall(
          poolKeyForLaunch(deployment),
          zeroForTrade(deployment, direction.input),
          amount
        ),
      });
      if (!fresh.data) throw new Error("The refreshed quote returned no result.");
      const [freshOut] = decodeFunctionResult({
        abi: v4QuoterAbi,
        functionName: "quoteExactInputSingle",
        data: fresh.data,
      });
      if (freshOut < minimumOut) throw new Error("The price moved below your reviewed minimum.");
      const execution = buildV4ExactInputSingleSwap({
        router: deployment.contracts.universalRouter,
        poolKey: poolKeyForLaunch(deployment),
        zeroForOne: zeroForTrade(deployment, direction.input),
        amountIn: amount,
        amountOutMinimum: minimumOut,
        deadline: block.timestamp + PERMIT_TTL,
        settlement: settlementForTrade(deployment, direction),
      });
      await executeProtocolTransaction({
        publicClient,
        wallet,
        chainId: deployment.descriptor.chainId,
        kind: "swap",
        label: `Swap ${inputSymbol} for ${outputSymbol}`,
        amount: `${display(amount)} ${inputSymbol}`,
        to: execution.target,
        data: execution.calldata,
        value: execution.value,
        sendTransaction: walletState.sendEvmTransaction,
        describeError: describeTradeError,
      });
      setAmountInput("");
      await queryClient.invalidateQueries({
        queryKey: ["launch-market", deployment.descriptor.deploymentId],
      });
    } catch (cause) {
      setError(describeTradeError(cause));
    } finally {
      setPending(false);
    }
  };

  let actionLabel = "Review trade";
  let action: (() => void) | null = () => void submit();
  if (walletState.status === "signed-out" || walletState.status === "error") {
    actionLabel = "Sign in to trade";
    action = walletState.login;
  } else if (walletState.status === "wallet-missing") {
    actionLabel = "Create wallet";
    action = () => void walletState.createWallet();
  } else if (walletState.status === "ready" && !walletState.isTargetChain) {
    actionLabel = `Switch to ${walletState.networkName}`;
    action = () => void walletState.switchNetwork();
  } else if (walletState.status !== "ready") {
    actionLabel = "Wallet loading";
    action = null;
  } else if ((marketState.data?.liquidity ?? 0n) === 0n) {
    actionLabel = marketState.isLoading ? "Reading market" : "Market unavailable";
    action = null;
  } else if (amount === 0n || !currentQuote || minimumOut === null) {
    actionLabel = quote.isFetching ? "Reading quote" : "Enter an amount";
    action = null;
  } else if ((inputBalance ?? 0n) < amount) {
    actionLabel = `Insufficient ${inputSymbol}`;
    action = null;
  }

  return (
    <div className="launch-trade-grid">
      <section className="ui-card launch-trade-card" aria-labelledby="launch-trade-title">
        <p className="dapp-eyebrow">Canonical market</p>
        <h2 id="launch-trade-title">Trade STATICS</h2>
        <p>Swap directly through the reviewed STATICS/WETH Uniswap v4 pool.</p>
        <label className="basket-field">
          <span>Direction</span>
          <select
            value={directionIndex}
            disabled={pending}
            onChange={(event) => {
              setDirectionIndex(Number(event.target.value));
              setAmountInput("");
              setError(null);
            }}
          >
            {tradeDirections.map((item, index) => (
              <option key={`${item.input}-${item.output}`} value={index}>
                {tradeSymbol(item.input)} → {tradeSymbol(item.output)}
              </option>
            ))}
          </select>
        </label>
        <label className="basket-field">
          <span>You pay ({inputSymbol})</span>
          <input
            value={amountInput}
            inputMode="decimal"
            placeholder="0.00"
            disabled={pending}
            onChange={(event) => {
              setAmountInput(event.target.value);
              setError(null);
            }}
          />
          <small>
            Balance: {display(inputBalance ?? 0n)} {inputSymbol}
          </small>
          <AmountPercentageSlider
            amount={amount}
            maximum={inputBalance ?? 0n}
            disabled={pending || (inputBalance ?? 0n) === 0n}
            label="Amount"
            onSelect={(percent) =>
              setAmountInput(display(applyPercent(inputBalance ?? 0n, percent)))
            }
          />
        </label>
        <ProtocolSlippageControl />
        <div className="basket-quote">
          <span>You receive</span>
          <strong>
            {currentQuote ? `${display(currentQuote.amountOut)} ${outputSymbol}` : "—"}
          </strong>
          {minimumOut !== null && (
            <small>
              Minimum: {display(minimumOut)} {outputSymbol}
            </small>
          )}
        </div>
        {(error || marketState.error || quote.error) && (
          <p className="dapp-inline-error" role="alert">
            {describeTradeError(error ?? marketState.error ?? quote.error)}
          </p>
        )}
        <button
          className="dollar-primary-action"
          type="button"
          disabled={pending || !action}
          onClick={() => action?.()}
        >
          {pending ? "Confirming…" : actionLabel}
        </button>
      </section>
      <aside className="ui-card launch-trade-notice">
        <p className="dapp-eyebrow">How it works</p>
        <h3>One canonical market</h3>
        <p>
          ETH is wrapped and unwrapped inside the same router transaction. ERC-20 inputs use
          reusable maximum approvals to the reviewed Permit2 and Universal Router only.
        </p>
        <dl>
          <div>
            <dt>Network</dt>
            <dd>{deployment.descriptor.network}</dd>
          </div>
          <div>
            <dt>Market</dt>
            <dd>STATICS / WETH</dd>
          </div>
          <div>
            <dt>Liquidity</dt>
            <dd>{marketState.data?.liquidity ? "Active" : "Unavailable"}</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}
