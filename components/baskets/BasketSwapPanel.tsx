"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  decodeFunctionResult,
  encodeFunctionData,
  formatUnits,
  getAddress,
  parseUnits,
} from "viem";
import { usePublicClient, useWalletClient } from "wagmi";

import {
  CanonicalPoolStatus,
  basketTokenAbi,
  buildPermit2PermitTypedData,
  buildQuoteV4ExactInputSingleCall,
  buildV4ExactInputSingleSwap,
  permit2AllowanceAbi,
  staticsAbi,
  v4QuoterAbi,
} from "@statics-protocol/sdk";

import {
  canonicalSwapPoolKey,
  isCurrentCanonicalSwapQuote,
  permit2SwapApproval,
  SWAP_PERMIT_TTL_SECONDS,
  zeroForExactInput,
} from "@/lib/baskets/swap";
import {
  DEFAULT_BASKET_SLIPPAGE_BPS,
  describeBasketError,
  minimumWithSlippage,
  parseSlippageBps,
  type BasketRecord,
} from "@/lib/baskets/baskets";
import {
  readClientDollarDeployment,
  verifyDollarDeployment,
  verifyLiquidityDeployment,
} from "@/lib/dollar/deployment";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { useWalletState } from "@/providers/wallet-context";

const deploymentState = readClientDollarDeployment();

function display(value: bigint, decimals: number): string {
  const [whole, fraction = ""] = formatUnits(value, decimals).split(".");
  const short = fraction.slice(0, 6).replace(/0+$/, "");
  return short ? `${whole}.${short}` : whole;
}

