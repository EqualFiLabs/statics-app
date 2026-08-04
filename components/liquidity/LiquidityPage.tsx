"use client";

import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
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
import { usePublicClient } from "wagmi";

import {
  basketTokenAbi,
  buildActivateLiquidityPositionCall,
  buildClaimLiquidityRewardsCall,
  buildIncreaseStakedLiquidityCall,
  buildMintV4PositionCall,
  buildPermit2ApproveCall,
  buildStakeLiquidityPositionCall,
  buildUnstakeLiquidityPositionCall,
  maximumLiquidityForAmounts,
  permit2AllowanceAbi,
  staticsAbi,
  v4PositionManagerReadAbi,
} from "@statics-protocol/sdk";

import { SurfaceEmptyState, UnconfiguredSurface } from "@/components/common/EmptyState";
import { deriveSurfaceState, isSurfaceReady } from "@/lib/surface-state";
import { readClientDollarDeployment } from "@/lib/dollar/deployment";
import {
  canonicalFullRange,
  canonicalPoolLabel,
  liquidityActivationWait,
  liquidityPositionActions,
  loadLiquidityCatalog,
  recommendedLiquidityAction,
  v4PoolId,
  type CanonicalPoolRecord,
  type LpPositionRecord,
} from "@/lib/liquidity/liquidity";
import { describePositionError } from "@/lib/positions/positions";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import {
  MAX_ERC20_ALLOWANCE,
  MAX_PERMIT2_ALLOWANCE,
  MAX_PERMIT2_EXPIRATION,
  operatorApprovalAbi,
} from "@/lib/protocol/approvals";
import { useActiveWalletClient, useWalletState } from "@/providers/wallet-context";
import { useAppLocale } from "@/i18n/client";
import { parseLocalizedUnits } from "@/lib/i18n/amounts";

const deploymentState = readClientDollarDeployment();
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

function amount(value: bigint, decimals: number): string {
  return Number(formatUnits(value, decimals)).toLocaleString(undefined, {
    maximumFractionDigits: 6,
  });
}

export function LiquidityPage() {
  const wallet = useWalletState();
  if (wallet.status === "unconfigured") return <UnconfiguredSurface subject="Liquidity" />;
  return <LiquidityRuntime />;
}

