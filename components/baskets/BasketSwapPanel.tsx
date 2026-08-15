"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { decodeFunctionResult, encodeFunctionData, formatUnits, getAddress } from "viem";
import { usePublicClient, useWalletClient } from "wagmi";

import {
  basketTokenAbi,
  buildQuoteV4ExactInputSingleCall,
  buildV4ExactInputSingleSwap,
  permit2AllowanceAbi,
  staticsAbi,
  staticsSwapFeeHookAbi,
  v4QuoterAbi,
} from "@statics-protocol/sdk";

import {
  canonicalSwapPoolKey,
  buildMaximumSwapTokenApproval,
  isCurrentCanonicalSwapQuote,
  SWAP_PERMIT_TTL_SECONDS,
  zeroForExactInput,
} from "@/lib/baskets/swap";
import { describeBasketError, minimumWithSlippage, type BasketRecord } from "@/lib/baskets/baskets";
import { AmountPercentageSlider } from "@/components/protocol/PercentageSlider";
import {
  ProtocolSlippageControl,
  useProtocolSlippage,
} from "@/components/protocol/ProtocolSlippage";
import {
  readClientDollarDeployment,
  verifyDollarDeployment,
  verifyLiquidityDeployment,
} from "@/lib/dollar/deployment";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { protocolQueryKeys } from "@/lib/protocol/query-keys";
import {
  MAX_ERC20_ALLOWANCE,
  MAX_PERMIT2_ALLOWANCE,
  MAX_PERMIT2_EXPIRATION,
  hasUsablePermit2Allowance,
} from "@/lib/protocol/approvals";
import { useWalletState } from "@/providers/wallet-context";
import { useAppLocale } from "@/i18n/client";
import { parseLocalizedUnits } from "@/lib/i18n/amounts";
import { applyPercent } from "@/lib/protocol/ux";
import { slippagePercentToBps } from "@/lib/portal/slippage";

const deploymentState = readClientDollarDeployment();

function display(value: bigint, decimals: number): string {
  const [whole, fraction = ""] = formatUnits(value, decimals).split(".");
  const short = fraction.slice(0, 6).replace(/0+$/, "");
  return short ? `${whole}.${short}` : whole;
}