export function BasketSwapPanel({ basket }: { basket: BasketRecord }) {
  const walletState = useWalletState();
  const publicClient = usePublicClient();
  const walletClient = useWalletClient();
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;
  const [assetIndex, setAssetIndex] = useState(0);
  const [direction, setDirection] = useState<"asset-in" | "basket-in">("asset-in");
  const [amountInput, setAmountInput] = useState("");
  const [slippageInput, setSlippageInput] = useState(
    (DEFAULT_BASKET_SLIPPAGE_BPS / 100).toFixed(2)
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const constituent = basket.constituents[assetIndex] ?? basket.constituents[0]!;
  const inputToken = direction === "asset-in" ? constituent.token : basket.token;
  const outputToken = direction === "asset-in" ? basket.token : constituent.token;
  const inputBalance = direction === "asset-in" ? constituent.walletBalance : basket.walletBalance;
  const amount = useMemo(() => {
    try {
      return amountInput ? parseUnits(amountInput, inputToken.decimals) : 0n;
    } catch {
      return 0n;
    }
  }, [amountInput, inputToken.decimals]);
  const slippageBps = parseSlippageBps(slippageInput);

  const pool = useQuery({
    queryKey: ["canonical-swap-pool", basket.basketId.toString(), constituent.token.address],
    enabled: Boolean(publicClient) && deploymentState.status === "configured",
    queryFn: async () => {
      if (!publicClient || deploymentState.status !== "configured") {
        throw new Error("No verified Statics deployment is configured.");
      }
      await verifyDollarDeployment(publicClient, deploymentState.deployment);
      await verifyLiquidityDeployment(publicClient, deploymentState.deployment);
      return publicClient.readContract({
        address: deploymentState.deployment.contracts.diamond,
        abi: staticsAbi,
        functionName: "canonicalPool",
        args: [basket.basketId, constituent.token.address],
      });
    },
  });

  const quote = useQuery({
    queryKey: [
      "canonical-swap-quote",
      basket.basketId.toString(),
      constituent.token.address,
      direction,
      amount.toString(),
    ],
    enabled:
      Boolean(publicClient) &&
      deploymentState.status === "configured" &&
      Boolean(deploymentState.deployment.liquidity?.contracts.quoter) &&
      pool.data?.status === CanonicalPoolStatus.Active &&
      amount > 0n,
    queryFn: async () => {
      if (
        !publicClient ||
        deploymentState.status !== "configured" ||
        !deploymentState.deployment.liquidity?.contracts.quoter ||
        !pool.data
      ) {
        throw new Error("Canonical swap quoting is unavailable.");
      }
      const poolKey = canonicalSwapPoolKey(pool.data);
      const zeroForOne = zeroForExactInput(poolKey, inputToken.address);
      const result = await publicClient.call({
        account: wallet ?? undefined,
        to: deploymentState.deployment.liquidity.contracts.quoter,
        data: buildQuoteV4ExactInputSingleCall(poolKey, zeroForOne, amount),
      });
      if (!result.data) throw new Error("The canonical quoter returned no result.");
      const [amountOut] = decodeFunctionResult({
        abi: v4QuoterAbi,
        functionName: "quoteExactInputSingle",
        data: result.data,
      });
      if (amountOut === 0n) throw new Error("The canonical quote returns no output.");
      return {
        amount,
        amountOut,
        asset: constituent.token.address,
        direction,
        poolKey,
        zeroForOne,
      };
    },
  });
  const currentQuote = isCurrentCanonicalSwapQuote(
    quote.data,
    amount,
    constituent.token.address,
    direction
  )
    ? quote.data!
    : null;
  const minimumOut =
    currentQuote && slippageBps !== null
      ? minimumWithSlippage(currentQuote.amountOut, slippageBps)
      : null;
  const permit2Approval = useQuery({
    queryKey: ["canonical-swap-permit2-approval", wallet, inputToken.address, amount.toString()],
    enabled:
      Boolean(publicClient) &&
      Boolean(wallet) &&
      deploymentState.status === "configured" &&
      Boolean(deploymentState.deployment.liquidity) &&
      amount > 0n,
    queryFn: async () => {
      if (
        !publicClient ||
        !wallet ||
        deploymentState.status !== "configured" ||
        !deploymentState.deployment.liquidity
      ) {
        return 0n;
      }
      return publicClient.readContract({
        address: inputToken.address,
        abi: basketTokenAbi,
        functionName: "allowance",
        args: [wallet, deploymentState.deployment.liquidity.contracts.permit2],
      });
    },
  });

  const submit = async () => {
    if (
      !wallet ||
      !publicClient ||
      !walletClient.data ||
      !currentQuote ||
      minimumOut === null ||
      minimumOut === 0n ||
      deploymentState.status !== "configured" ||
      !deploymentState.deployment.liquidity?.contracts.quoter ||
      !deploymentState.deployment.liquidity.contracts.universalRouter
    ) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      if (amount > inputBalance) throw new Error(`Insufficient ${inputToken.symbol} balance.`);
      await verifyDollarDeployment(publicClient, deploymentState.deployment);
      const liquidity = await verifyLiquidityDeployment(publicClient, deploymentState.deployment);
      const router = liquidity.contracts.universalRouter;
      if (!router) throw new Error("Robinhood Universal Router is not configured.");
      const [freshBalance, permit2Allowance, freshQuote, block] = await Promise.all([
        publicClient.readContract({
          address: inputToken.address,
          abi: basketTokenAbi,
          functionName: "balanceOf",
          args: [wallet],
        }),
        publicClient.readContract({
          address: inputToken.address,
          abi: basketTokenAbi,
          functionName: "allowance",
          args: [wallet, liquidity.contracts.permit2],
        }),
        publicClient.call({
          account: wallet,
          to: liquidity.contracts.quoter,
          data: buildQuoteV4ExactInputSingleCall(
            currentQuote.poolKey,
            currentQuote.zeroForOne,
            amount
          ),
        }),
        publicClient.getBlock(),
      ]);
      if (freshBalance < amount) throw new Error(`Insufficient ${inputToken.symbol} balance.`);

      if (permit2Allowance < amount) {
        await executeProtocolTransaction({
          publicClient,
          wallet,
          chainId: deploymentState.deployment.chainId,
          kind: "approve-swap",
          label: `Enable ${inputToken.symbol} swaps`,
          amount: `${display(freshBalance, inputToken.decimals)} ${inputToken.symbol}`,
          to: inputToken.address,
          data: encodeFunctionData({
            abi: basketTokenAbi,
            functionName: "approve",
            args: [liquidity.contracts.permit2, freshBalance],
          }),
          sendTransaction: ({ to, data, value }) =>
            walletClient.data!.sendTransaction({
              account: wallet,
              chain: walletClient.data!.chain,
              to,
              data,
              value,
            }),
          describeError: describeBasketError,
          verifyConfirmation: async () => {
            const allowance = await publicClient.readContract({
              address: inputToken.address,
              abi: basketTokenAbi,
              functionName: "allowance",
              args: [wallet, liquidity.contracts.permit2],
            });
            if (allowance < amount) throw new Error("The Permit2 allowance is still insufficient.");
          },
        });
        await permit2Approval.refetch();
        return;
      }
      if (!freshQuote.data) throw new Error("The refreshed canonical quote returned no result.");
      const [freshAmountOut] = decodeFunctionResult({
        abi: v4QuoterAbi,
        functionName: "quoteExactInputSingle",
        data: freshQuote.data,
      });
      if (freshAmountOut < minimumOut) {
        await quote.refetch();
        throw new Error("The refreshed output moved below the reviewed minimum.");
      }
      if (freshAmountOut === 0n || minimumOut === 0n) {
        throw new Error("The swap amount is too small to produce a protected output.");
      }

      const deadline = block.timestamp + SWAP_PERMIT_TTL_SECONDS;
      const allowance = await publicClient.readContract({
        address: liquidity.contracts.permit2,
        abi: permit2AllowanceAbi,
        functionName: "allowance",
        args: [wallet, inputToken.address, router],
      });
      const permitSingle = permit2SwapApproval(
        inputToken.address,
        amount,
        allowance[2],
        router,
        deadline
      );
      const signature = await walletClient.data.signTypedData({
        account: wallet,
        ...buildPermit2PermitTypedData(
          deploymentState.deployment.chainId,
          liquidity.contracts.permit2,
          permitSingle
        ),
      });
      const execution = buildV4ExactInputSingleSwap({
        router,
        poolKey: currentQuote.poolKey,
        zeroForOne: currentQuote.zeroForOne,
        amountIn: amount,
        amountOutMinimum: minimumOut,
        deadline,
        permit: { permitSingle, signature },
      });
      const outputBefore = await publicClient.readContract({
        address: outputToken.address,
        abi: basketTokenAbi,
        functionName: "balanceOf",
        args: [wallet],
      });
      await executeProtocolTransaction({
        publicClient,
        wallet,
        chainId: deploymentState.deployment.chainId,
        kind: "swap",
        label: `Swap ${inputToken.symbol} for ${outputToken.symbol}`,
        amount: `${display(amount, inputToken.decimals)} ${inputToken.symbol}`,
        to: execution.target,
        data: execution.calldata,
        value: execution.value,
        sendTransaction: ({ to, data, value }) =>
          walletClient.data!.sendTransaction({
            account: wallet,
            chain: walletClient.data!.chain,
            to,
            data,
            value,
          }),
        describeError: describeBasketError,
        verifyConfirmation: async () => {
          const outputAfter = await publicClient.readContract({
            address: outputToken.address,
            abi: basketTokenAbi,
            functionName: "balanceOf",
            args: [wallet],
          });
          if (outputAfter < outputBefore + minimumOut) {
            throw new Error("The confirmed swap output is below the reviewed minimum.");
          }
        },
      });
      setAmountInput("");
      await quote.refetch();
    } catch (cause) {
      setError(describeBasketError(cause));
    } finally {
      setPending(false);
    }
  };

  const poolActive = pool.data?.status === CanonicalPoolStatus.Active;
  const readError = pool.error ?? quote.error;
  let label = "Review swap";
  let action: (() => void) | null = () => void submit();
  if (walletState.status === "signed-out" || walletState.status === "error") {
    label = "Sign in to continue";
    action = walletState.login;
  } else if (walletState.status === "wallet-missing") {
    label = "Create embedded wallet";
    action = () => void walletState.createWallet();
  } else if (walletState.status === "ready" && !walletState.isTargetChain) {
    label = `Switch to ${walletState.networkName}`;
    action = () => void walletState.switchNetwork();
  } else if (walletState.status !== "ready") {
    label = "Wallet loading…";
    action = null;
  } else if (!poolActive) {
    label = pool.isPending ? "Reading canonical pool…" : "Canonical pool warming";
  } else if (permit2Approval.isFetching) {
    label = "Reading allowance…";
  } else if ((permit2Approval.data ?? 0n) < amount) {
    label = `Enable ${inputToken.symbol} swaps`;
  } else if (quote.isFetching) {
    label = "Reading quote…";
  } else if (amount > inputBalance) {
    label = `Insufficient ${inputToken.symbol}`;
  }

  return (
    <>
      <h3 id="basket-action-title">Swap canonical pool</h3>
      <label className="basket-field">
        <span>Underlying pool</span>
        <select
          value={assetIndex}
          onChange={(event) => {
            setAssetIndex(Number(event.target.value));
            setAmountInput("");
            setError(null);
          }}
          disabled={pending}
        >
          {basket.constituents.map((item, index) => (
            <option key={item.token.address} value={index}>
              {basket.symbol} / {item.token.symbol}
            </option>
          ))}
        </select>
      </label>
      <div className="portal-direction-tabs" aria-label="Canonical swap direction">
        <button
          type="button"
          aria-pressed={direction === "asset-in"}
          onClick={() => {
            setDirection("asset-in");
            setAmountInput("");
          }}
          disabled={pending}
        >
          {constituent.token.symbol} → {basket.symbol}
        </button>
        <button
          type="button"
          aria-pressed={direction === "basket-in"}
          onClick={() => {
            setDirection("basket-in");
            setAmountInput("");
          }}
          disabled={pending}
        >
          {basket.symbol} → {constituent.token.symbol}
        </button>
      </div>
      <label className="basket-field">
        <span>{inputToken.symbol} amount</span>
        <input
          value={amountInput}
          onChange={(event) => {
            setAmountInput(event.target.value);
            setError(null);
          }}
          inputMode="decimal"
          placeholder="0.00"
          disabled={pending}
        />
        <small>
          Balance {display(inputBalance, inputToken.decimals)} {inputToken.symbol}
        </small>
      </label>
      <label className="basket-field">
        <span>Slippage tolerance</span>
        <div>
          <input
            value={slippageInput}
            onChange={(event) => setSlippageInput(event.target.value)}
            inputMode="decimal"
            disabled={pending}
          />
          <strong>%</strong>
        </div>
        <small>Allowed range 0–5%. Default 0.50%.</small>
      </label>
      <div className="basket-quote">
        <span>Robinhood Uniswap v4 quote</span>
        <strong>
          {currentQuote
            ? `${display(currentQuote.amountOut, outputToken.decimals)} ${outputToken.symbol}`
            : "Enter an amount for a fresh quote"}
        </strong>
        {minimumOut !== null && (
          <small>
            Minimum {display(minimumOut, outputToken.decimals)} {outputToken.symbol}
          </small>
        )}
      </div>
      {!poolActive && !pool.isPending && (
        <p className="dollar-action-reason">
          This canonical pool must be Active before browser swaps are enabled.
        </p>
      )}
      {readError && (
        <p className="dapp-inline-error" role="alert">
          {describeBasketError(readError)} Change the amount or pool to retry.
        </p>
      )}
      {error && (
        <p className="dapp-inline-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="dollar-submit"
        type="button"
        onClick={action ?? undefined}
        disabled={
          pending ||
          action === null ||
          (walletState.status === "ready" &&
            walletState.isTargetChain &&
            (!poolActive ||
              permit2Approval.isFetching ||
              quote.isFetching ||
              !currentQuote ||
              minimumOut === null ||
              minimumOut === 0n ||
              amount > inputBalance))
        }
      >
        {pending ? "Waiting for confirmation…" : label}
      </button>
    </>
  );
}