function LiquidityRuntime() {
  const locale = useAppLocale();
  const walletState = useWalletState();
  const publicClient = usePublicClient();
  const walletClient = useActiveWalletClient();
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;
  const [mode, setMode] = useState<Mode>("create");
  const [poolId, setPoolId] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [amount0, setAmount0] = useState("");
  const [amount1, setAmount1] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const catalog = useQuery({
    queryKey: ["liquidity-catalog", wallet],
    enabled:
      deploymentState.status === "configured" &&
      Boolean(deploymentState.deployment.liquidity) &&
      Boolean(publicClient) &&
      Boolean(wallet) &&
      walletState.status === "ready" &&
      walletState.isTargetChain,
    placeholderData: keepPreviousData,
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
  const amountInputsReady = (() => {
    if (!tokens) return false;
    try {
      return (
        parseLocalizedUnits(amount0, tokens[0].decimals, locale) > 0n &&
        parseLocalizedUnits(amount1, tokens[1].decimals, locale) > 0n
      );
    } catch {
      return false;
    }
  })();

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
      sendTransaction: ({ to, data: nextData, value }) =>
        walletClient.data!.sendTransaction({
          account: wallet,
          chain: walletClient.data!.chain,
          to,
          data: nextData,
          value,
        }),
      describeError: describePositionError,
      validateSimulation: options?.validateSimulation,
      verifyConfirmation: options?.verifyConfirmation,
    });
  };

  const create = async (selectedPool: CanonicalPoolRecord) => {
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
    const maximums = [
      parseLocalizedUnits(amount0, tokens[0].decimals, locale),
      parseLocalizedUnits(amount1, tokens[1].decimals, locale),
    ] as const;
    const [lower, upper] = canonicalFullRange(selectedPool.key.tickSpacing);
    const liquidity =
      (maximumLiquidityForAmounts(
        selectedPool.sqrtPriceX96,
        lower,
        upper,
        maximums[0],
        maximums[1]
      ) *
        9_950n) /
      10_000n;
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
          `${amount(required, token.decimals)} ${token.symbol}`,
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
        return;
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
          `${amount(required, token.decimals)} ${token.symbol}`,
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
        return;
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
      `${liquidity} liquidity`,
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
        return;
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
      const maximums = [
        parseLocalizedUnits(amount0, tokens[0].decimals, locale),
        parseLocalizedUnits(amount1, tokens[1].decimals, locale),
      ] as const;
      const [lower, upper] = canonicalFullRange(pool.key.tickSpacing);
      const delta =
        (maximumLiquidityForAmounts(pool.sqrtPriceX96, lower, upper, maximums[0], maximums[1]) *
          9_950n) /
        10_000n;
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
            `${amount(required, token.decimals)} ${token.symbol}`,
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
          return;
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
        `${delta} liquidity`,
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
        await create(pool);
      } else await manage();
      await catalog.refetch();
    } catch (cause) {
      setError(describePositionError(cause));
    } finally {
      setPending(false);
    }
  };

  const surfaceState =
    walletState.status === "unconfigured" ||
    deploymentState.status === "unavailable" ||
    !deploymentState.deployment.liquidity
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
  const managementReason =
    resolvedMode === "create"
      ? !pool
        ? "Select a canonical pool."
        : pool.decommissioned || !pool.managerSynced
          ? "The selected pool is not live and synced."
          : !amountInputsReady
            ? "Enter a positive maximum amount for both tokens."
            : null
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
              ? !amountInputsReady
                ? "Enter a positive maximum amount for both tokens."
                : null
              : resolvedMode === "claim"
                ? position.claimable0 === 0n && position.claimable1 === 0n
                  ? "No LP rewards are currently claimable."
                  : null
                : !position.staked
                  ? "The selected liquidity position is not staked."
                  : null;
  const actionLabels: Record<Mode, string> = {
    create: "Approve or add liquidity",
    stake: "Approve or stake LP position",
    activate: "Activate LP rewards",
    increase: "Approve or add liquidity",
    claim: "Claim LP rewards",
    unstake: "Unstake LP position",
  };
  let actionLabel = actionLabels[resolvedMode];
  let action: (() => void) | null = managementReason ? null : () => void run();
  if (walletState.status === "disconnected" || walletState.status === "error") {
    actionLabel = "Connect wallet";
    action = walletState.connectWallet;
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
                <summary>Pool diagnostics</summary>
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
                    <dt>Manager</dt>
                    <dd>{item.managerSynced ? "Synced" : "Not synced"}</dd>
                  </div>
                  <div>
                    <dt>Pending POL</dt>
                    <dd>
                      {item.pending0.toString()} / {item.pending1.toString()}
                    </dd>
                  </div>
                  <div>
                    <dt>Locked POL</dt>
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
          {catalog.data?.positions.map((item) => (
            <button
              type="button"
              key={item.tokenId.toString()}
              className={`lp-position${position?.tokenId === item.tokenId ? " is-selected" : ""}`}
              onClick={() => {
                setTokenId(item.tokenId.toString());
                setMode(recommendedLiquidityAction(item, currentBlock));
                setError(null);
              }}
            >
              <strong>Liquidity position #{item.tokenId.toString()}</strong>
              <small>
                {item.staked ? "Staked" : "Wallet-owned"} · {item.liquidity.toString()} liquidity
              </small>
              {item.staked && (
                <small>
                  Rewards: {item.claimable0.toString()} / {item.claimable1.toString()}
                </small>
              )}
            </button>
          ))}
        </section>
        <section className="remaining-workspace">
          <div className="liquidity-entry-actions">
            <button
              type="button"
              className={resolvedMode === "create" ? "active" : undefined}
              onClick={() => {
                setMode("create");
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
              {tokens?.map((token, index) => (
                <label className="basket-field" key={token.address}>
                  <span>Maximum {token.symbol}</span>
                  <input
                    inputMode="decimal"
                    value={index === 0 ? amount0 : amount1}
                    onChange={(event) => {
                      if (index === 0) setAmount0(event.target.value);
                      else setAmount1(event.target.value);
                      setError(null);
                    }}
                  />
                </label>
              ))}
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
              {resolvedMode === "increase" &&
                tokens?.map((token, index) => (
                  <label className="basket-field" key={token.address}>
                    <span>Maximum {token.symbol}</span>
                    <input
                      inputMode="decimal"
                      value={index === 0 ? amount0 : amount1}
                      onChange={(event) => {
                        if (index === 0) setAmount0(event.target.value);
                        else setAmount1(event.target.value);
                        setError(null);
                      }}
                    />
                  </label>
                ))}
              {activationWait !== null && (
                <p className="dollar-warning">
                  New liquidity becomes eligible for activation in {activationWait.toString()} block
                  {activationWait === 1n ? "" : "s"}. Existing eligible liquidity and rewards remain
                  available.
                </p>
              )}
              {position && (
                <details className="liquidity-position-diagnostics">
                  <summary>Position diagnostics</summary>
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
              )}
            </>
          )}
          {managementReason && <p className="dollar-action-reason">{managementReason}</p>}
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
