"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  decodeFunctionResult,
  encodeFunctionData,
  formatUnits,
  getAddress,
  parseEventLogs,
  type Address,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { usePublicClient, useWalletClient } from "wagmi";

import {
  basketTokenAbi,
  buildActivateLiquidityPositionCall,
  buildClaimLiquidityRewardsCall,
  buildIncreaseStakedLiquidityCall,
  buildMintV4PositionCall,
  buildPermit2ApproveCall,
  buildStakeLiquidityPositionCall,
  buildUnstakeLiquidityPositionCall,
  permit2AllowanceAbi,
  quoteRangeAmounts,
  staticsAbi,
  v4PositionManagerReadAbi,
} from "@statics-protocol/sdk";

import { SurfaceEmptyState, UnconfiguredSurface } from "@/components/common/EmptyState";
import {
  ProtocolActionScope,
  useProtocolSurface,
} from "@/components/protocol/ProtocolAvailability";
import { deriveSurfaceState, isSurfaceReady } from "@/lib/surface-state";
import {
  canonicalFullRange,
  canonicalPoolLabel,
  liquidityWalletBalances,
  liquidityActivationWait,
  liquidityPositionActions,
  loadLiquidityCatalog,
  maximumWalletLiquidityInput,
  quoteWalletLiquidity,
  recommendedLiquidityAction,
  v4PoolId,
  type CanonicalPoolRecord,
  type LiquidityTokenIndex,
  type LpPositionRecord,
  type WalletLiquidityQuote,
} from "@/lib/liquidity/liquidity";
import type { TokenMetadata } from "@/lib/baskets/baskets";
import { describePositionError } from "@/lib/positions/positions";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import {
  MAX_ERC20_ALLOWANCE,
  MAX_PERMIT2_ALLOWANCE,
  MAX_PERMIT2_EXPIRATION,
  operatorApprovalAbi,
} from "@/lib/protocol/approvals";
import { useWalletState } from "@/providers/wallet-context";
import { useAppLocale } from "@/i18n/client";
import { parseLocalizedUnits } from "@/lib/i18n/amounts";

export type Mode = "create" | "stake" | "activate" | "increase" | "claim" | "unstake";

export function lpStakeEligibility(
  position: LpPositionRecord,
  pool: CanonicalPoolRecord | undefined
): string | null {
  if (!pool || position.poolId !== pool.poolId)
    return "Select the pool for this liquidity position.";
  if (pool.decommissioned || !pool.managerSynced)
    return "The pool must be live and manager-synced.";
  const [lower, upper] = canonicalFullRange(pool.key.tickSpacing);
  if (position.hasSubscriber) return "Subscribed liquidity positions cannot be staked.";
  if (position.tickLower !== lower || position.tickUpper !== upper)
    return "Only full-range liquidity positions can be staked.";
  if (position.liquidity === 0n) return "This liquidity position is empty.";
  return null;
}

export function resolveLiquidityPool(
  mode: Mode,
  pools: readonly CanonicalPoolRecord[] | undefined,
  selectedPoolId: string,
  position: LpPositionRecord | undefined
): CanonicalPoolRecord | undefined {
  const selected = pools?.find((item) => item.poolId === selectedPoolId) ?? pools?.[0];
  if (mode === "create" || !position) return selected;
  return pools?.find((item) => item.poolId === position.poolId) ?? selected;
}

export function formatLiquidityAmount(value: bigint, decimals: number): string {
  const [whole = "0", fraction = ""] = formatUnits(value, decimals).split(".");
  const maximumFractionDigits = 6;
  const paddedFraction = fraction.padEnd(maximumFractionDigits + 1, "0");
  let roundedWhole = BigInt(whole);
  let roundedFraction = BigInt(paddedFraction.slice(0, maximumFractionDigits) || "0");
  const fractionScale = 10n ** BigInt(maximumFractionDigits);

  if (paddedFraction[maximumFractionDigits] >= "5") {
    roundedFraction += 1n;
    if (roundedFraction === fractionScale) {
      roundedWhole += 1n;
      roundedFraction = 0n;
    }
  }

  const wholeFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
  const formattedWhole = wholeFormatter.format(roundedWhole);
  const formattedFraction = roundedFraction
    .toString()
    .padStart(maximumFractionDigits, "0")
    .replace(/0+$/, "");
  if (!formattedFraction) return formattedWhole;

  const decimalSeparator =
    new Intl.NumberFormat(undefined, { minimumFractionDigits: 1 })
      .formatToParts(0.1)
      .find((part) => part.type === "decimal")?.value ?? ".";
  return `${formattedWhole}${decimalSeparator}${formattedFraction}`;
}

function positionPoolSummary(position: LpPositionRecord, pool: CanonicalPoolRecord | undefined) {
  if (!pool) return null;
  const tokens = [
    pool.key.currency0 === pool.basketToken.address ? pool.basketToken : pool.asset,
    pool.key.currency1 === pool.basketToken.address ? pool.basketToken : pool.asset,
  ] as const;
  const amounts =
    position.liquidity === 0n
      ? { amount0: 0n, amount1: 0n }
      : quoteRangeAmounts(
          pool.sqrtPriceX96,
          position.tickLower,
          position.tickUpper,
          position.liquidity
        );
  const eligiblePercent =
    position.liquidity === 0n
      ? 0
      : Number((position.eligibleLiquidity * 10_000n) / position.liquidity) / 100;
  return { tokens, amounts: [amounts.amount0, amounts.amount1] as const, eligiblePercent };
}

function inputAmount(value: bigint, decimals: number, locale: string): string {
  const formatted = formatUnits(value, decimals);
  return locale === "es" ? formatted.replace(".", ",") : formatted;
}