export function BasketSwapPanel({ basket }: { basket: BasketRecord }) {
  const locale = useAppLocale();
  const t = useTranslations("baskets");
  const walletState = useWalletState();
  const publicClient = usePublicClient();
  const walletClient = useWalletClient();
  const queryClient = useQueryClient();
  const protocolSlippage = useProtocolSlippage();
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;
  const [assetIndex, setAssetIndex] = useState(0);
  const [direction, setDirection] = useState<"asset-in" | "basket-in">("asset-in");
  const [amountInput, setAmountInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const constituent = basket.constituents[assetIndex] ?? basket.constituents[0]!;
  const inputToken = direction === "asset-in" ? constituent.token : basket.token;
  const outputToken = direction === "asset-in" ? basket.token : constituent.token;
  const inputBalance = direction === "asset-in" ? constituent.walletBalance : basket.walletBalance;
  let amount = 0n;
  try {
    amount = parseLocalizedUnits(amountInput, inputToken.decimals, locale);
  } catch {
    amount = 0n;
  }
  const slippageBps = slippagePercentToBps(protocolSlippage);

  const pool = useQuery({
    queryKey: ["canonical-swap-pool", basket.basketId.toString(), constituent.token.address],
    enabled: Boolean(publicClient) && deploymentState.status === "configured",
    queryFn: async () => {
      if (!publicClient || deploymentState.status !== "configured") {
        throw new Error("No verified Statics deployment is configured.");
      }
      await verifyDollarDeployment(publicClient, deploymentState.deployment);
      await verifyLiquidityDeployment(publicClient, deploymentState.deployment);
      const configured = await publicClient.readContract({
        address: deploymentState.deployment.contracts.diamond,
        abi: staticsAbi,
        functionName: "canonicalPool",
        args: [basket.basketId, constituent.token.address],
      });
      const liquidity = deploymentState.deployment.liquidity;
      if (
        !liquidity ||
        getAddress(configured.hook) !== getAddress(liquidity.contracts.swapFeeHook)
      ) {
        throw new Error("Canonical pool is bound to an unexpected hook.");
      }
      const decommissioned = await publicClient.readContract({
        address: liquidity.contracts.swapFeeHook,
        abi: staticsSwapFeeHookAbi,
        functionName: "poolDecommissioned",
        args: [configured.poolId],
      });
      return { ...configured, decommissioned };
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
      Boolean(pool.data) &&
      !pool.data?.decommissioned &&
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
          amount: `Maximum ${inputToken.symbol}`,
          to: inputToken.address,
          data: buildMaximumSwapTokenApproval(liquidity.contracts.permit2),
          sendTransaction: walletState.sendEvmTransaction,
          describeError: describeBasketError,
          verifyConfirmation: async () => {
            const allowance = await publicClient.readContract({
              address: inputToken.address,
              abi: basketTokenAbi,
              functionName: "allowance",
              args: [wallet, liquidity.contracts.permit2],
            });
            if (allowance !== MAX_ERC20_ALLOWANCE) {
              throw new Error("The confirmed Permit2 token approval is not maximum.");
            }
          },
        });
        await permit2Approval.refetch();
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
      if (!hasUsablePermit2Allowance(allowance[0], allowance[1], amount, Number(block.timestamp))) {
        await executeProtocolTransaction({
          publicClient,
          wallet,
          chainId: deploymentState.deployment.chainId,
          kind: "approve-permit2",
          label: `Authorize ${inputToken.symbol} swaps`,
          amount: `Maximum ${inputToken.symbol}`,
          to: liquidity.contracts.permit2,
          data: encodeFunctionData({
            abi: permit2AllowanceAbi,
            functionName: "approve",
            args: [inputToken.address, router, MAX_PERMIT2_ALLOWANCE, MAX_PERMIT2_EXPIRATION],
          }),
          sendTransaction: walletState.sendEvmTransaction,
          describeError: describeBasketError,
          verifyConfirmation: async () => {
            const confirmed = await publicClient.readContract({
              address: liquidity.contracts.permit2,
              abi: permit2AllowanceAbi,
              functionName: "allowance",
              args: [wallet, inputToken.address, router],
            });
            if (
              !hasUsablePermit2Allowance(
                confirmed[0],
                confirmed[1],
                amount,
                Number(block.timestamp)
              )
            ) {
              throw new Error("The confirmed Permit2 swap authorization is not usable.");
            }
          },
        });
      }
      const execution = buildV4ExactInputSingleSwap({
        router,
        poolKey: currentQuote.poolKey,
        zeroForOne: currentQuote.zeroForOne,
        amountIn: amount,
        amountOutMinimum: minimumOut,
        deadline,
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
        sendTransaction: walletState.sendEvmTransaction,
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
      await Promise.all([
        quote.refetch(),
        queryClient.refetchQueries({
          queryKey: protocolQueryKeys.basketCatalog(
            deploymentState.deployment.protocolCommit,
            wallet
          ),
          exact: true,
          type: "active",
        }),
      ]);
    } catch (cause) {
      setError(describeBasketError(cause));
    } finally {
      setPending(false);
    }
  };

  const poolAvailable = Boolean(pool.data) && !pool.data?.decommissioned;
  const readError = pool.error ?? quote.error;
  let label = t("reviewSwap");
  let action: (() => void) | null = () => void submit();
  if (walletState.status === "signed-out" || walletState.status === "error") {
    label = t("signIn");
    action = walletState.login;
  } else if (walletState.status === "wallet-missing") {
    label = t("createWallet");
    action = () => void walletState.createWallet();
  } else if (walletState.status === "ready" && !walletState.isTargetChain) {
    label = t("switchNetwork", { network: walletState.networkName });
    action = () => void walletState.switchNetwork();
  } else if (walletState.status !== "ready") {
    label = t("walletLoading");
    action = null;
  } else if (!poolAvailable) {
    label = pool.isPending ? t("readingPool") : t("poolUnavailable");
  } else if (permit2Approval.isFetching) {
    label = t("readingAllowance");
  } else if ((permit2Approval.data ?? 0n) < amount) {
    label = t("enableSwaps", { symbol: inputToken.symbol });
  } else if (quote.isFetching) {
    label = t("readingQuote");
  } else if (amount > inputBalance) {
    label = t("insufficient", { symbol: inputToken.symbol });
  }

  return (
    <>
      <h3 id="basket-action-title">{t("swapTitle")}</h3>
      <label className="basket-field">
        <span>{t("underlyingPool")}</span>
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
      <div className="portal-direction-tabs" aria-label={t("swapDirection")}>
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
        <span>{t("amount", { symbol: inputToken.symbol })}</span>
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
          {t("balance", {
            amount: display(inputBalance, inputToken.decimals),
            symbol: inputToken.symbol,
          })}
        </small>
        <AmountPercentageSlider
          amount={amount}
          maximum={inputBalance}
          disabled={pending || inputBalance <= 0n}
          label={t("amountShortcuts")}
          onSelect={(percent) =>
            setAmountInput(display(applyPercent(inputBalance, percent), inputToken.decimals))
          }
        />
      </label>
      <ProtocolSlippageControl />
      <div className="basket-quote">
        <span>{t("v4Quote")}</span>
        <strong>
          {currentQuote
            ? `${display(currentQuote.amountOut, outputToken.decimals)} ${outputToken.symbol}`
            : t("enterAmount")}
        </strong>
        {minimumOut !== null && (
          <small>
            {t("minimum", {
              amount: display(minimumOut, outputToken.decimals),
              symbol: outputToken.symbol,
            })}
          </small>
        )}
      </div>
      {!poolAvailable && !pool.isPending && (
        <p className="dollar-action-reason">{t("poolInactive")}</p>
      )}
      {readError && (
        <p className="dapp-inline-error" role="alert">
          {describeBasketError(readError)} {t("retrySwap")}
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
            (!poolAvailable ||
              permit2Approval.isFetching ||
              quote.isFetching ||
              !currentQuote ||
              minimumOut === null ||
              minimumOut === 0n ||
              amount > inputBalance))
        }
      >
        {pending ? t("waiting") : label}
      </button>
    </>
  );
}
