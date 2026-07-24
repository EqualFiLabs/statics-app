"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  decodeFunctionResult,
  encodeFunctionData,
  formatUnits,
  getAddress,
  parseEventLogs,
  parseUnits,
  type Address,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { usePublicClient, useWalletClient } from "wagmi";

import {
  BasketStatus,
  basketTokenAbi,
  buildActivateLiquidityPositionCall,
  buildApproveV4PositionCall,
  buildBorrowAndProvideLiquidityCall,
  buildClaimLiquidityRewardsCall,
  buildIncreaseStakedLiquidityCall,
  buildMintV4PositionCall,
  buildPermit2ApproveCall,
  buildStakeLiquidityPositionCall,
  buildUnstakeLiquidityPositionCall,
  maximumLiquidityForAmounts,
  permit2AllowanceAbi,
  quoteBorrowAndProvideLiquidity,
  staticsAbi,
  v4PositionManagerReadAbi,
} from "@statics-protocol/sdk";

import { LiquidityPreview } from "@/components/preview/RemainingSurfacesPreview";
import { dappPreviewEnabled } from "@/lib/dapp-preview";
import { readClientDollarDeployment } from "@/lib/dollar/deployment";
import {
  basketLiquiditySnapshot,
  canonicalStatusLabel,
  loadLiquidityCatalog,
  v4PoolId,
  type CanonicalPoolRecord,
  type LpPositionRecord,
} from "@/lib/liquidity/liquidity";
import { describePositionError, unlockedCollateral } from "@/lib/positions/positions";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { useWalletState } from "@/providers/wallet-context";

const deploymentState = readClientDollarDeployment();
export type Mode = "create" | "stake" | "activate" | "increase" | "claim" | "unstake" | "borrow";

export function canonicalFullRange(spacing: number): readonly [number, number] {
  return [Math.ceil(-887_272 / spacing) * spacing, Math.floor(887_272 / spacing) * spacing];
}

export function lpStakeEligibility(
  position: LpPositionRecord,
  pool: CanonicalPoolRecord | undefined
): string | null {
  if (!pool || position.poolId !== pool.poolId) return "Select this LP NFT's canonical pool.";
  if (pool.status !== 2 || pool.decommissioned || !pool.managerSynced)
    return "The canonical pool must be active, available, and manager-synced.";
  const [lower, upper] = canonicalFullRange(pool.key.tickSpacing);
  if (position.hasSubscriber) return "Subscribed LP NFTs cannot be staked.";
  if (position.tickLower !== lower || position.tickUpper !== upper)
    return "Only full-range LP NFTs can be staked.";
  if (position.liquidity === 0n) return "The LP NFT has no liquidity.";
  return null;
}

export function resolveLiquidityPool(
  mode: Mode,
  pools: readonly CanonicalPoolRecord[] | undefined,
  selectedPoolId: string,
  position: LpPositionRecord | undefined
): CanonicalPoolRecord | undefined {
  const selected = pools?.find((item) => item.poolId === selectedPoolId) ?? pools?.[0];
  if (mode === "create" || mode === "borrow" || !position) return selected;
  return pools?.find((item) => item.poolId === position.poolId) ?? selected;
}

function amount(value: bigint, decimals: number): string {
  return Number(formatUnits(value, decimals)).toLocaleString(undefined, {
    maximumFractionDigits: 6,
  });
}

export function LiquidityPage() {
  const wallet = useWalletState();
  if (dappPreviewEnabled) return <LiquidityPreview />;
  return <LiquidityRuntime />;
}

