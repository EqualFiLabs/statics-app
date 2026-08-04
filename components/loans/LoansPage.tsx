"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  decodeFunctionResult,
  encodeFunctionData,
  formatUnits,
  getAddress,
  parseEventLogs,
  type Address,
  type TransactionReceipt,
} from "viem";
import { usePublicClient, useWalletClient } from "wagmi";

import {
  BasketStatus,
  basketTokenAbi,
  buildBorrowAndProvideLiquidityCall,
  buildBorrowCall,
  buildExtendCall,
  buildRecoverCall,
  buildRepayCall,
  quoteBorrowAndProvideLiquidity,
  staticsAbi,
  v4PositionManagerReadAbi,
} from "@statics-protocol/sdk";

import { AddressDisplay } from "@/components/protocol/AddressDisplay";
import { SurfaceEmptyState, UnconfiguredSurface } from "@/components/common/EmptyState";
import { deriveSurfaceState, isSurfaceReady } from "@/lib/surface-state";
import { readClientDollarDeployment, verifyDollarDeployment } from "@/lib/dollar/deployment";
import {
  basketLiquiditySnapshot,
  borrowedLiquidityDeadline,
  borrowedLiquidityReadiness,
  canonicalFullRange,
  loadLiquidityCatalog,
  type CanonicalPoolRecord,
} from "@/lib/liquidity/liquidity";
import {
  borrowableCollateral,
  deriveLoanActionAvailability,
  describeLoanError,
  hasExtensionExcess,
  isCurrentBorrowQuote,
  isCurrentExtensionQuote,
  isLoanNotFoundError,
  loadBorrowQuote,
  loadExtensionQuote,
  loadLoanCatalog,
  validateExtensionGrossAmounts,
  type BorrowQuote,
  type BorrowDestination,
  type ExtensionQuote,
  type LoanMode,
  type LoanRecord,
} from "@/lib/loans/loans";
import {
  ConfirmationVerificationError,
  executeProtocolTransaction,
} from "@/lib/protocol/transactions";
import { MAX_ERC20_ALLOWANCE } from "@/lib/protocol/approvals";
import { useWalletState } from "@/providers/wallet-context";
import { useAppLocale } from "@/i18n/client";
import type { AppLocale } from "@/i18n/config";
import { parseLocalizedUnits } from "@/lib/i18n/amounts";

const deploymentState = readClientDollarDeployment();

function displayAmount(value: bigint, decimals: number): string {
  const [whole, fraction = ""] = formatUnits(value, decimals).split(".");
  const shortFraction = fraction.slice(0, 6).replace(/0+$/, "");
  return shortFraction ? `${whole}.${shortFraction}` : whole;
}

function displayDate(timestamp: bigint, locale: AppLocale): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(Number(timestamp) * 1_000));
}