export function LiquidityContributionForm({
  tokens,
  balances,
  selectedIndex,
  amountInput,
  quote,
  maxLimitedBy,
  pending,
  onAmountChange,
  onSwitch,
  onMax,
}: Readonly<{
  tokens: readonly [TokenMetadata, TokenMetadata];
  balances: readonly [bigint, bigint] | null;
  selectedIndex: LiquidityTokenIndex;
  amountInput: string;
  quote: WalletLiquidityQuote | null;
  maxLimitedBy: LiquidityTokenIndex | null;
  pending: boolean;
  onAmountChange: (value: string) => void;
  onSwitch: () => void;
  onMax: () => void;
}>) {
  const selectedToken = tokens[selectedIndex];
  const otherIndex: LiquidityTokenIndex = selectedIndex === 0 ? 1 : 0;
  const otherToken = tokens[otherIndex];
  return (
    <div className="liquidity-contribution">
      <div className="basket-field">
        <label htmlFor="liquidity-contribution-amount">Supply up to</label>
        <div className="liquidity-amount-control">
          <input
            id="liquidity-contribution-amount"
            aria-label={`Maximum ${selectedToken.symbol}`}
            inputMode="decimal"
            placeholder="0.00"
            value={amountInput}
            disabled={pending}
            onChange={(event) => onAmountChange(event.target.value)}
          />
          <button
            type="button"
            className="liquidity-asset-switch"
            aria-label={`Use ${otherToken.symbol} as the input asset`}
            disabled={pending}
            onClick={onSwitch}
          >
            {selectedToken.symbol} ⇄
          </button>
          <button
            type="button"
            className="liquidity-max-button"
            disabled={pending || !balances}
            onClick={onMax}
          >
            Max
          </button>
        </div>
      </div>

      {quote && (
        <section className="liquidity-contribution-quote" aria-live="polite">
          <div className="liquidity-pair-requirement">
            <span>Paired asset required</span>
            <strong>
              Up to {formatLiquidityAmount(quote.maximumAmounts[otherIndex], otherToken.decimals)}{" "}
              {otherToken.symbol}
            </strong>
          </div>
          <div className="liquidity-quote-columns">
            <div>
              <span>Estimated deposit</span>
              <dl>
                {tokens.map((token, index) => (
                  <div key={token.address}>
                    <dt>{token.symbol}</dt>
                    <dd>{formatLiquidityAmount(quote.estimatedAmounts[index]!, token.decimals)}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div>
              <span>Maximum spend</span>
              <dl>
                {tokens.map((token, index) => (
                  <div key={token.address}>
                    <dt>{token.symbol}</dt>
                    <dd>{formatLiquidityAmount(quote.maximumAmounts[index]!, token.decimals)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
          <small>
            Maximums include a 0.50% price-movement buffer. Unused tokens stay in or return to your
            wallet.
          </small>
        </section>
      )}

      <div className="liquidity-balance-list" aria-live="polite">
        {tokens.map((token, index) => {
          const balance = balances?.[index] ?? 0n;
          const required = quote?.maximumAmounts[index] ?? 0n;
          const insufficient = Boolean(quote && balances && balance < required);
          return (
            <div
              key={token.address}
              className={
                insufficient ? "is-insufficient" : quote && balances ? "is-sufficient" : undefined
              }
            >
              <span>{token.symbol} balance</span>
              <strong>
                {balances ? formatLiquidityAmount(balance, token.decimals) : "Loading…"}
              </strong>
              {insufficient ? (
                <small>
                  Needs {formatLiquidityAmount(required - balance, token.decimals)} more
                </small>
              ) : quote && balances ? (
                <small>Sufficient</small>
              ) : null}
            </div>
          );
        })}
      </div>
      {maxLimitedBy !== null && (
        <p className="liquidity-limiting-balance" role="status">
          Maximum position is limited by your {tokens[maxLimitedBy].symbol} balance.
        </p>
      )}
    </div>
  );
}

export function LiquidityPage() {
  const wallet = useWalletState();
  if (wallet.status === "unconfigured") return <UnconfiguredSurface subject="Liquidity" />;
  return (
    <ProtocolActionScope>
      <LiquidityRuntime />
    </ProtocolActionScope>
  );
}

function LiquidityRuntime() {
  const locale = useAppLocale();
  const walletState = useWalletState();
  const publicClient = usePublicClient();
  const walletClient = useWalletClient();
  const protocol = useProtocolSurface();
  const deploymentState = { status: "configured", deployment: protocol.deployment } as const;
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;
  const [mode, setMode] = useState<Mode>("create");
  const [poolId, setPoolId] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [inputSide, setInputSide] = useState<"basket" | "asset">("basket");
  const [amountInput, setAmountInput] = useState("");
  const [maxLimitedBy, setMaxLimitedBy] = useState<LiquidityTokenIndex | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const catalog = useQuery({
    queryKey: [
      "liquidity-catalog",
      deploymentState.status === "configured" ? deploymentState.deployment.chainId : null,
      deploymentState.status === "configured"
        ? deploymentState.deployment.protocolCommit
        : "unconfigured",
      wallet,
    ],
    enabled:
      protocol.available &&
      deploymentState.status === "configured" &&
      Boolean(deploymentState.deployment.liquidity) &&
      Boolean(publicClient) &&
      Boolean(wallet) &&
      walletState.status === "ready" &&
      walletState.isTargetChain,
    queryFn: () => {
      if (!publicClient || !wallet || deploymentState.status !== "configured")
        throw new Error("No verified liquidity deployment is configured.");
      return loadLiquidityCatalog(publicClient, deploymentState.deployment, wallet);
    },
  });
  const position =
    catalog.data?.positions.find((item) => item.tokenId.toString() === tokenId) ??
    catalog.data?.positions[0];
  const currentBlock = catalog.data?.currentBlock ?? 0n;
  const manageActions = liquidityPositionActions(position, currentBlock);
  const resolvedMode: Mode =
    mode === "create"
      ? "create"
      : manageActions.includes(mode)
        ? mode
        : position
          ? recommendedLiquidityAction(position, currentBlock)
          : "create";
  const activationWait = liquidityActivationWait(position, currentBlock);
  const pool = resolveLiquidityPool(resolvedMode, catalog.data?.pools, poolId, position);
  const positionNft =
    catalog.data?.positionNftIds.find((item) => item.toString() === positionId) ??
    catalog.data?.positionNftIds[0];
  const tokens = useMemo(() => {
    if (!pool) return null;
    return [
      pool.key.currency0 === pool.basketToken.address ? pool.basketToken : pool.asset,
      pool.key.currency1 === pool.basketToken.address ? pool.basketToken : pool.asset,
    ] as const;
  }, [pool]);
  const selectedIndex: LiquidityTokenIndex =
    tokens && pool
      ? inputSide === "basket"
        ? tokens[0].address === pool.basketToken.address
          ? 0
          : 1
        : tokens[0].address === pool.asset.address
          ? 0
          : 1
      : 0;
  const balances = useMemo(
    () => (pool && catalog.data ? liquidityWalletBalances(pool, catalog.data.baskets) : null),
    [catalog.data, pool]
  );
  const parsedInput = useMemo(() => {
    if (!tokens) return null;
    try {
      return parseLocalizedUnits(amountInput, tokens[selectedIndex].decimals, locale);
    } catch {
      return null;
    }
  }, [amountInput, locale, selectedIndex, tokens]);
  const contributionQuote = useMemo(
    () =>
      pool && parsedInput !== null ? quoteWalletLiquidity(pool, selectedIndex, parsedInput) : null,
    [parsedInput, pool, selectedIndex]
  );
  const balanceShortfall: LiquidityTokenIndex | null =
    contributionQuote && balances
      ? contributionQuote.maximumAmounts[0] > balances[0]
        ? 0
        : contributionQuote.maximumAmounts[1] > balances[1]
          ? 1
          : null
      : null;

  const resetContribution = () => {
    setInputSide("basket");
    setAmountInput("");
    setMaxLimitedBy(null);
  };

  const switchContributionAsset = () => {
    if (!tokens) return;
    const otherIndex: LiquidityTokenIndex = selectedIndex === 0 ? 1 : 0;
    setAmountInput(
      contributionQuote
        ? inputAmount(
            contributionQuote.maximumAmounts[otherIndex],
            tokens[otherIndex].decimals,
            locale
          )
        : ""
    );
    setInputSide(inputSide === "basket" ? "asset" : "basket");
    setMaxLimitedBy(null);
    setError(null);
  };

  const useMaximumContribution = () => {
    if (!pool || !tokens || !balances) return;
    const maximum = maximumWalletLiquidityInput(pool, balances, selectedIndex);
    if (!maximum) {
      setError("Both pool assets need a positive wallet balance before adding liquidity.");
      return;
    }
    setAmountInput(inputAmount(maximum.inputAmount, tokens[selectedIndex].decimals, locale));
    setMaxLimitedBy(maximum.limitingIndex);
    setError(null);
  };

  const send = async (
    kind:
      | "approve-lp-token"
      | "approve-permit2"
      | "approve-lp-nft"
      | "create-lp-nft"
      | "stake-lp-nft"
      | "activate-lp-nft"
      | "increase-lp-nft"
      | "claim-lp-rewards"
      | "unstake-lp-nft",
    label: string,
    summary: string,
    to: Address,
    data: Hex,
    options?: Readonly<{
      validateSimulation?: (result: Hex | undefined) => void;
      verifyConfirmation?: (receipt: TransactionReceipt) => Promise<void>;
    }>
  ) => {
    if (!publicClient || !wallet || !walletClient.data || deploymentState.status !== "configured")
      throw new Error("Wallet client unavailable.");
    await executeProtocolTransaction({
      publicClient,
      wallet,
      chainId: deploymentState.deployment.chainId,
      kind,
      label,
      amount: summary,
      to,
      data,
      sendTransaction: walletState.sendEvmTransaction,
      describeError: describePositionError,
      validateSimulation: options?.validateSimulation,
      verifyConfirmation: options?.verifyConfirmation,
    });
  };

  const create = async (selectedPool: CanonicalPoolRecord, quote: WalletLiquidityQuote) => {
    if (
      !tokens ||
      !wallet ||
      !publicClient ||
      deploymentState.status !== "configured" ||
      !deploymentState.deployment.liquidity
    )
      return;
    if (selectedPool.decommissioned || !selectedPool.managerSynced)
      throw new Error("The pool must be live and manager-synced.");
    const maximums = quote.maximumAmounts;
    const [lower, upper] = canonicalFullRange(selectedPool.key.tickSpacing);
    const liquidity = quote.liquidity;
    if (liquidity === 0n) throw new Error("The entered amounts produce zero liquidity.");
    const contracts = deploymentState.deployment.liquidity.contracts;
    for (let index = 0; index < 2; index += 1) {
      const token = tokens[index]!;
      const required = maximums[index]!;
      const balance = await publicClient.readContract({
        address: token.address,
        abi: basketTokenAbi,
        functionName: "balanceOf",
        args: [wallet],
      });
      if (balance < required) {
        throw new Error(`The wallet does not hold enough ${token.symbol}.`);
      }
      const allowance = await publicClient.readContract({
        address: token.address,
        abi: basketTokenAbi,
        functionName: "allowance",
        args: [wallet, contracts.permit2],
      });
      if (allowance < required) {
        await send(
          "approve-lp-token",
          `Approve ${token.symbol} for Permit2`,
          `${formatLiquidityAmount(required, token.decimals)} ${token.symbol}`,
          token.address,
          encodeFunctionData({
            abi: basketTokenAbi,
            functionName: "approve",
            args: [contracts.permit2, MAX_ERC20_ALLOWANCE],
          }),
          {
            verifyConfirmation: async () => {
              const confirmed = await publicClient.readContract({
                address: token.address,
                abi: basketTokenAbi,
                functionName: "allowance",
                args: [wallet, contracts.permit2],
              });
              if (confirmed < required)
                throw new Error("The confirmed token allowance is below the reviewed amount.");
            },
          }
        );
      }
      const permit = await publicClient.readContract({
        address: contracts.permit2,
        abi: permit2AllowanceAbi,
        functionName: "allowance",
        args: [wallet, token.address, contracts.positionManager],
      });
      const now = Math.floor(Date.now() / 1000);
      if (permit[0] < required || permit[1] <= now + 60) {
        await send(
          "approve-permit2",
          `Authorize ${token.symbol} for PositionManager`,
          `${formatLiquidityAmount(required, token.decimals)} ${token.symbol}`,
          contracts.permit2,
          buildPermit2ApproveCall(
            token.address,
            contracts.positionManager,
            MAX_PERMIT2_ALLOWANCE,
            MAX_PERMIT2_EXPIRATION
          ),
          {
            verifyConfirmation: async () => {
              const confirmed = await publicClient.readContract({
                address: contracts.permit2,
                abi: permit2AllowanceAbi,
                functionName: "allowance",
                args: [wallet, token.address, contracts.positionManager],
              });
              if (confirmed[0] < required || confirmed[1] <= now + 60) {
                throw new Error("The confirmed Permit2 authorization is not usable.");
              }
            },
          }
        );
      }
    }
    const nextTokenId = await publicClient.readContract({
      address: contracts.positionManager,
      abi: v4PositionManagerReadAbi,
      functionName: "nextTokenId",
    });
    await send(
      "create-lp-nft",
      `Create ${selectedPool.basketSymbol}/${selectedPool.asset.symbol} liquidity position`,
      `${formatLiquidityAmount(quote.estimatedAmounts[0], tokens[0].decimals)} ${tokens[0].symbol} + ${formatLiquidityAmount(
        quote.estimatedAmounts[1],
        tokens[1].decimals
      )} ${tokens[1].symbol}`,
      contracts.positionManager,
      buildMintV4PositionCall({
        poolKey: selectedPool.key,
        tickLower: lower,
        tickUpper: upper,
        liquidity,
        amount0Max: maximums[0],
        amount1Max: maximums[1],
        recipient: wallet,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 1_200),
      }),
      {
        verifyConfirmation: async (receipt) => {
          const transfer = parseEventLogs({
            abi: v4PositionManagerReadAbi,
            eventName: "Transfer",
            logs: receipt.logs.filter(
              (log) => getAddress(log.address) === contracts.positionManager
            ),
            strict: true,
          }).find(
            (event) => event.args.tokenId === nextTokenId && getAddress(event.args.to) === wallet
          );
          const [owner, positionLiquidity, info, nextAfter] = await Promise.all([
            publicClient.readContract({
              address: contracts.positionManager,
              abi: v4PositionManagerReadAbi,
              functionName: "ownerOf",
              args: [nextTokenId],
            }),
            publicClient.readContract({
              address: contracts.positionManager,
              abi: v4PositionManagerReadAbi,
              functionName: "getPositionLiquidity",
              args: [nextTokenId],
            }),
            publicClient.readContract({
              address: contracts.positionManager,
              abi: v4PositionManagerReadAbi,
              functionName: "getPoolAndPositionInfo",
              args: [nextTokenId],
            }),
            publicClient.readContract({
              address: contracts.positionManager,
              abi: v4PositionManagerReadAbi,
              functionName: "nextTokenId",
            }),
          ]);
          const confirmedKey = {
            currency0: getAddress(info[0].currency0),
            currency1: getAddress(info[0].currency1),
            fee: info[0].fee,
            tickSpacing: info[0].tickSpacing,
            hooks: getAddress(info[0].hooks),
          };
          if (
            !transfer ||
            getAddress(owner) !== wallet ||
            positionLiquidity !== liquidity ||
            v4PoolId(confirmedKey) !== selectedPool.poolId ||
            nextAfter !== nextTokenId + 1n
          ) {
            throw new Error("The confirmed PositionManager NFT does not match the review.");
          }
        },
      }
    );
  };

  const manage = async () => {
    if (
      !position ||
      !positionNft ||
      !wallet ||
      !publicClient ||
      deploymentState.status !== "configured" ||
      !deploymentState.deployment.liquidity
    )
      return;
    const diamond = deploymentState.deployment.contracts.diamond;
    const positionManager = deploymentState.deployment.liquidity.contracts.positionManager;
    if (resolvedMode === "stake") {
      if (position.staked) throw new Error("The selected liquidity position is already staked.");
      const selectedPool = catalog.data?.pools.find((item) => item.poolId === position.poolId);
      const eligibility = lpStakeEligibility(position, selectedPool);
      if (eligibility) throw new Error(eligibility);
      if (getAddress(position.owner) !== wallet)
        throw new Error("The selected liquidity position is not owned by this wallet.");
      const approved = await publicClient.readContract({
        address: positionManager,
        abi: operatorApprovalAbi,
        functionName: "isApprovedForAll",
        args: [wallet, diamond],
      });
      if (!approved) {
        await send(
          "approve-lp-nft",
          "Enable Statics liquidity position management",
          "All wallet-owned liquidity positions",
          positionManager,
          encodeFunctionData({
            abi: operatorApprovalAbi,
            functionName: "setApprovalForAll",
            args: [diamond, true],
          }),
          {
            verifyConfirmation: async () => {
              const confirmed = await publicClient.readContract({
                address: positionManager,
                abi: operatorApprovalAbi,
                functionName: "isApprovedForAll",
                args: [wallet, diamond],
              });
              if (!confirmed) throw new Error("The liquidity operator approval was not confirmed.");
            },
          }
        );
      }
      await send(
        "stake-lp-nft",
        `Stake Liquidity position #${position.tokenId}`,
        `Position #${positionNft}`,
        diamond,
        buildStakeLiquidityPositionCall(positionNft, position.tokenId),
        {
          verifyConfirmation: async (receipt) => {
            const event = parseEventLogs({
              abi: staticsAbi,
              eventName: "LiquidityPositionStaked",
              logs: receipt.logs.filter((log) => getAddress(log.address) === diamond),
              strict: true,
            }).find(
              (item) =>
                item.args.positionId === positionNft &&
                item.args.tokenId === position.tokenId &&
                item.args.poolId === position.poolId &&
                item.args.liquidity === position.liquidity
            );
            const [state, owner] = await Promise.all([
              publicClient.readContract({
                address: diamond,
                abi: staticsAbi,
                functionName: "stakedLiquidityPosition",
                args: [position.tokenId],
              }),
              publicClient.readContract({
                address: positionManager,
                abi: v4PositionManagerReadAbi,
                functionName: "ownerOf",
                args: [position.tokenId],
              }),
            ]);
            if (
              !event ||
              !state.staked ||
              state.positionId !== positionNft ||
              getAddress(owner) !== diamond
            ) {
              throw new Error("The confirmed stake does not match protocol custody.");
            }
          },
        }
      );
    } else if (resolvedMode === "activate") {
      if (!position.staked || position.pendingLiquidity === 0n)
        throw new Error("This liquidity position has nothing pending.");
      if ((catalog.data?.currentBlock ?? 0n) < position.eligibleAtBlock)
        throw new Error(`Activation becomes available at block ${position.eligibleAtBlock}.`);
      await send(
        "activate-lp-nft",
        `Activate Liquidity position #${position.tokenId}`,
        `${position.pendingLiquidity} pending liquidity`,
        diamond,
        buildActivateLiquidityPositionCall(position.tokenId),
        {
          verifyConfirmation: async (receipt) => {
            const event = parseEventLogs({
              abi: staticsAbi,
              eventName: "LiquidityPositionActivated",
              logs: receipt.logs.filter((log) => getAddress(log.address) === diamond),
              strict: true,
            }).find(
              (item) =>
                item.args.positionId === position.positionId &&
                item.args.tokenId === position.tokenId &&
                item.args.liquidity === position.pendingLiquidity
            );
            const state = await publicClient.readContract({
              address: diamond,
              abi: staticsAbi,
              functionName: "stakedLiquidityPosition",
              args: [position.tokenId],
            });
            if (
              !event ||
              !state.staked ||
              state.pendingLiquidity !== 0n ||
              state.eligibleLiquidity !== position.eligibleLiquidity + position.pendingLiquidity
            ) {
              throw new Error("The confirmed activation did not move pending liquidity.");
            }
          },
        }
      );
    } else if (resolvedMode === "claim") {
      if (!position.staked && position.positionId === 0n)
        throw new Error("The selected liquidity position has no reward record.");
      const reward = await publicClient.readContract({
        account: wallet,
        address: diamond,
        abi: staticsAbi,
        functionName: "pendingLiquidityRewards",
        args: [position.positionId, position.tokenId],
      });
      if (reward[1] === 0n && reward[3] === 0n) throw new Error("No rewards are claimable.");
      const balancesBefore = await Promise.all([
        publicClient.readContract({
          address: reward[0],
          abi: basketTokenAbi,
          functionName: "balanceOf",
          args: [wallet],
        }),
        publicClient.readContract({
          address: reward[2],
          abi: basketTokenAbi,
          functionName: "balanceOf",
          args: [wallet],
        }),
      ]);
      await send(
        "claim-lp-rewards",
        `Claim Liquidity position #${position.tokenId} rewards`,
        `${reward[1]} + ${reward[3]}`,
        diamond,
        buildClaimLiquidityRewardsCall(
          position.positionId,
          position.tokenId,
          wallet,
          reward[1],
          reward[3]
        ),
        {
          validateSimulation: (result) => {
            if (!result) throw new Error("The liquidity reward simulation returned no result.");
            const claimed = decodeFunctionResult({
              abi: staticsAbi,
              functionName: "claimLiquidityRewards",
              data: result,
            });
            if (claimed[0] < reward[1] || claimed[1] < reward[3])
              throw new Error("The simulated claim fell below the reviewed minimum.");
          },
          verifyConfirmation: async (receipt) => {
            const events = parseEventLogs({
              abi: staticsAbi,
              eventName: "LiquidityRewardClaimed",
              logs: receipt.logs.filter((log) => getAddress(log.address) === diamond),
              strict: true,
            }).filter(
              (item) =>
                item.args.positionId === position.positionId &&
                item.args.tokenId === position.tokenId &&
                getAddress(item.args.receiver) === wallet
            );
            const [pendingAfter, balancesAfter] = await Promise.all([
              publicClient.readContract({
                account: wallet,
                address: diamond,
                abi: staticsAbi,
                functionName: "pendingLiquidityRewards",
                args: [position.positionId, position.tokenId],
              }),
              Promise.all([
                publicClient.readContract({
                  address: reward[0],
                  abi: basketTokenAbi,
                  functionName: "balanceOf",
                  args: [wallet],
                }),
                publicClient.readContract({
                  address: reward[2],
                  abi: basketTokenAbi,
                  functionName: "balanceOf",
                  args: [wallet],
                }),
              ]),
            ]);
            if (
              (reward[1] > 0n &&
                !events.some(
                  (item) =>
                    getAddress(item.args.asset) === getAddress(reward[0]) &&
                    item.args.amount >= reward[1]
                )) ||
              (reward[3] > 0n &&
                !events.some(
                  (item) =>
                    getAddress(item.args.asset) === getAddress(reward[2]) &&
                    item.args.amount >= reward[3]
                )) ||
              pendingAfter[1] !== 0n ||
              pendingAfter[3] !== 0n ||
              balancesAfter[0] - balancesBefore[0] < reward[1] ||
              balancesAfter[1] - balancesBefore[1] < reward[3]
            ) {
              throw new Error("The confirmed LP reward claim does not match the review.");
            }
          },
        }
      );
    } else if (resolvedMode === "increase") {
      if (!position.staked) throw new Error("Stake this liquidity position before adding to it.");
      if (!pool || !tokens) throw new Error("Select the pool for this liquidity position.");
      if (position.poolId !== pool.poolId)
        throw new Error("The selected liquidity position does not belong to the selected pool.");
      if (pool.decommissioned || !pool.managerSynced)
        throw new Error("The pool is not available for an increase.");
      if (!contributionQuote) throw new Error("Enter a valid liquidity contribution.");
      const maximums = contributionQuote.maximumAmounts;
      const delta = contributionQuote.liquidity;
      if (delta === 0n) throw new Error("The entered amounts produce zero liquidity.");
      for (let index = 0; index < 2; index += 1) {
        const token = tokens[index]!;
        const required = maximums[index]!;
        const balance = await publicClient.readContract({
          address: token.address,
          abi: basketTokenAbi,
          functionName: "balanceOf",
          args: [wallet],
        });
        if (balance < required) throw new Error(`The wallet does not hold enough ${token.symbol}.`);
        const allowance = await publicClient.readContract({
          address: token.address,
          abi: basketTokenAbi,
          functionName: "allowance",
          args: [wallet, diamond],
        });
        if (allowance < required) {
          await send(
            "approve-lp-token",
            `Approve ${token.symbol} for liquidity increase`,
            `${formatLiquidityAmount(required, token.decimals)} ${token.symbol}`,
            token.address,
            encodeFunctionData({
              abi: basketTokenAbi,
              functionName: "approve",
              args: [diamond, MAX_ERC20_ALLOWANCE],
            }),
            {
              verifyConfirmation: async () => {
                const confirmed = await publicClient.readContract({
                  address: token.address,
                  abi: basketTokenAbi,
                  functionName: "allowance",
                  args: [wallet, diamond],
                });
                if (confirmed < required)
                  throw new Error("The confirmed token allowance is below the reviewed amount.");
              },
            }
          );
        }
      }
      const liquidityBefore = await publicClient.readContract({
        address: positionManager,
        abi: v4PositionManagerReadAbi,
        functionName: "getPositionLiquidity",
        args: [position.tokenId],
      });
      await send(
        "increase-lp-nft",
        `Increase Liquidity position #${position.tokenId}`,
        `${formatLiquidityAmount(contributionQuote.estimatedAmounts[0], tokens[0].decimals)} ${tokens[0].symbol} + ${formatLiquidityAmount(
          contributionQuote.estimatedAmounts[1],
          tokens[1].decimals
        )} ${tokens[1].symbol}`,
        diamond,
        buildIncreaseStakedLiquidityCall(
          position.positionId,
          position.tokenId,
          {
            liquidityDelta: delta,
            amount0Max: maximums[0],
            amount1Max: maximums[1],
            deadline: BigInt(Math.floor(Date.now() / 1000) + 1_200),
          },
          wallet
        ),
        {
          validateSimulation: (result) => {
            if (!result) throw new Error("The liquidity increase simulation returned no result.");
            const movement = decodeFunctionResult({
              abi: staticsAbi,
              functionName: "increaseStakedLiquidity",
              data: result,
            });
            if (
              movement[0] + movement[2] > maximums[0] ||
              movement[1] + movement[3] > maximums[1]
            ) {
              throw new Error("The simulated liquidity movement exceeds its reviewed limits.");
            }
          },
          verifyConfirmation: async (receipt) => {
            const event = parseEventLogs({
              abi: staticsAbi,
              eventName: "StakedLiquidityIncreased",
              logs: receipt.logs.filter((log) => getAddress(log.address) === diamond),
              strict: true,
            }).find(
              (item) =>
                item.args.positionId === position.positionId &&
                item.args.tokenId === position.tokenId &&
                item.args.liquidityDelta === delta
            );
            const [liquidityAfter, state] = await Promise.all([
              publicClient.readContract({
                address: positionManager,
                abi: v4PositionManagerReadAbi,
                functionName: "getPositionLiquidity",
                args: [position.tokenId],
              }),
              publicClient.readContract({
                address: diamond,
                abi: staticsAbi,
                functionName: "stakedLiquidityPosition",
                args: [position.tokenId],
              }),
            ]);
            if (
              !event ||
              liquidityAfter !== liquidityBefore + delta ||
              !state.staked ||
              state.eligibleLiquidity + state.pendingLiquidity !== liquidityAfter
            ) {
              throw new Error("The confirmed liquidity does not match the review.");
            }
          },
        }
      );
    } else if (resolvedMode === "unstake") {
      if (!position.staked) throw new Error("The selected liquidity position is not staked.");
      await send(
        "unstake-lp-nft",
        `Unstake Liquidity position #${position.tokenId}`,
        `Liquidity position #${position.tokenId}`,
        diamond,
        buildUnstakeLiquidityPositionCall(position.positionId, position.tokenId, wallet),
        {
          verifyConfirmation: async (receipt) => {
            const event = parseEventLogs({
              abi: staticsAbi,
              eventName: "LiquidityPositionUnstaked",
              logs: receipt.logs.filter((log) => getAddress(log.address) === diamond),
              strict: true,
            }).find(
              (item) =>
                item.args.positionId === position.positionId &&
                item.args.tokenId === position.tokenId &&
                getAddress(item.args.receiver) === wallet
            );
            const [owner, state] = await Promise.all([
              publicClient.readContract({
                address: positionManager,
                abi: v4PositionManagerReadAbi,
                functionName: "ownerOf",
                args: [position.tokenId],
              }),
              publicClient.readContract({
                address: diamond,
                abi: staticsAbi,
                functionName: "stakedLiquidityPosition",
                args: [position.tokenId],
              }),
            ]);
            if (!event || getAddress(owner) !== wallet || state.staked) {
              throw new Error("The confirmed liquidity position was not returned to the wallet.");
            }
          },
        }
      );
    }
  };

  const run = async () => {
    setPending(true);
    setError(null);
    try {
      if (resolvedMode === "create") {
        if (!pool) throw new Error("No pool is selected.");
        if (!contributionQuote) throw new Error("Enter a valid liquidity contribution.");
        await create(pool, contributionQuote);
      } else await manage();
      await catalog.refetch();
    } catch (cause) {
      setError(describePositionError(cause));
    } finally {
      setPending(false);
    }
  };

  const surfaceState = !protocol.available
    ? "empty"
    : walletState.status === "unconfigured" || !deploymentState.deployment.liquidity
      ? "unconfigured"
      : deriveSurfaceState({
          walletStatus: walletState.status,
          isTargetChain: walletState.isTargetChain,
          isLoading: catalog.isPending,
          isError: catalog.isError,
          isEmpty: (catalog.data?.positions.length ?? 0) === 0,
          hasData: Boolean(catalog.data),
        });

  const selectedPool = position
    ? catalog.data?.pools.find((candidate) => candidate.poolId === position.poolId)
    : undefined;
  const contributionReason = (() => {
    if (!tokens) return "Select a canonical pool.";
    if (!amountInput.trim()) return `Enter a maximum ${tokens[selectedIndex].symbol} amount.`;
    if (parsedInput === null) return "Enter a valid token amount.";
    if (parsedInput <= 0n) return "Enter a positive token amount.";
    if (!contributionQuote) return "The entered amount is too small or exceeds the position limit.";
    if (!balances) return "Wallet balances are still loading.";
    if (balanceShortfall !== null) {
      const token = tokens[balanceShortfall];
      const missing =
        contributionQuote.maximumAmounts[balanceShortfall] - balances[balanceShortfall];
      return `Your wallet needs ${formatLiquidityAmount(missing, token.decimals)} more ${token.symbol}.`;
    }
    return null;
  })();
  const managementReason =
    resolvedMode === "create"
      ? !pool
        ? "Select a canonical pool."
        : pool.decommissioned || !pool.managerSynced
          ? "The selected pool is not live and synced."
          : contributionReason
      : !position
        ? "Select a liquidity position."
        : resolvedMode === "stake"
          ? !positionNft
            ? "Create or select a PositionNFT for the LP rewards."
            : lpStakeEligibility(position, selectedPool)
          : resolvedMode === "activate"
            ? position.pendingLiquidity === 0n || currentBlock < position.eligibleAtBlock
              ? `Activation becomes available at block ${position.eligibleAtBlock.toString()}.`
              : null
            : resolvedMode === "increase"
              ? contributionReason
              : resolvedMode === "claim"
                ? position.claimable0 === 0n && position.claimable1 === 0n
                  ? "No LP rewards are currently claimable."
                  : null
                : !position.staked
                  ? "The selected liquidity position is not staked."
                  : null;
  const actionLabels: Record<Mode, string> = {
    create: "Add liquidity",
    stake: "Stake LP position",
    activate: "Activate LP rewards",
    increase: "Add liquidity",
    claim: "Claim LP rewards",
    unstake: "Unstake LP position",
  };
  let actionLabel = actionLabels[resolvedMode];
  let action: (() => void) | null = managementReason ? null : () => void run();
  if (walletState.status === "signed-out" || walletState.status === "error") {
    actionLabel = "Sign in to continue";
    action = walletState.login;
  } else if (walletState.status === "wallet-missing") {
    actionLabel = "Create embedded wallet";
    action = () => void walletState.createWallet();
  } else if (walletState.status === "ready" && !walletState.isTargetChain) {
    actionLabel = `Switch to ${walletState.networkName}`;
    action = () => void walletState.switchNetwork();
  } else if (walletState.status !== "ready") {
    actionLabel = "Wallet loading…";
    action = null;
  }

  return (
    <>
      <section className="remaining-hero">
        <div>
          <p className="dapp-section-label">Liquidity</p>
          <h2>Pools and your liquidity</h2>
          <p>
            Liquidity the protocol owns permanently is kept separate from yours. Your share and the
            fees it earns are always tracked to you.
          </p>
        </div>
        <dl>
          <div>
            <dt>Pools</dt>
            <dd>{catalog.data?.pools.length ?? 0}</dd>
          </div>
          <div>
            <dt>Your liquidity</dt>
            <dd>{catalog.data?.positions.length ?? 0}</dd>
          </div>
        </dl>
      </section>
      <section className="pool-catalog">
        <h3>Pool health</h3>
        <div className="pool-grid">
          {catalog.data?.pools.map((item) => (
            <article
              key={item.poolId}
              className={pool?.poolId === item.poolId ? "is-selected" : ""}
            >
              <button
                type="button"
                className="pool-select"
                onClick={() => {
                  setPoolId(item.poolId);
                  setMode("create");
                  resetContribution();
                  setError(null);
                }}
              >
                <span className={`remaining-status is-${canonicalPoolLabel(item.decommissioned)}`}>
                  {canonicalPoolLabel(item.decommissioned)}
                </span>
                <h4>
                  {item.basketSymbol} / {item.asset.symbol}
                </h4>
                <span>
                  {Number(item.lpFee) / 10_000}% LP fee · {Number(item.hookFees.inputFeeBps) / 100}%
                  hook in
                </span>
              </button>
              <details>
                <summary>Technical details</summary>
                <dl>
                  <div>
                    <dt>Hook fee</dt>
                    <dd>
                      {Number(item.hookFees.inputFeeBps) / 100}% in ·{" "}
                      {Number(item.hookFees.outputFeeBps) / 100}% out
                    </dd>
                  </div>
                  <div>
                    <dt>Lifecycle</dt>
                    <dd>{item.decommissioned ? "Exit only" : "Live from creation"}</dd>
                  </div>
                  <div>
                    <dt>Revenue split</dt>
                    <dd>
                      {Number(item.hookFees.lockedLiquidityShareBps) / 100}% locked liquidity ·{" "}
                      {Number(item.hookFees.liquidityProviderShareBps) / 100}% LPs ·{" "}
                      {Number(item.hookFees.basketStakerShareBps) / 100}% Basket stakers ·{" "}
                      {Number(item.hookFees.staticsStakerShareBps) / 100}% STATICS stakers ·{" "}
                      {Number(item.hookFees.stonkBrokersShareBps) / 100}% StonkBrokers ·{" "}
                      {Number(item.hookFees.indexCreatorShareBps) / 100}% creator ·{" "}
                      {Number(item.hookFees.treasuryShareBps) / 100}% treasury
                    </dd>
                  </div>
                  <div>
                    <dt>Pending locked liquidity</dt>
                    <dd>
                      {formatLiquidityAmount(
                        item.pending0,
                        item.key.currency0 === item.basketToken.address
                          ? item.basketToken.decimals
                          : item.asset.decimals
                      )}{" "}
                      {item.key.currency0 === item.basketToken.address
                        ? item.basketToken.symbol
                        : item.asset.symbol}{" "}
                      /{" "}
                      {formatLiquidityAmount(
                        item.pending1,
                        item.key.currency1 === item.basketToken.address
                          ? item.basketToken.decimals
                          : item.asset.decimals
                      )}{" "}
                      {item.key.currency1 === item.basketToken.address
                        ? item.basketToken.symbol
                        : item.asset.symbol}
                    </dd>
                  </div>
                  <div>
                    <dt>Locked liquidity</dt>
                    <dd>{item.lockedLiquidity.toString()}</dd>
                  </div>
                </dl>
              </details>
            </article>
          ))}
        </div>
      </section>
      <div className="remaining-layout liquidity-layout">
        <section className="remaining-list">
          <h3>Your liquidity positions</h3>
          {!isSurfaceReady(surfaceState) && (
            <SurfaceEmptyState
              state={surfaceState}
              subject="liquidity"
              onRetry={() => void catalog.refetch()}
              empty={{
                title: "You are not providing liquidity yet",
                description:
                  "Supply a pair of assets to a pool so other people can trade, and earn a share of the trading fees.",
                action: { label: "Browse pools", href: "/app/baskets" },
              }}
            />
          )}
          {catalog.data?.positions.map((item) => {
            const itemPool = catalog.data?.pools.find(
              (candidate) => candidate.poolId === item.poolId
            );
            const summary = positionPoolSummary(item, itemPool);
            return (
              <button
                type="button"
                key={item.tokenId.toString()}
                className={`lp-position${position?.tokenId === item.tokenId ? " is-selected" : ""}`}
                onClick={() => {
                  setTokenId(item.tokenId.toString());
                  setMode(recommendedLiquidityAction(item, currentBlock));
                  resetContribution();
                  setError(null);
                }}
              >
                <strong>Liquidity position #{item.tokenId.toString()}</strong>
                <small>{item.staked ? "Staked and earning" : "In your wallet"}</small>
                {summary && (
                  <small>
                    Deposited:{" "}
                    {formatLiquidityAmount(summary.amounts[0], summary.tokens[0].decimals)}{" "}
                    {summary.tokens[0].symbol} +{" "}
                    {formatLiquidityAmount(summary.amounts[1], summary.tokens[1].decimals)}{" "}
                    {summary.tokens[1].symbol}
                  </small>
                )}
                {item.staked && summary && (
                  <small>
                    Claimable: {formatLiquidityAmount(item.claimable0, summary.tokens[0].decimals)}{" "}
                    {summary.tokens[0].symbol} +{" "}
                    {formatLiquidityAmount(item.claimable1, summary.tokens[1].decimals)}{" "}
                    {summary.tokens[1].symbol}
                  </small>
                )}
              </button>
            );
          })}
        </section>
        <section className="remaining-workspace">
          <div className="liquidity-entry-actions">
            <button
              type="button"
              className={resolvedMode === "create" ? "active" : undefined}
              onClick={() => {
                setMode("create");
                resetContribution();
                setError(null);
              }}
            >
              Add liquidity
            </button>
            <Link href="/app/loans?destination=liquidity">Borrow to LP</Link>
          </div>
          {resolvedMode !== "create" && (
            <>
              <div className="remaining-section-heading">
                <div>
                  <p className="dapp-section-label">Selected LP NFT</p>
                  <h3>Liquidity position #{position?.tokenId.toString() ?? "—"}</h3>
                </div>
                <span className={`remaining-status ${position?.staked ? "is-active" : ""}`}>
                  {position?.staked ? "earning" : "wallet-owned"}
                </span>
              </div>
              <div className="dollar-tabs liquidity-tabs" aria-label="Available LP actions">
                {manageActions.map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={resolvedMode === item ? "active" : undefined}
                    disabled={
                      item === "claim" && position?.claimable0 === 0n && position.claimable1 === 0n
                    }
                    onClick={() => {
                      setMode(item);
                      resetContribution();
                      setError(null);
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </>
          )}
          {resolvedMode === "create" ? (
            <>
              <div className="remaining-section-heading">
                <div>
                  <p className="dapp-section-label">Wallet-funded LP</p>
                  <h3>Add canonical liquidity</h3>
                </div>
              </div>
              <p>
                Supply both sides of one canonical basket pool. The resulting Uniswap v4 NFT stays
                in your wallet until you choose to stake it for Statics LP rewards.
              </p>
              <label className="basket-field">
                <span>Pool</span>
                <select
                  value={pool?.poolId ?? ""}
                  onChange={(event) => {
                    setPoolId(event.target.value);
                    resetContribution();
                    setError(null);
                  }}
                >
                  {catalog.data?.pools.map((item) => (
                    <option value={item.poolId} key={item.poolId}>
                      {item.basketSymbol} / {item.asset.symbol}
                    </option>
                  ))}
                </select>
              </label>
              {tokens && (
                <LiquidityContributionForm
                  tokens={tokens}
                  balances={balances}
                  selectedIndex={selectedIndex}
                  amountInput={amountInput}
                  quote={contributionQuote}
                  maxLimitedBy={maxLimitedBy}
                  pending={pending}
                  onAmountChange={(value) => {
                    setAmountInput(value);
                    setMaxLimitedBy(null);
                    setError(null);
                  }}
                  onSwitch={switchContributionAsset}
                  onMax={useMaximumContribution}
                />
              )}
            </>
          ) : (
            <>
              <label className="basket-field">
                <span>Liquidity position</span>
                <select
                  value={position?.tokenId.toString() ?? ""}
                  onChange={(event) => {
                    const next = catalog.data?.positions.find(
                      (item) => item.tokenId.toString() === event.target.value
                    );
                    setTokenId(event.target.value);
                    if (next) setMode(recommendedLiquidityAction(next, currentBlock));
                    resetContribution();
                    setError(null);
                  }}
                >
                  {catalog.data?.positions.map((item) => (
                    <option key={item.tokenId.toString()} value={item.tokenId.toString()}>
                      #{item.tokenId.toString()}
                    </option>
                  ))}
                </select>
              </label>
              {resolvedMode === "stake" && (
                <label className="basket-field">
                  <span>Rewards position</span>
                  <select
                    value={positionNft?.toString() ?? ""}
                    onChange={(event) => {
                      setPositionId(event.target.value);
                      setError(null);
                    }}
                  >
                    {catalog.data?.positionNftIds.map((item) => (
                      <option key={item.toString()} value={item.toString()}>
                        Position #{item.toString()}
                      </option>
                    ))}
                  </select>
                  <small>LP rewards accrue to this PositionNFT after activation.</small>
                </label>
              )}
              {resolvedMode === "increase" && tokens && (
                <LiquidityContributionForm
                  tokens={tokens}
                  balances={balances}
                  selectedIndex={selectedIndex}
                  amountInput={amountInput}
                  quote={contributionQuote}
                  maxLimitedBy={maxLimitedBy}
                  pending={pending}
                  onAmountChange={(value) => {
                    setAmountInput(value);
                    setMaxLimitedBy(null);
                    setError(null);
                  }}
                  onSwitch={switchContributionAsset}
                  onMax={useMaximumContribution}
                />
              )}
              {activationWait !== null && (
                <p className="dollar-warning">
                  New liquidity becomes eligible for activation in {activationWait.toString()} block
                  {activationWait === 1n ? "" : "s"}. Existing eligible liquidity and rewards remain
                  available.
                </p>
              )}
              {position && (
                <>
                  {(() => {
                    const summary = positionPoolSummary(position, selectedPool);
                    if (!summary) return null;
                    return (
                      <dl className="remaining-quote">
                        <div>
                          <dt>Current deposits</dt>
                          <dd>
                            {formatLiquidityAmount(summary.amounts[0], summary.tokens[0].decimals)}{" "}
                            {summary.tokens[0].symbol} +{" "}
                            {formatLiquidityAmount(summary.amounts[1], summary.tokens[1].decimals)}{" "}
                            {summary.tokens[1].symbol}
                          </dd>
                        </div>
                        <div>
                          <dt>Reward eligibility</dt>
                          <dd>{summary.eligiblePercent}% eligible</dd>
                        </div>
                        <div>
                          <dt>Claimable rewards</dt>
                          <dd>
                            {formatLiquidityAmount(position.claimable0, summary.tokens[0].decimals)}{" "}
                            {summary.tokens[0].symbol} +{" "}
                            {formatLiquidityAmount(position.claimable1, summary.tokens[1].decimals)}{" "}
                            {summary.tokens[1].symbol}
                          </dd>
                        </div>
                      </dl>
                    );
                  })()}
                  <details className="liquidity-position-diagnostics">
                    <summary>Technical details</summary>
                    <dl>
                      <div>
                        <dt>Total liquidity</dt>
                        <dd>{position.liquidity.toString()}</dd>
                      </div>
                      <div>
                        <dt>Eligible</dt>
                        <dd>{position.eligibleLiquidity.toString()}</dd>
                      </div>
                      <div>
                        <dt>Pending</dt>
                        <dd>{position.pendingLiquidity.toString()}</dd>
                      </div>
                      <div>
                        <dt>Claimable pair</dt>
                        <dd>
                          {position.claimable0.toString()} / {position.claimable1.toString()}
                        </dd>
                      </div>
                    </dl>
                  </details>
                </>
              )}
            </>
          )}
          {managementReason && <p className="dollar-action-reason">{managementReason}</p>}
          {catalog.data?.warnings.map((warning) => (
            <p className="dollar-warning" key={warning}>
              {warning}
            </p>
          ))}
          {error && (
            <p className="dapp-inline-error" role="alert">
              {error}
            </p>
          )}
          {catalog.error && catalog.data && (
            <p className="dollar-warning" role="status">
              Liquidity data is temporarily unavailable. Showing the last received state.
            </p>
          )}
          <button
            className="dollar-submit"
            type="button"
            disabled={pending || action === null}
            onClick={action ?? undefined}
          >
            {pending ? "Waiting for confirmation…" : actionLabel}
          </button>
        </section>
      </div>
      <section className="pol-boundary">
        <h3>Protocol liquidity is separate from yours</h3>
        <p>
          Liquidity the protocol owns stays locked under its own rules. Your liquidity is managed
          separately and always belongs to you.
        </p>
      </section>
    </>
  );
}