function LiquidityRuntime() {
  const walletState = useWalletState();
  const publicClient = usePublicClient();
  const walletClient = useWalletClient();
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;
  const [mode, setMode] = useState<Mode>("create");
  const [poolId, setPoolId] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [amount0, setAmount0] = useState("");
  const [amount1, setAmount1] = useState("");
  const [borrowBasketId, setBorrowBasketId] = useState("");
  const [borrowShares, setBorrowShares] = useState("");
  const [borrowPoolLiquidity, setBorrowPoolLiquidity] = useState<Record<string, string>>({});
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
  const pool = resolveLiquidityPool(mode, catalog.data?.pools, poolId, position);
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
  const borrowBasket =
    catalog.data?.baskets.find((item) => item.basketId.toString() === borrowBasketId) ??
    catalog.data?.baskets[0];
  const selectedPositionId = positionNft?.toString() ?? "";
  const selectedBorrowBasketId = borrowBasket?.basketId.toString() ?? "";
  const borrowPools =
    borrowBasket?.constituents
      .map((constituent) =>
        catalog.data?.pools.find(
          (item) =>
            item.basketId === borrowBasket.basketId &&
            item.asset.address === constituent.token.address
        )
      )
      .filter((item): item is CanonicalPoolRecord => item !== undefined) ?? [];

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
      | "unstake-lp-nft"
      | "borrow-liquidity",
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
    if (selectedPool.status !== 2 || selectedPool.decommissioned || !selectedPool.managerSynced)
      throw new Error("The canonical pool must be active, available, and manager-synced.");
    const maximums = [
      parseUnits(amount0, tokens[0].decimals),
      parseUnits(amount1, tokens[1].decimals),
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
            args: [contracts.permit2, required],
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
          buildPermit2ApproveCall(token.address, contracts.positionManager, required, now + 3_600),
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
      `Create ${selectedPool.basketSymbol}/${selectedPool.asset.symbol} LP NFT`,
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

  const borrowIntoLiquidity = async () => {
    if (
      !wallet ||
      !publicClient ||
      !walletClient.data ||
      deploymentState.status !== "configured" ||
      !deploymentState.deployment.liquidity
    ) {
      throw new Error("Wallet client unavailable.");
    }
    const refreshed = await catalog.refetch();
    const fresh = refreshed.data;
    if (!fresh) throw new Error("Fresh liquidity state is unavailable.");
    const basket = fresh.baskets.find(
      (item) => item.basketId.toString() === selectedBorrowBasketId
    );
    const selectedPosition = fresh.positionRecords.find(
      (item) => item.positionId.toString() === selectedPositionId
    );
    if (!basket || !selectedPosition) throw new Error("Select a basket and PositionNFT.");
    if (basket.status !== BasketStatus.Active)
      throw new Error("The selected basket is not active.");
    const sharesIn = parseUnits(borrowShares, basket.token.decimals);
    if (sharesIn <= 0n) throw new Error("Enter a positive collateral amount.");
    const collateral = selectedPosition.collateral.find(
      (item) => item.basket.basketId === basket.basketId
    );
    if (!collateral || unlockedCollateral(collateral) < sharesIn) {
      throw new Error(`PositionNFT #${selectedPosition.positionId} lacks unlocked collateral.`);
    }
    const basketPools = basket.constituents.map((constituent) => {
      const matching = fresh.pools.find(
        (item) =>
          item.basketId === basket.basketId && item.asset.address === constituent.token.address
      );
      if (!matching) throw new Error(`No canonical pool exists for ${constituent.token.symbol}.`);
      if (
        matching.status !== 2 ||
        matching.decommissioned ||
        !matching.managerSynced ||
        matching.observationCardinality < 2
      ) {
        throw new Error(`${constituent.token.symbol} pool is not ready for borrowed liquidity.`);
      }
      const deviation = matching.spotTick - matching.referenceTick;
      if (deviation < -100 || deviation > 99) {
        throw new Error(`${constituent.token.symbol} pool is outside its observed price bound.`);
      }
      return matching;
    });
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1_200);
    const poolInputs = basketPools.map((item) => {
      const raw = borrowPoolLiquidity[item.poolId] ?? "";
      if (!/^\d+$/.test(raw) || BigInt(raw) <= 0n) {
        throw new Error(`Enter positive raw liquidity for ${item.asset.symbol}.`);
      }
      if (BigInt(raw) > (1n << 128n) - 1n) {
        throw new Error(`${item.asset.symbol} liquidity exceeds the uint128 limit.`);
      }
      const [tickLower, tickUpper] = canonicalFullRange(item.key.tickSpacing);
      return {
        asset: item.asset.address,
        currency0: item.key.currency0,
        currency1: item.key.currency1,
        sqrtPriceX96: item.sqrtPriceX96,
        tickLower,
        tickUpper,
        liquidity: BigInt(raw),
        deadline,
      };
    });
    const snapshot = basketLiquiditySnapshot(basket);
    const quote = quoteBorrowAndProvideLiquidity(snapshot, sharesIn, poolInputs, 50n);
    let simulatedLoanId: bigint | null = null;
    let simulatedTokenIds: readonly bigint[] = [];
    const diamond = deploymentState.deployment.contracts.diamond;
    const positionManager = deploymentState.deployment.liquidity.contracts.positionManager;
    await send(
      "borrow-liquidity",
      `Borrow ${basket.symbol} collateral into canonical liquidity`,
      `${amount(sharesIn, basket.token.decimals)} ${basket.symbol} collateral`,
      diamond,
      buildBorrowAndProvideLiquidityCall(
        selectedPosition.positionId,
        basket.basketId,
        sharesIn,
        quote.pools,
        wallet
      ),
      {
        validateSimulation: (result) => {
          if (!result) throw new Error("The borrowed-liquidity simulation returned no result.");
          const simulated = decodeFunctionResult({
            abi: staticsAbi,
            functionName: "borrowAndProvideLiquidity",
            data: result,
          });
          if (simulated[1].length !== basketPools.length)
            throw new Error("The simulation did not create one LP NFT per constituent.");
          simulatedLoanId = simulated[0];
          simulatedTokenIds = simulated[1];
        },
        verifyConfirmation: async (receipt) => {
          if (simulatedLoanId === null || simulatedTokenIds.length !== basketPools.length) {
            throw new Error("The simulated loan identity is unavailable.");
          }
          const originated = parseEventLogs({
            abi: staticsAbi,
            eventName: "LoanOriginated",
            logs: receipt.logs.filter((log) => getAddress(log.address) === diamond),
            strict: true,
          }).find(
            (item) =>
              item.args.loanId === simulatedLoanId &&
              item.args.positionId === selectedPosition.positionId &&
              item.args.basketId === basket.basketId &&
              item.args.sharesIn === sharesIn &&
              item.args.feeShares === quote.borrow.feeShares &&
              item.args.collateralShares === quote.borrow.collateralShares &&
              getAddress(item.args.receiver) === wallet
          );
          const provided = parseEventLogs({
            abi: staticsAbi,
            eventName: "BorrowedLiquidityProvided",
            logs: receipt.logs.filter((log) => getAddress(log.address) === diamond),
            strict: true,
          }).find(
            (item) =>
              item.args.loanId === simulatedLoanId &&
              item.args.positionId === selectedPosition.positionId &&
              item.args.basketId === basket.basketId &&
              getAddress(item.args.lpRecipient) === wallet &&
              item.args.sharesIn === sharesIn &&
              item.args.basketSharesMinted === quote.basketSharesMinted
          );
          const minted = parseEventLogs({
            abi: staticsAbi,
            eventName: "BorrowedLiquidityPositionMinted",
            logs: receipt.logs.filter((log) => getAddress(log.address) === diamond),
            strict: true,
          }).filter((item) => item.args.loanId === simulatedLoanId);
          const [loan, collateralAfter, nftState] = await Promise.all([
            publicClient.readContract({
              address: diamond,
              abi: staticsAbi,
              functionName: "loan",
              args: [simulatedLoanId],
            }),
            publicClient.readContract({
              address: diamond,
              abi: staticsAbi,
              functionName: "basketCollateralPosition",
              args: [selectedPosition.positionId, basket.basketId],
            }),
            Promise.all(
              simulatedTokenIds.map(async (createdTokenId) => ({
                owner: await publicClient.readContract({
                  address: positionManager,
                  abi: v4PositionManagerReadAbi,
                  functionName: "ownerOf",
                  args: [createdTokenId],
                }),
                liquidity: await publicClient.readContract({
                  address: positionManager,
                  abi: v4PositionManagerReadAbi,
                  functionName: "getPositionLiquidity",
                  args: [createdTokenId],
                }),
              }))
            ),
          ]);
          if (
            !originated ||
            !provided ||
            provided.args.v4TokenIds.length !== simulatedTokenIds.length ||
            provided.args.v4TokenIds.some(
              (createdTokenId, index) => createdTokenId !== simulatedTokenIds[index]
            ) ||
            minted.length !== basketPools.length ||
            basketPools.some(
              (item, index) =>
                !minted.some(
                  (event) =>
                    getAddress(event.args.asset) === item.asset.address &&
                    event.args.v4TokenId === simulatedTokenIds[index] &&
                    getAddress(event.args.recipient) === wallet &&
                    event.args.liquidity === quote.pools[index]?.liquidity
                )
            ) ||
            loan.positionId !== selectedPosition.positionId ||
            loan.basketId !== basket.basketId ||
            loan.collateralShares !== quote.borrow.collateralShares ||
            loan.feeShares !== quote.borrow.feeShares ||
            loan.principals.length !== quote.borrow.principals.length ||
            loan.principals.some(
              (principal, index) => principal !== quote.borrow.principals[index]?.amount
            ) ||
            collateralAfter.lockedShares !==
              collateral.lockedShares + quote.borrow.collateralShares ||
            nftState.some(
              (item, index) =>
                getAddress(item.owner) !== wallet ||
                item.liquidity !== quote.pools[index]?.liquidity
            )
          ) {
            throw new Error("The confirmed loan and LP NFTs do not match the reviewed quote.");
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
    if (mode === "stake") {
      if (position.staked) throw new Error("The selected LP NFT is already staked.");
      const selectedPool = catalog.data?.pools.find((item) => item.poolId === position.poolId);
      const eligibility = lpStakeEligibility(position, selectedPool);
      if (eligibility) throw new Error(eligibility);
      if (getAddress(position.owner) !== wallet)
        throw new Error("The selected LP NFT is not owned by this wallet.");
      const approved = await publicClient.readContract({
        address: positionManager,
        abi: v4PositionManagerReadAbi,
        functionName: "getApproved",
        args: [position.tokenId],
      });
      if (getAddress(approved) !== diamond) {
        await send(
          "approve-lp-nft",
          `Approve LP NFT #${position.tokenId}`,
          `LP NFT #${position.tokenId}`,
          positionManager,
          buildApproveV4PositionCall(diamond, position.tokenId),
          {
            verifyConfirmation: async () => {
              const confirmed = await publicClient.readContract({
                address: positionManager,
                abi: v4PositionManagerReadAbi,
                functionName: "getApproved",
                args: [position.tokenId],
              });
              if (getAddress(confirmed) !== diamond)
                throw new Error("The LP NFT approval was not confirmed.");
            },
          }
        );
        return;
      }
      await send(
        "stake-lp-nft",
        `Stake LP NFT #${position.tokenId}`,
        `PositionNFT #${positionNft}`,
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
    } else if (mode === "activate") {
      if (!position.staked || position.pendingLiquidity === 0n)
        throw new Error("The selected LP NFT has no pending liquidity.");
      if ((catalog.data?.currentBlock ?? 0n) < position.eligibleAtBlock)
        throw new Error(`Activation becomes available at block ${position.eligibleAtBlock}.`);
      await send(
        "activate-lp-nft",
        `Activate LP NFT #${position.tokenId}`,
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
    } else if (mode === "claim") {
      if (!position.staked && position.positionId === 0n)
        throw new Error("The selected LP NFT has no reward record.");
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
        `Claim LP NFT #${position.tokenId} rewards`,
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
    } else if (mode === "increase") {
      if (!position.staked) throw new Error("Stake the LP NFT before increasing its liquidity.");
      if (!pool || !tokens) throw new Error("Select the canonical pool for this LP NFT.");
      if (position.poolId !== pool.poolId)
        throw new Error("The selected LP NFT does not belong to the selected canonical pool.");
      if (pool.status !== 2 || pool.decommissioned || !pool.managerSynced)
        throw new Error("The canonical pool is not available for an increase.");
      const maximums = [
        parseUnits(amount0, tokens[0].decimals),
        parseUnits(amount1, tokens[1].decimals),
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
              args: [diamond, required],
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
        `Increase LP NFT #${position.tokenId}`,
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
              throw new Error("The confirmed LP NFT liquidity does not match the review.");
            }
          },
        }
      );
    } else if (mode === "unstake") {
      if (!position.staked) throw new Error("The selected LP NFT is not staked.");
      await send(
        "unstake-lp-nft",
        `Unstake LP NFT #${position.tokenId}`,
        `LP NFT #${position.tokenId}`,
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
              throw new Error("The confirmed LP NFT was not returned to the wallet.");
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
      if (mode === "create") {
        if (!pool) throw new Error("No canonical pool is selected.");
        await create(pool);
      } else if (mode === "borrow") {
        await borrowIntoLiquidity();
      } else await manage();
      await catalog.refetch();
    } catch (cause) {
      setError(describePositionError(cause));
    } finally {
      setPending(false);
    }
  };

  if (
    walletState.status === "unconfigured" ||
    deploymentState.status === "unavailable" ||
    !deploymentState.deployment.liquidity
  )
    return (
      <section className="dollar-unavailable">
        <h2>No verified canonical-v4 deployment is configured.</h2>
      </section>
    );

  let actionLabel = `${mode} reviewed liquidity action`;
  let action: (() => void) | null = () => void run();
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
          <p className="dapp-section-label">Chain-reconciled canonical v4 state</p>
          <h2>Pools, POL, and user LP NFTs</h2>
          <p>
            Native LP fees, bilateral hook fees, permanent liquidity, and user NFTs remain separate.
          </p>
        </div>
        <dl>
          <div>
            <dt>Canonical pools</dt>
            <dd>{catalog.data?.pools.length ?? 0}</dd>
          </div>
          <div>
            <dt>User LP NFTs</dt>
            <dd>{catalog.data?.positions.length ?? 0}</dd>
          </div>
        </dl>
      </section>
      <section className="pool-catalog">
        <h3>Canonical pool health</h3>
        <div className="pool-grid">
          {catalog.data?.pools.map((item) => (
            <button type="button" key={item.poolId} onClick={() => setPoolId(item.poolId)}>
              <span
                className={`remaining-status is-${canonicalStatusLabel(
                  item.status,
                  item.decommissioned
                )}`}
              >
                {canonicalStatusLabel(item.status, item.decommissioned)}
              </span>
              <h4>
                {item.basketSymbol} / {item.asset.symbol}
              </h4>
              <dl>
                <div>
                  <dt>Native v4 LP fee</dt>
                  <dd>{Number(item.lpFee) / 10_000}%</dd>
                </div>
                <div>
                  <dt>Bilateral hook fees</dt>
                  <dd>
                    {Number(item.hookFees.inputFeeBps) / 100}% in ·{" "}
                    {Number(item.hookFees.outputFeeBps) / 100}% out
                  </dd>
                </div>
                <div>
                  <dt>Observation</dt>
                  <dd>{item.observationCardinality} observations</dd>
                </div>
                <div>
                  <dt>Manager sync</dt>
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
            </button>
          ))}
        </div>
      </section>
      <div className="remaining-layout liquidity-layout">
        <section className="remaining-list">
          <h3>User-owned PositionManager NFTs</h3>
          {catalog.data?.positions.map((item) => (
            <button
              type="button"
              key={item.tokenId.toString()}
              className="lp-position"
              onClick={() => setTokenId(item.tokenId.toString())}
            >
              <strong>LP NFT #{item.tokenId.toString()}</strong>
              <small>
                {item.staked ? "Staked" : "Wallet-owned"} · {item.liquidity.toString()} liquidity
              </small>
            </button>
          ))}
        </section>
        <section className="remaining-workspace">
          <div className="dollar-tabs liquidity-tabs">
            {(
              ["create", "stake", "activate", "increase", "claim", "unstake", "borrow"] as const
            ).map((item) => (
              <button
                type="button"
                key={item}
                className={mode === item ? "active" : undefined}
                onClick={() => setMode(item)}
              >
                {item}
              </button>
            ))}
          </div>
          {mode === "create" ? (
            <>
              <label className="basket-field">
                <span>Canonical pool</span>
                <select
                  value={pool?.poolId ?? ""}
                  onChange={(event) => setPoolId(event.target.value)}
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
                    value={index === 0 ? amount0 : amount1}
                    onChange={(event) =>
                      index === 0 ? setAmount0(event.target.value) : setAmount1(event.target.value)
                    }
                  />
                </label>
              ))}
            </>
          ) : mode === "borrow" ? (
            <>
              <p className="dollar-warning">
                Advanced flow: locks existing basket collateral, originates a loan, mints basket
                liquidity, and creates one wallet-owned LP NFT per constituent atomically.
              </p>
              <label className="basket-field">
                <span>Collateral PositionNFT</span>
                <select
                  value={positionNft?.toString() ?? ""}
                  onChange={(event) => setPositionId(event.target.value)}
                >
                  {catalog.data?.positionNftIds.map((item) => (
                    <option key={item.toString()} value={item.toString()}>
                      #{item.toString()}
                    </option>
                  ))}
                </select>
              </label>
              <label className="basket-field">
                <span>Basket collateral</span>
                <select
                  value={borrowBasket?.basketId.toString() ?? ""}
                  onChange={(event) => setBorrowBasketId(event.target.value)}
                >
                  {catalog.data?.baskets.map((item) => (
                    <option key={item.basketId.toString()} value={item.basketId.toString()}>
                      {item.symbol}
                    </option>
                  ))}
                </select>
              </label>
              <label className="basket-field">
                <span>Basket shares to lock</span>
                <input
                  inputMode="decimal"
                  value={borrowShares}
                  onChange={(event) => setBorrowShares(event.target.value)}
                />
              </label>
              {borrowPools.map((item) => (
                <label className="basket-field" key={item.poolId}>
                  <span>{item.asset.symbol} pool raw liquidity</span>
                  <input
                    inputMode="numeric"
                    value={borrowPoolLiquidity[item.poolId] ?? ""}
                    onChange={(event) =>
                      setBorrowPoolLiquidity((current) => ({
                        ...current,
                        [item.poolId]: event.target.value,
                      }))
                    }
                  />
                </label>
              ))}
            </>
          ) : (
            <>
              <label className="basket-field">
                <span>LP NFT</span>
                <select
                  value={position?.tokenId.toString() ?? ""}
                  onChange={(event) => setTokenId(event.target.value)}
                >
                  {catalog.data?.positions.map((item) => (
                    <option key={item.tokenId.toString()} value={item.tokenId.toString()}>
                      #{item.tokenId.toString()}
                    </option>
                  ))}
                </select>
              </label>
              {mode === "stake" && (
                <label className="basket-field">
                  <span>PositionNFT</span>
                  <select
                    value={positionNft?.toString() ?? ""}
                    onChange={(event) => setPositionId(event.target.value)}
                  >
                    {catalog.data?.positionNftIds.map((item) => (
                      <option key={item.toString()} value={item.toString()}>
                        #{item.toString()}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {mode === "increase" &&
                tokens?.map((token, index) => (
                  <label className="basket-field" key={token.address}>
                    <span>Maximum {token.symbol}</span>
                    <input
                      value={index === 0 ? amount0 : amount1}
                      onChange={(event) =>
                        index === 0
                          ? setAmount0(event.target.value)
                          : setAmount1(event.target.value)
                      }
                    />
                  </label>
                ))}
            </>
          )}
          {mode !== "borrow" && (
            <p className="dollar-warning">
              Only nonzero, unsubscribed, full-range NFTs qualify. Activation begins on the next
              block; unstaking has no cooldown.
            </p>
          )}
          {error && (
            <p className="dapp-inline-error" role="alert">
              {error}
            </p>
          )}
          {catalog.error && (
            <p className="dapp-inline-error" role="alert">
              {describePositionError(catalog.error)}
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
        <h3>Permanent liquidity is not a user LP position</h3>
        <p>
          Hook-owned POL remains locked under protocol lifecycle rules. User PositionManager NFTs
          remain separately managed.
        </p>
      </section>
    </>
  );
}