function sameVector(left: readonly bigint[], right: readonly bigint[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function parseAmountInput(value: string, decimals: number, locale: AppLocale): bigint | null {
  if (!value.trim()) return null;
  try {
    return parseLocalizedUnits(value, decimals, locale);
  } catch {
    return null;
  }
}

function parseGrossAmounts(
  values: readonly string[],
  loan: LoanRecord,
  quote: ExtensionQuote,
  locale: AppLocale
): readonly bigint[] | null {
  const amounts = quote.requiredFees.map((_, index) =>
    parseAmountInput(values[index] ?? "", loan.assets[index]?.token.decimals ?? 18, locale)
  );
  return amounts.some((amount) => amount === null) ? null : (amounts as readonly bigint[]);
}

export function LoansPage({
  initialBorrowDestination = "wallet",
}: {
  initialBorrowDestination?: BorrowDestination;
}) {
  const wallet = useWalletState();
  if (wallet.status === "unconfigured") return <UnconfiguredSurface subject="Loans" />;
  return <LoansRuntime initialBorrowDestination={initialBorrowDestination} />;
}

function LoansRuntime({
  initialBorrowDestination,
}: {
  initialBorrowDestination: BorrowDestination;
}) {
  const locale = useAppLocale();
  const walletState = useWalletState();
  const publicClient = usePublicClient();
  const walletClient = useWalletClient();
  const wallet =
    walletState.status === "ready" && walletState.address ? getAddress(walletState.address) : null;
  const [mode, setMode] = useState<LoanMode>("borrow");
  const [selectedLoanId, setSelectedLoanId] = useState("");
  const [selectedPositionId, setSelectedPositionId] = useState("");
  const [selectedBasketId, setSelectedBasketId] = useState("");
  const [sharesInput, setSharesInput] = useState("");
  const [borrowDestination, setBorrowDestination] =
    useState<BorrowDestination>(initialBorrowDestination);
  const [borrowPoolLiquidity, setBorrowPoolLiquidity] = useState<Record<string, string>>({});
  const [grossInputs, setGrossInputs] = useState<Record<string, readonly string[]>>({});
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [verificationBlocked, setVerificationBlocked] = useState(false);

  const catalog = useQuery({
    queryKey: [
      "loan-catalog",
      deploymentState.status === "configured"
        ? deploymentState.deployment.protocolCommit
        : "unconfigured",
      wallet,
    ],
    enabled:
      deploymentState.status === "configured" &&
      Boolean(publicClient) &&
      Boolean(wallet) &&
      walletState.status === "ready" &&
      walletState.isTargetChain,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!publicClient || !wallet || deploymentState.status !== "configured") {
        throw new Error("No verified Statics deployment is configured.");
      }
      await verifyDollarDeployment(publicClient, deploymentState.deployment);
      return loadLoanCatalog(publicClient, deploymentState.deployment, wallet);
    },
  });
  const liquidityCatalog = useQuery({
    queryKey: ["liquidity-catalog", wallet],
    enabled:
      mode === "borrow" &&
      borrowDestination === "liquidity" &&
      deploymentState.status === "configured" &&
      Boolean(deploymentState.deployment.liquidity) &&
      Boolean(publicClient) &&
      Boolean(wallet) &&
      walletState.status === "ready" &&
      walletState.isTargetChain,
    placeholderData: keepPreviousData,
    queryFn: () => {
      if (!publicClient || !wallet || deploymentState.status !== "configured") {
        throw new Error("No verified liquidity deployment is configured.");
      }
      return loadLiquidityCatalog(publicClient, deploymentState.deployment, wallet);
    },
  });

  const position =
    catalog.data?.positions.find((item) => item.positionId.toString() === selectedPositionId) ??
    catalog.data?.positions.find((item) => item.collateral.length > 0);
  const positionCollateral =
    position?.collateral.find((item) => item.basket.basketId.toString() === selectedBasketId) ??
    position?.collateral[0];
  const basket = positionCollateral?.basket;
  const shares = basket ? (parseAmountInput(sharesInput, basket.token.decimals, locale) ?? 0n) : 0n;
  const borrowPools =
    basket?.constituents
      .map((constituent) =>
        liquidityCatalog.data?.pools.find(
          (pool) =>
            pool.basketId === basket.basketId && pool.asset.address === constituent.token.address
        )
      )
      .filter((pool): pool is CanonicalPoolRecord => pool !== undefined) ?? [];
  const borrowLiquidityReason =
    mode !== "borrow" || borrowDestination !== "liquidity"
      ? null
      : deploymentState.status !== "configured" || !deploymentState.deployment.liquidity
        ? "Borrow-to-liquidity is not configured on this deployment."
        : liquidityCatalog.isError
          ? "Canonical pool state is unavailable."
          : !liquidityCatalog.data
            ? "Loading canonical pool state…"
            : borrowedLiquidityReadiness(basket, borrowPools, borrowPoolLiquidity);

  const ownedLoans = catalog.data?.ownedLoans ?? [];
  const recoveryLoans = [
    ...ownedLoans.filter((loan) => loan.timeline === "recoverable"),
    ...(catalog.data?.publicRecoverableLoans ?? []),
  ];
  const selectableLoans = mode === "recover" ? recoveryLoans : ownedLoans;
  const selectedLoan =
    selectableLoans.find((loan) => loan.loanId.toString() === selectedLoanId) ?? selectableLoans[0];

  const borrowQuote = useQuery({
    queryKey: ["loan-borrow-quote", basket?.basketId.toString(), shares.toString()],
    enabled:
      mode === "borrow" &&
      deploymentState.status === "configured" &&
      Boolean(publicClient) &&
      Boolean(basket) &&
      shares > 0n,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!publicClient || !basket || deploymentState.status !== "configured") {
        throw new Error("The borrow quote is unavailable.");
      }
      return loadBorrowQuote(publicClient, deploymentState.deployment, basket.basketId, shares);
    },
  });

  const extensionQuote = useQuery({
    queryKey: ["loan-extension-quote", selectedLoan?.loanId.toString()],
    enabled:
      mode === "extend" &&
      deploymentState.status === "configured" &&
      Boolean(publicClient) &&
      Boolean(selectedLoan),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!publicClient || !selectedLoan || deploymentState.status !== "configured") {
        throw new Error("The extension quote is unavailable.");
      }
      return loadExtensionQuote(publicClient, deploymentState.deployment, selectedLoan.loanId);
    },
  });

  const currentBorrowQuote = isCurrentBorrowQuote(borrowQuote.data, basket?.basketId, shares)
    ? borrowQuote.data
    : undefined;
  const currentExtensionQuote = isCurrentExtensionQuote(extensionQuote.data, selectedLoan?.loanId)
    ? extensionQuote.data
    : undefined;
  const grossValues = selectedLoan
    ? (grossInputs[selectedLoan.loanId.toString()] ??
      currentExtensionQuote?.requiredFees.map((amount, index) => {
        const token = selectedLoan.assets[index]?.token;
        return displayAmount(amount, token?.decimals ?? 18);
      }) ??
      [])
    : [];
  const parsedGross =
    selectedLoan && currentExtensionQuote
      ? parseGrossAmounts(grossValues, selectedLoan, currentExtensionQuote, locale)
      : null;
  const grossError =
    mode === "extend" && currentExtensionQuote
      ? parsedGross
        ? validateExtensionGrossAmounts(parsedGross, currentExtensionQuote.requiredFees)
        : "Enter a valid gross amount for every extension asset."
      : null;

  const requirements =
    mode === "repay"
      ? selectedLoan?.assets.map((asset) => asset.principal)
      : mode === "extend"
        ? (parsedGross ?? undefined)
        : undefined;
  const baseAction =
    selectedLoan || mode === "borrow"
      ? deriveLoanActionAvailability({
          mode,
          amount: shares,
          quoteState:
            mode === "borrow"
              ? borrowQuote.isError
                ? "error"
                : currentBorrowQuote
                  ? "ready"
                  : borrowQuote.isFetching
                    ? "refreshing"
                    : "idle"
              : mode === "extend"
                ? extensionQuote.isError
                  ? "error"
                  : currentExtensionQuote
                    ? "ready"
                    : extensionQuote.isFetching
                      ? "refreshing"
                      : "idle"
                : "ready",
          timeline: selectedLoan?.timeline,
          walletOwned: selectedLoan?.walletOwned,
          basketStatus: basket?.status,
          availableCollateral:
            position && basket ? borrowableCollateral(position, basket.basketId) : 0n,
          requirements,
          balances: selectedLoan?.assets.map((asset) => asset.walletBalance),
          allowances: selectedLoan?.assets.map((asset) => asset.allowance),
          extensionGrossError: grossError,
        })
      : {
          kind: "blocked" as const,
          label: mode === "recover" ? "No recoverable loans" : "No owned loans",
          reason:
            mode === "recover"
              ? "No loan is currently beyond its recovery grace period."
              : "This wallet does not own an open loan.",
          executable: false,
        };
  const action =
    mode === "borrow" && borrowDestination === "liquidity" && borrowLiquidityReason
      ? {
          kind: "blocked" as const,
          label: "Borrow to liquidity unavailable",
          reason: borrowLiquidityReason,
          executable: false,
        }
      : baseAction;

  const clearInteractionError = () => {
    if (!verificationBlocked) setActionError(null);
  };

  const updateMode = (nextMode: LoanMode) => {
    setMode(nextMode);
    setSelectedLoanId("");
    clearInteractionError();
  };

  const refetchVerifiedState = async () => {
    setPending(true);
    setActionError(null);
    try {
      const refreshed = await catalog.refetch();
      if (refreshed.error) throw refreshed.error;
      setVerificationBlocked(false);
    } catch (error) {
      setActionError(describeLoanError(error));
    } finally {
      setPending(false);
    }
  };

  const assertLoanClosed = async (loanId: bigint) => {
    if (!publicClient || deploymentState.status !== "configured") return;
    try {
      await publicClient.readContract({
        address: deploymentState.deployment.contracts.diamond,
        abi: staticsAbi,
        functionName: "loan",
        args: [loanId],
      });
    } catch (error) {
      if (isLoanNotFoundError(error)) return;
      throw error;
    }
    throw new Error(`Loan #${loanId.toString()} still exists after confirmation.`);
  };

  const borrowIntoLiquidity = async (
    freshPosition: NonNullable<typeof position>,
    freshBasket: NonNullable<typeof basket>,
    freshCollateral: NonNullable<typeof positionCollateral>,
    standardQuote: BorrowQuote
  ) => {
    if (
      !wallet ||
      !publicClient ||
      deploymentState.status !== "configured" ||
      !deploymentState.deployment.liquidity
    ) {
      throw new Error("Borrow-to-liquidity is not configured on this deployment.");
    }
    const refreshedLiquidity = await liquidityCatalog.refetch();
    const liquidityState = refreshedLiquidity.data;
    if (!liquidityState) {
      throw refreshedLiquidity.error ?? new Error("Fresh canonical pool state is unavailable.");
    }
    if (
      !liquidityState.positionRecords.some(
        (candidate) => candidate.positionId === freshPosition.positionId
      )
    ) {
      throw new Error("The selected position is not available to the connected wallet.");
    }
    const liquidityBasket = liquidityState.baskets.find(
      (candidate) => candidate.basketId === freshBasket.basketId
    );
    if (!liquidityBasket) throw new Error("The selected basket is unavailable to liquidity.");
    if (liquidityBasket.status !== BasketStatus.Active) {
      throw new Error("The selected basket is not active.");
    }
    const basketPools = liquidityBasket.constituents.map((constituent) => {
      const matching = liquidityState.pools.find(
        (pool) =>
          pool.basketId === liquidityBasket.basketId &&
          pool.asset.address === constituent.token.address
      );
      if (!matching) throw new Error(`No canonical pool exists for ${constituent.token.symbol}.`);
      if (matching.decommissioned || !matching.managerSynced) {
        throw new Error(`${constituent.token.symbol} pool is not ready for borrowed liquidity.`);
      }
      return matching;
    });
    const latestBlock = await publicClient.getBlock({ blockTag: "latest" });
    const deadline = borrowedLiquidityDeadline(latestBlock.timestamp);
    const poolInputs = basketPools.map((pool) => {
      const raw = borrowPoolLiquidity[pool.poolId] ?? "";
      if (!/^\d+$/.test(raw) || BigInt(raw) <= 0n) {
        throw new Error(`Enter positive raw liquidity for ${pool.asset.symbol}.`);
      }
      if (BigInt(raw) > (1n << 128n) - 1n) {
        throw new Error(`${pool.asset.symbol} liquidity exceeds the uint128 limit.`);
      }
      const [tickLower, tickUpper] = canonicalFullRange(pool.key.tickSpacing);
      return {
        asset: pool.asset.address,
        currency0: pool.key.currency0,
        currency1: pool.key.currency1,
        sqrtPriceX96: pool.sqrtPriceX96,
        tickLower,
        tickUpper,
        liquidity: BigInt(raw),
        deadline,
      };
    });
    const quote = quoteBorrowAndProvideLiquidity(
      basketLiquiditySnapshot(liquidityBasket),
      shares,
      poolInputs,
      50n
    );
    if (
      quote.borrow.feeShares !== standardQuote.feeShares ||
      quote.borrow.collateralShares !== standardQuote.collateralShares ||
      !sameVector(
        quote.borrow.principals.map((principal) => principal.amount),
        standardQuote.principals
      )
    ) {
      throw new Error("The liquidity quote does not match the current loan quote.");
    }

    let simulatedLoanId: bigint | null = null;
    let simulatedTokenIds: readonly bigint[] = [];
    const diamond = deploymentState.deployment.contracts.diamond;
    const positionManager = deploymentState.deployment.liquidity.contracts.positionManager;
    await executeProtocolTransaction({
      publicClient,
      wallet,
      chainId: deploymentState.deployment.chainId,
      kind: "borrow-liquidity",
      label: `Borrow against Position #${freshPosition.positionId.toString()} into liquidity`,
      amount: `${displayAmount(shares, freshBasket.token.decimals)} ${freshBasket.symbol}`,
      to: diamond,
      data: buildBorrowAndProvideLiquidityCall(
        freshPosition.positionId,
        freshBasket.basketId,
        shares,
        quote.pools,
        wallet
      ),
      sendTransaction: walletState.sendEvmTransaction,
      describeError: describeLoanError,
      validateSimulation: (result) => {
        if (!result) throw new Error("The borrowed-liquidity simulation returned no result.");
        const simulated = decodeFunctionResult({
          abi: staticsAbi,
          functionName: "borrowAndProvideLiquidity",
          data: result,
        });
        if (simulated[1].length !== basketPools.length) {
          throw new Error("The simulation did not create one liquidity position per underlying.");
        }
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
          (event) =>
            event.args.loanId === simulatedLoanId &&
            event.args.positionId === freshPosition.positionId &&
            event.args.basketId === freshBasket.basketId &&
            event.args.sharesIn === shares &&
            event.args.feeShares === quote.borrow.feeShares &&
            event.args.collateralShares === quote.borrow.collateralShares &&
            getAddress(event.args.receiver) === wallet
        );
        const provided = parseEventLogs({
          abi: staticsAbi,
          eventName: "BorrowedLiquidityProvided",
          logs: receipt.logs.filter((log) => getAddress(log.address) === diamond),
          strict: true,
        }).find(
          (event) =>
            event.args.loanId === simulatedLoanId &&
            event.args.positionId === freshPosition.positionId &&
            event.args.basketId === freshBasket.basketId &&
            getAddress(event.args.lpRecipient) === wallet &&
            event.args.sharesIn === shares &&
            event.args.basketSharesMinted === quote.basketSharesMinted
        );
        const minted = parseEventLogs({
          abi: staticsAbi,
          eventName: "BorrowedLiquidityPositionMinted",
          logs: receipt.logs.filter((log) => getAddress(log.address) === diamond),
          strict: true,
        }).filter((event) => event.args.loanId === simulatedLoanId);
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
            args: [freshPosition.positionId, freshBasket.basketId],
          }),
          Promise.all(
            simulatedTokenIds.map(async (tokenId) => ({
              owner: await publicClient.readContract({
                address: positionManager,
                abi: v4PositionManagerReadAbi,
                functionName: "ownerOf",
                args: [tokenId],
              }),
              liquidity: await publicClient.readContract({
                address: positionManager,
                abi: v4PositionManagerReadAbi,
                functionName: "getPositionLiquidity",
                args: [tokenId],
              }),
            }))
          ),
        ]);
        if (
          !originated ||
          !provided ||
          provided.args.v4TokenIds.length !== simulatedTokenIds.length ||
          provided.args.v4TokenIds.some((tokenId, index) => tokenId !== simulatedTokenIds[index]) ||
          minted.length !== basketPools.length ||
          basketPools.some(
            (pool, index) =>
              !minted.some(
                (event) =>
                  getAddress(event.args.asset) === pool.asset.address &&
                  event.args.v4TokenId === simulatedTokenIds[index] &&
                  getAddress(event.args.recipient) === wallet &&
                  event.args.liquidity === quote.pools[index]?.liquidity
              )
          ) ||
          loan.positionId !== freshPosition.positionId ||
          loan.basketId !== freshBasket.basketId ||
          loan.collateralShares !== quote.borrow.collateralShares ||
          loan.feeShares !== quote.borrow.feeShares ||
          loan.principals.length !== quote.borrow.principals.length ||
          loan.principals.some(
            (principal, index) => principal !== quote.borrow.principals[index]?.amount
          ) ||
          collateralAfter.depositedShares !==
            freshCollateral.depositedShares - quote.borrow.feeShares ||
          collateralAfter.lockedShares !==
            freshCollateral.lockedShares + quote.borrow.collateralShares ||
          nftState.some(
            (item, index) =>
              getAddress(item.owner) !== wallet || item.liquidity !== quote.pools[index]?.liquidity
          )
        ) {
          throw new Error(
            "The confirmed loan and liquidity positions do not match the reviewed quote."
          );
        }
      },
    });
  };

  const runAction = async () => {
    if (!wallet || !publicClient || !walletClient.data || deploymentState.status !== "configured") {
      return;
    }
    if (verificationBlocked) {
      await refetchVerifiedState();
      return;
    }
    setPending(true);
    setActionError(null);
    try {
      const refreshedResult = await catalog.refetch();
      if (!refreshedResult.data)
        throw refreshedResult.error ?? new Error("Loan state unavailable.");
      const refreshedCatalog = refreshedResult.data;
      const freshPosition =
        refreshedCatalog.positions.find((item) => item.positionId === position?.positionId) ??
        refreshedCatalog.positions.find((item) => item.collateral.length > 0);
      const freshLoan = selectedLoan
        ? [...refreshedCatalog.ownedLoans, ...refreshedCatalog.publicRecoverableLoans].find(
            (loan) => loan.loanId === selectedLoan.loanId
          )
        : undefined;

      if (mode === "borrow") {
        if (!freshPosition || !basket || shares <= 0n) {
          throw new Error("Select deposited collateral and enter basket shares.");
        }
        const freshCollateral = freshPosition.collateral.find(
          (item) => item.basket.basketId === basket.basketId
        );
        if (!freshCollateral || borrowableCollateral(freshPosition, basket.basketId) < shares) {
          throw new Error("The selected position no longer has enough unlocked collateral.");
        }
        const quote = await loadBorrowQuote(
          publicClient,
          deploymentState.deployment,
          basket.basketId,
          shares
        );
        if (borrowDestination === "liquidity") {
          await borrowIntoLiquidity(freshPosition, freshCollateral.basket, freshCollateral, quote);
          await Promise.all([catalog.refetch(), liquidityCatalog.refetch(), borrowQuote.refetch()]);
          return;
        }
        const data = buildBorrowCall(freshPosition.positionId, basket.basketId, shares, wallet);
        await executeProtocolTransaction({
          publicClient,
          wallet,
          chainId: deploymentState.deployment.chainId,
          kind: "borrow-loan",
          label: `Borrow against Position #${freshPosition.positionId.toString()}`,
          amount: `${displayAmount(shares, basket.token.decimals)} ${basket.symbol}`,
          to: deploymentState.deployment.contracts.diamond,
          data,
          sendTransaction: walletState.sendEvmTransaction,
          describeError: describeLoanError,
          validateSimulation: (result) => {
            if (!result) throw new Error("The borrow simulation returned no loan ID.");
            const [, simulatedPrincipals] = decodeFunctionResult({
              abi: staticsAbi,
              functionName: "borrow",
              data: result,
            });
            if (!sameVector(simulatedPrincipals, quote.principals)) {
              throw new Error("The borrow simulation does not match the current principal quote.");
            }
          },
          verifyConfirmation: (receipt) =>
            verifyBorrowConfirmation(
              receipt,
              quote,
              freshPosition.positionId,
              freshCollateral.depositedShares,
              freshCollateral.lockedShares
            ),
        });
      } else {
        if (!freshLoan) throw new Error("The selected loan is no longer open.");
        if (mode === "recover" && freshLoan.timeline !== "recoverable") {
          throw new Error("The selected loan is not yet recoverable.");
        }
        if (mode === "extend" && freshLoan.timeline !== "active") {
          throw new Error("The selected loan has matured and can no longer be extended.");
        }

        let currentRequirements: readonly bigint[] = [];
        let extension: ExtensionQuote | null = null;
        if (mode === "repay") {
          currentRequirements = freshLoan.assets.map((asset) => asset.principal);
        } else if (mode === "extend") {
          extension = await loadExtensionQuote(
            publicClient,
            deploymentState.deployment,
            freshLoan.loanId
          );
          if (
            extension.assets.length !== freshLoan.assets.length ||
            extension.assets.some(
              (asset, index) => asset !== freshLoan.assets[index]?.token.address
            )
          ) {
            throw new Error("The current extension asset vector no longer matches the loan.");
          }
          if (!parsedGross) throw new Error("Enter valid gross extension amounts.");
          const error = validateExtensionGrossAmounts(parsedGross, extension.requiredFees);
          if (error) throw new Error(error);
          currentRequirements = parsedGross;
        }

        const insufficientBalance = currentRequirements.findIndex(
          (amount, index) => (freshLoan.assets[index]?.walletBalance ?? 0n) < amount
        );
        if (insufficientBalance >= 0) {
          throw new Error(`The wallet lacks required asset ${insufficientBalance + 1}.`);
        }
        for (
          let approvalIndex = 0;
          approvalIndex < currentRequirements.length;
          approvalIndex += 1
        ) {
          const amount = currentRequirements[approvalIndex] ?? 0n;
          const loanAsset = freshLoan.assets[approvalIndex];
          if ((loanAsset?.allowance ?? 0n) >= amount) continue;
          if (!loanAsset || loanAsset.walletBalance < amount) {
            throw new Error(`The wallet lacks required asset ${approvalIndex + 1}.`);
          }
          const data = encodeFunctionData({
            abi: basketTokenAbi,
            functionName: "approve",
            args: [deploymentState.deployment.contracts.diamond, MAX_ERC20_ALLOWANCE],
          });
          await executeProtocolTransaction({
            publicClient,
            wallet,
            chainId: deploymentState.deployment.chainId,
            kind: "approve-loan-asset",
            label: `Approve ${loanAsset.token.symbol} for loan #${freshLoan.loanId.toString()}`,
            amount: `${displayAmount(amount, loanAsset.token.decimals)} ${loanAsset.token.symbol}`,
            to: loanAsset.token.address,
            data,
            sendTransaction: walletState.sendEvmTransaction,
            describeError: describeLoanError,
            validateSimulation: (result) => {
              if (!result) return;
              const approved = decodeFunctionResult({
                abi: basketTokenAbi,
                functionName: "approve",
                data: result,
              });
              if (!approved) throw new Error("The token simulation did not approve the amount.");
            },
            verifyConfirmation: async () => {
              const allowance = await publicClient.readContract({
                address: loanAsset.token.address,
                abi: basketTokenAbi,
                functionName: "allowance",
                args: [wallet, deploymentState.deployment.contracts.diamond],
              });
              if (allowance < amount) {
                throw new Error("The confirmed token allowance is below the required amount.");
              }
            },
          });
        }
        if (mode === "repay") {
          const collateralBefore = await publicClient.readContract({
            address: deploymentState.deployment.contracts.diamond,
            abi: staticsAbi,
            functionName: "basketCollateralPosition",
            args: [freshLoan.positionId, freshLoan.basket.basketId],
          });
          await executeProtocolTransaction({
            publicClient,
            wallet,
            chainId: deploymentState.deployment.chainId,
            kind: "repay-loan",
            label: `Repay loan #${freshLoan.loanId.toString()}`,
            amount: `${freshLoan.assets.length} principal assets`,
            to: deploymentState.deployment.contracts.diamond,
            data: buildRepayCall(freshLoan.loanId),
            sendTransaction: walletState.sendEvmTransaction,
            describeError: describeLoanError,
            verifyConfirmation: async () => {
              await assertLoanClosed(freshLoan.loanId);
              const collateralAfter = await publicClient.readContract({
                address: deploymentState.deployment.contracts.diamond,
                abi: staticsAbi,
                functionName: "basketCollateralPosition",
                args: [freshLoan.positionId, freshLoan.basket.basketId],
              });
              if (
                collateralAfter.depositedShares !== collateralBefore.depositedShares ||
                collateralAfter.lockedShares !==
                  collateralBefore.lockedShares - freshLoan.collateralShares
              ) {
                throw new Error("The repaid loan collateral did not unlock as expected.");
              }
            },
          });
        } else if (mode === "extend" && extension) {
          const maturityBefore = freshLoan.maturity;
          const principalsBefore = freshLoan.assets.map((asset) => asset.principal);
          await executeProtocolTransaction({
            publicClient,
            wallet,
            chainId: deploymentState.deployment.chainId,
            kind: "extend-loan",
            label: `Extend loan #${freshLoan.loanId.toString()}`,
            amount: `${currentRequirements.length} extension fees`,
            to: deploymentState.deployment.contracts.diamond,
            data: buildExtendCall(freshLoan.loanId, currentRequirements),
            sendTransaction: walletState.sendEvmTransaction,
            describeError: describeLoanError,
            verifyConfirmation: async () => {
              const after = await publicClient.readContract({
                address: deploymentState.deployment.contracts.diamond,
                abi: staticsAbi,
                functionName: "loan",
                args: [freshLoan.loanId],
              });
              if (
                BigInt(after.maturity) !== maturityBefore + BigInt(freshLoan.basket.loanDuration) ||
                !sameVector(after.principals, principalsBefore)
              ) {
                throw new Error("The extended loan state does not match the reviewed quote.");
              }
            },
          });
        } else if (mode === "recover") {
          const collateralBefore = await publicClient.readContract({
            address: deploymentState.deployment.contracts.diamond,
            abi: staticsAbi,
            functionName: "basketCollateralPosition",
            args: [freshLoan.positionId, freshLoan.basket.basketId],
          });
          await executeProtocolTransaction({
            publicClient,
            wallet,
            chainId: deploymentState.deployment.chainId,
            kind: "recover-loan",
            label: `Recover loan #${freshLoan.loanId.toString()}`,
            amount: `${displayAmount(
              freshLoan.collateralShares,
              freshLoan.basket.token.decimals
            )} ${freshLoan.basket.symbol}`,
            to: deploymentState.deployment.contracts.diamond,
            data: buildRecoverCall(freshLoan.loanId),
            sendTransaction: walletState.sendEvmTransaction,
            describeError: describeLoanError,
            verifyConfirmation: async () => {
              await assertLoanClosed(freshLoan.loanId);
              const collateralAfter = await publicClient.readContract({
                address: deploymentState.deployment.contracts.diamond,
                abi: staticsAbi,
                functionName: "basketCollateralPosition",
                args: [freshLoan.positionId, freshLoan.basket.basketId],
              });
              if (
                collateralAfter.depositedShares !==
                  collateralBefore.depositedShares - freshLoan.collateralShares ||
                collateralAfter.lockedShares !==
                  collateralBefore.lockedShares - freshLoan.collateralShares
              ) {
                throw new Error("Recovered collateral did not leave the position as expected.");
              }
            },
          });
        }
      }
      await catalog.refetch();
      if (mode === "borrow") await borrowQuote.refetch();
      if (mode === "extend") await extensionQuote.refetch();
    } catch (error) {
      if (error instanceof ConfirmationVerificationError) setVerificationBlocked(true);
      setActionError(describeLoanError(error));
    } finally {
      setPending(false);
    }
  };

  const verifyBorrowConfirmation = async (
    receipt: TransactionReceipt,
    quote: BorrowQuote,
    positionId: bigint,
    depositedBefore: bigint,
    lockedBefore: bigint
  ) => {
    if (!publicClient || deploymentState.status !== "configured") return;
    const logs = parseEventLogs({
      abi: staticsAbi,
      eventName: "LoanOriginated",
      logs: receipt.logs,
      strict: true,
    });
    const event = logs.find(
      (log) =>
        log.args.positionId === positionId &&
        log.args.basketId === quote.basketId &&
        log.args.sharesIn === quote.sharesIn
    );
    if (!event) throw new Error("The receipt did not contain the reviewed LoanOriginated event.");
    const [loanAfter, collateralAfter] = await Promise.all([
      publicClient.readContract({
        address: deploymentState.deployment.contracts.diamond,
        abi: staticsAbi,
        functionName: "loan",
        args: [event.args.loanId],
      }),
      publicClient.readContract({
        address: deploymentState.deployment.contracts.diamond,
        abi: staticsAbi,
        functionName: "basketCollateralPosition",
        args: [positionId, quote.basketId],
      }),
    ]);
    if (
      loanAfter.positionId !== positionId ||
      loanAfter.basketId !== quote.basketId ||
      loanAfter.collateralShares !== quote.collateralShares ||
      loanAfter.feeShares !== quote.feeShares ||
      !sameVector(loanAfter.principals, quote.principals) ||
      collateralAfter.lockedShares !== lockedBefore + quote.collateralShares ||
      collateralAfter.depositedShares !== depositedBefore - quote.feeShares ||
      event.args.feeShares !== quote.feeShares ||
      event.args.collateralShares !== quote.collateralShares
    ) {
      throw new Error("The confirmed loan state does not match the reviewed borrow quote.");
    }
  };

  if (deploymentState.status === "unavailable") {
    return (
      <SurfaceEmptyState
        state="unconfigured"
        subject="loans"
        empty={{ title: "Loans unavailable", description: "No deployment is configured." }}
      />
    );
  }

  const surfaceState = deriveSurfaceState({
    walletStatus: walletState.status,
    isTargetChain: walletState.isTargetChain,
    isLoading: catalog.isPending,
    isError: catalog.isError,
    // Owned loans plus any that are publicly recoverable.
    isEmpty:
      (catalog.data?.ownedLoans.length ?? 0) +
        (catalog.data?.publicRecoverableLoans.length ?? 0) ===
      0,
    hasData: Boolean(catalog.data),
  });

  let primaryLabel = verificationBlocked ? "Refresh protocol state" : action.label;
  let primaryAction: (() => void) | null = action.executable ? () => void runAction() : null;
  if (verificationBlocked) primaryAction = () => void refetchVerifiedState();
  if (walletState.status === "signed-out" || walletState.status === "error") {
    primaryLabel = "Sign in to continue";
    primaryAction = walletState.login;
  } else if (walletState.status === "wallet-missing") {
    primaryLabel = "Create embedded wallet";
    primaryAction = () => void walletState.createWallet();
  } else if (walletState.status === "ready" && !walletState.isTargetChain) {
    primaryLabel = `Switch to ${walletState.networkName}`;
    primaryAction = () => void walletState.switchNetwork();
  } else if (walletState.status !== "ready") {
    primaryLabel = "Wallet loading…";
    primaryAction = null;
  }

  return (
    <>
      <section className="remaining-hero" aria-labelledby="loans-title">
        <div>
          <p className="dapp-section-label">Loans</p>
          <h2 id="loans-title">Your loans</h2>
          <p>
            Each loan stands on its own, with its own collateral locked against it and its own due
            date. Repaying one does not affect the others.
          </p>
        </div>
        <dl>
          <div>
            <dt>Open loans</dt>
            <dd>{catalog.data?.ownedLoans.length ?? "—"}</dd>
          </div>
          <div>
            <dt>Principal value</dt>
            <dd>USD reference unavailable</dd>
          </div>
          <div>
            <dt>Public recoverable</dt>
            <dd>{catalog.data?.publicRecoverableLoans.length ?? "—"}</dd>
          </div>
        </dl>
      </section>

      {catalog.isFetching && catalog.data && (
        <p className="dollar-warning">Refreshing current loan and wallet state…</p>
      )}
      {catalog.data?.warnings.map((warning) => (
        <p className="dollar-warning" key={warning}>
          {warning}
        </p>
      ))}
      {catalog.isError && catalog.data && (
        <p className="dollar-warning" role="status">
          Loan data is temporarily unavailable. Showing the last received state.
        </p>
      )}
      {actionError && (
        <p className={verificationBlocked ? "dollar-warning" : "dapp-inline-error"} role="alert">
          {actionError}
        </p>
      )}

      <div className="remaining-layout">
        <section className="remaining-list" aria-label="Current loans">
          <div className="remaining-section-heading">
            <div>
              <p className="dapp-section-label">Onchain loan ledger</p>
              <h3>Independent obligations</h3>
            </div>
            <span>Block {catalog.data?.currentBlock.toString() ?? "—"}</span>
          </div>
          {!isSurfaceReady(surfaceState) ? (
            <SurfaceEmptyState
              state={surfaceState}
              subject="loans"
              onRetry={() => void catalog.refetch()}
              empty={{
                title: "You do not have any loans",
                description:
                  "Borrow against collateral you have locked in a position. Each loan stands on its own, with its own due date.",
                action: { label: "View your positions", href: "/app/positions" },
              }}
            />
          ) : (
            <>
              {catalog.data?.ownedLoans.map((loan) => (
                <LoanTrancheButton
                  key={loan.loanId.toString()}
                  loan={loan}
                  selected={selectedLoan?.loanId === loan.loanId}
                  onSelect={() => {
                    setSelectedLoanId(loan.loanId.toString());
                    clearInteractionError();
                  }}
                />
              ))}
              {Boolean(catalog.data?.publicRecoverableLoans.length) && (
                <div className="remaining-section-heading loan-queue-heading">
                  <div>
                    <p className="dapp-section-label">Recovery queue</p>
                    <h3>Non-owned recoverable loans</h3>
                  </div>
                </div>
              )}
              {catalog.data?.publicRecoverableLoans.map((loan) => (
                <LoanTrancheButton
                  key={loan.loanId.toString()}
                  loan={loan}
                  selected={selectedLoan?.loanId === loan.loanId}
                  onSelect={() => {
                    setSelectedLoanId(loan.loanId.toString());
                    setMode("recover");
                    clearInteractionError();
                  }}
                />
              ))}
            </>
          )}
        </section>

        <section className="remaining-workspace">
          <div className="remaining-section-heading">
            <div>
              <p className="dapp-section-label">Reviewed onchain action</p>
              <h3>
                {mode === "borrow" ? "New loan quote" : `Loan #${selectedLoan?.loanId ?? "—"}`}
              </h3>
            </div>
            {mode !== "borrow" && selectedLoan && (
              <span className={`remaining-status is-${selectedLoan.timeline}`}>
                {selectedLoan.timeline}
              </span>
            )}
          </div>

          <div className="dollar-tabs remaining-tabs" aria-label="Loan action">
            {(["borrow", "repay", "extend", "recover"] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={mode === item ? "active" : undefined}
                onClick={() => updateMode(item)}
                disabled={pending}
              >
                {item}
              </button>
            ))}
          </div>

          {mode === "borrow" ? (
            <BorrowFields
              catalog={catalog.data}
              positionId={position?.positionId.toString() ?? ""}
              basketId={basket?.basketId.toString() ?? ""}
              sharesInput={sharesInput}
              wallet={wallet}
              chainId={deploymentState.deployment.chainId}
              quote={currentBorrowQuote}
              destination={borrowDestination}
              liquidityAvailable={Boolean(deploymentState.deployment.liquidity)}
              liquidityPools={borrowPools}
              poolLiquidity={borrowPoolLiquidity}
              onPosition={(value) => {
                setSelectedPositionId(value);
                setSelectedBasketId("");
                clearInteractionError();
              }}
              onBasket={(value) => {
                setSelectedBasketId(value);
                clearInteractionError();
              }}
              onShares={(value) => {
                setSharesInput(value);
                clearInteractionError();
              }}
              onDestination={(value) => {
                setBorrowDestination(value);
                clearInteractionError();
              }}
              onPoolLiquidity={(poolId, value) => {
                setBorrowPoolLiquidity((current) => ({ ...current, [poolId]: value }));
                clearInteractionError();
              }}
            />
          ) : selectedLoan ? (
            <LoanDetails
              loan={selectedLoan}
              mode={mode}
              extensionQuote={currentExtensionQuote}
              grossValues={grossValues}
              chainId={deploymentState.deployment.chainId}
              onGross={(index, value) => {
                const next = [...grossValues];
                next[index] = value;
                setGrossInputs((current) => ({
                  ...current,
                  [selectedLoan.loanId.toString()]: next,
                }));
                clearInteractionError();
              }}
            />
          ) : (
            <p className="activity-empty">{action.reason}</p>
          )}

          {mode === "recover" && (
            <p className="dollar-warning">
              Recovery is permissionless only after the one-hour grace period. It is not automatic,
              and the caller receives no reward.
            </p>
          )}
          {mode === "extend" &&
            parsedGross &&
            currentExtensionQuote &&
            hasExtensionExcess(parsedGross, currentExtensionQuote.requiredFees) && (
              <p className="dollar-warning">
                Gross amounts above the current fee are credited in full to protocol rewards and are
                not refunded.
              </p>
            )}
          {action.reason && <p className="dollar-warning">{action.reason}</p>}

          <button
            type="button"
            className="dollar-submit"
            onClick={primaryAction ?? undefined}
            disabled={pending || primaryAction === null}
          >
            {pending ? "Confirming and verifying…" : primaryLabel}
          </button>
        </section>
      </div>
    </>
  );
}

function LoanTrancheButton({
  loan,
  selected,
  onSelect,
}: {
  loan: LoanRecord;
  selected: boolean;
  onSelect: () => void;
}) {
  const locale = useAppLocale();
  return (
    <button
      type="button"
      className={`loan-tranche${selected ? " is-selected" : ""}`}
      onClick={onSelect}
    >
      <span className={`remaining-status is-${loan.timeline}`}>{loan.timeline}</span>
      <strong>
        Loan #{loan.loanId.toString()} · Position #{loan.positionId.toString()}
      </strong>
      <small>
        Basket #{loan.basket.basketId.toString()} · {loan.basket.symbol}
        {!loan.walletOwned ? " · Public recovery queue" : ""}
      </small>
      <span className="loan-time">Matures {displayDate(loan.maturity, locale)}</span>
      <small>Recovery strictly after {displayDate(loan.maturity + 3_600n, locale)}</small>
    </button>
  );
}

function BorrowFields({
  catalog,
  positionId,
  basketId,
  sharesInput,
  wallet,
  chainId,
  quote,
  destination,
  liquidityAvailable,
  liquidityPools,
  poolLiquidity,
  onPosition,
  onBasket,
  onShares,
  onDestination,
  onPoolLiquidity,
}: {
  catalog: Awaited<ReturnType<typeof loadLoanCatalog>> | undefined;
  positionId: string;
  basketId: string;
  sharesInput: string;
  wallet: Address | null;
  chainId: number;
  quote: BorrowQuote | undefined;
  destination: BorrowDestination;
  liquidityAvailable: boolean;
  liquidityPools: readonly CanonicalPoolRecord[];
  poolLiquidity: Readonly<Record<string, string>>;
  onPosition: (value: string) => void;
  onBasket: (value: string) => void;
  onShares: (value: string) => void;
  onDestination: (value: BorrowDestination) => void;
  onPoolLiquidity: (poolId: string, value: string) => void;
}) {
  const position = catalog?.positions.find((item) => item.positionId.toString() === positionId);
  const collateral =
    position?.collateral.find((item) => item.basket.basketId.toString() === basketId) ??
    position?.collateral[0];
  return (
    <>
      <label className="basket-field">
        <span>Receive borrowed liquidity</span>
        <select
          value={destination}
          onChange={(event) => onDestination(event.target.value as BorrowDestination)}
        >
          <option value="wallet">In my wallet</option>
          {liquidityAvailable && (
            <option value="liquidity">As canonical Uniswap v4 liquidity</option>
          )}
        </select>
        <small>
          {destination === "wallet"
            ? "Receive every borrowed underlying directly in your wallet."
            : "Atomically pair the borrowed underlyings with newly minted basket shares and receive one LP NFT per underlying."}
        </small>
      </label>
      <div className="remaining-form-grid">
        <label className="basket-field">
          <span>Position</span>
          <select value={positionId} onChange={(event) => onPosition(event.target.value)}>
            {(catalog?.positions ?? [])
              .filter((item) => item.collateral.length > 0)
              .map((item) => (
                <option key={item.positionId.toString()} value={item.positionId.toString()}>
                  #{item.positionId.toString()}
                </option>
              ))}
          </select>
        </label>
        <label className="basket-field">
          <span>Deposited basket collateral</span>
          <select
            value={collateral?.basket.basketId.toString() ?? ""}
            onChange={(event) => onBasket(event.target.value)}
          >
            {(position?.collateral ?? []).map((item) => (
              <option key={item.basket.basketId.toString()} value={item.basket.basketId.toString()}>
                #{item.basket.basketId.toString()} · {item.basket.symbol}
              </option>
            ))}
          </select>
        </label>
        <label className="basket-field">
          <span>Basket shares in</span>
          <input
            inputMode="decimal"
            value={sharesInput}
            onChange={(event) => onShares(event.target.value)}
            placeholder="0"
          />
          <small>
            Unlocked:{" "}
            {collateral
              ? `${displayAmount(
                  collateral.depositedShares - collateral.lockedShares,
                  collateral.basket.token.decimals
                )} ${collateral.basket.symbol}`
              : "—"}
          </small>
        </label>
        <div className="basket-field">
          <span>{destination === "wallet" ? "Principal receiver" : "LP recipient"}</span>
          {wallet ? (
            <AddressDisplay address={wallet} chainId={chainId} label="Current wallet" />
          ) : (
            <small>Connect a wallet</small>
          )}
        </div>
      </div>
      {destination === "liquidity" && (
        <>
          <p className="dollar-warning">
            This locks basket collateral, originates the same loan shown below, and creates the
            canonical full-range liquidity positions atomically. Failed pool creation reverts the
            entire loan.
          </p>
          <div className="remaining-form-grid">
            {liquidityPools.map((pool) => (
              <label className="basket-field" key={pool.poolId}>
                <span>{pool.asset.symbol} pool raw liquidity</span>
                <input
                  inputMode="numeric"
                  value={poolLiquidity[pool.poolId] ?? ""}
                  onChange={(event) => onPoolLiquidity(pool.poolId, event.target.value)}
                  placeholder="0"
                />
              </label>
            ))}
          </div>
        </>
      )}
      <dl className="remaining-quote">
        <div>
          <dt>Origination fee</dt>
          <dd>
            {quote && collateral
              ? `${displayAmount(quote.feeShares, collateral.basket.token.decimals)} ${
                  collateral.basket.symbol
                }`
              : "Current quote required"}
          </dd>
        </div>
        <div>
          <dt>Locked collateral</dt>
          <dd>
            {quote && collateral
              ? `${displayAmount(quote.collateralShares, collateral.basket.token.decimals)} ${
                  collateral.basket.symbol
                }`
              : "Current quote required"}
          </dd>
        </div>
        <div>
          <dt>Maturity</dt>
          <dd>
            {collateral
              ? `${Math.round(collateral.basket.loanDuration / 86_400)} days after confirmation`
              : "—"}
          </dd>
        </div>
        <div>
          <dt>Recovery</dt>
          <dd>Strictly 1 hour after maturity</dd>
        </div>
      </dl>
      {quote && collateral && (
        <div className="principal-vector" aria-label="Borrow principal vector">
          <div>
            <span>Principal vector</span>
            <small>Fresh onchain quote</small>
          </div>
          <ul>
            {quote.assets.map((asset, index) => {
              const constituent = collateral.basket.constituents.find(
                (item) => item.token.address === asset
              );
              return (
                <li key={asset}>
                  <span>
                    {constituent?.token.symbol ?? `${asset.slice(0, 6)}…${asset.slice(-4)}`}
                  </span>
                  <strong>
                    {constituent?.token.metadataAvailable
                      ? displayAmount(quote.principals[index] ?? 0n, constituent.token.decimals)
                      : (quote.principals[index] ?? 0n).toString()}
                  </strong>
                  <small>USD reference unavailable</small>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}

function LoanDetails({
  loan,
  mode,
  extensionQuote,
  grossValues,
  chainId,
  onGross,
}: {
  loan: LoanRecord;
  mode: Exclude<LoanMode, "borrow">;
  extensionQuote: ExtensionQuote | undefined;
  grossValues: readonly string[];
  chainId: number;
  onGross: (index: number, value: string) => void;
}) {
  const locale = useAppLocale();
  return (
    <>
      <div className="loan-detail-meta">
        <AddressDisplay
          address={loan.positionOwner}
          chainId={chainId}
          label={`Position #${loan.positionId.toString()} owner`}
        />
        <p>
          Matures {displayDate(loan.maturity, locale)} · Recovery strictly after{" "}
          {displayDate(loan.maturity + 3_600n, locale)}
        </p>
      </div>
      <dl className="remaining-quote">
        <div>
          <dt>Collateral shares</dt>
          <dd>
            {displayAmount(loan.collateralShares, loan.basket.token.decimals)} {loan.basket.symbol}
          </dd>
        </div>
        <div>
          <dt>Origination fee</dt>
          <dd>{displayAmount(loan.feeShares, loan.basket.token.decimals)} shares</dd>
        </div>
      </dl>
      <div className="principal-vector" aria-label="Loan principal vector">
        <div>
          <span>{mode === "extend" ? "Extension fee vector" : "Principal vector"}</span>
          <small>{mode === "extend" ? "Editable gross inputs" : "Exact repayment amounts"}</small>
        </div>
        <ul>
          {loan.assets.map((asset, index) => (
            <li key={asset.token.address}>
              <span>{asset.token.symbol}</span>
              {mode === "extend" ? (
                <label>
                  <span className="sr-only">Gross {asset.token.symbol} amount</span>
                  <input
                    inputMode="decimal"
                    value={grossValues[index] ?? ""}
                    onChange={(event) => onGross(index, event.target.value)}
                  />
                </label>
              ) : (
                <strong>
                  {asset.token.metadataAvailable
                    ? displayAmount(asset.principal, asset.token.decimals)
                    : asset.principal.toString()}
                </strong>
              )}
              <small>
                {mode === "extend" && extensionQuote
                  ? `Required ${displayAmount(
                      extensionQuote.requiredFees[index] ?? 0n,
                      asset.token.decimals
                    )} · no refund above quote`
                  : "USD reference unavailable"}
              </small>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
