"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
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
  basketTokenAbi,
  buildBorrowCall,
  buildExtendCall,
  buildRecoverCall,
  buildRepayCall,
  staticsAbi,
} from "@statics-protocol/sdk";

import { AddressDisplay } from "@/components/protocol/AddressDisplay";
import { LoansPreview } from "@/components/preview/RemainingSurfacesPreview";
import { dappPreviewEnabled } from "@/lib/dapp-preview";
import { readClientDollarDeployment, verifyDollarDeployment } from "@/lib/dollar/deployment";
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
  type ExtensionQuote,
  type LoanMode,
  type LoanRecord,
} from "@/lib/loans/loans";
import {
  ConfirmationVerificationError,
  executeProtocolTransaction,
} from "@/lib/protocol/transactions";
import { useWalletState } from "@/providers/wallet-context";

const deploymentState = readClientDollarDeployment();

function displayAmount(value: bigint, decimals: number): string {
  const [whole, fraction = ""] = formatUnits(value, decimals).split(".");
  const shortFraction = fraction.slice(0, 6).replace(/0+$/, "");
  return shortFraction ? `${whole}.${shortFraction}` : whole;
}

function displayDate(timestamp: bigint): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(Number(timestamp) * 1_000));
}

function sameVector(left: readonly bigint[], right: readonly bigint[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function parseAmountInput(value: string, decimals: number): bigint | null {
  if (!value.trim()) return null;
  try {
    return parseUnits(value, decimals);
  } catch {
    return null;
  }
}

function parseGrossAmounts(
  values: readonly string[],
  loan: LoanRecord,
  quote: ExtensionQuote
): readonly bigint[] | null {
  const amounts = quote.requiredFees.map((_, index) =>
    parseAmountInput(values[index] ?? "", loan.assets[index]?.token.decimals ?? 18)
  );
  return amounts.some((amount) => amount === null) ? null : (amounts as readonly bigint[]);
}

export function LoansPage() {
  const wallet = useWalletState();
  if (dappPreviewEnabled) {
    return <LoansPreview />;
  }
  if (wallet.status === "unconfigured") return <LoansPreview />;
  return <LoansRuntime />;
}

function LoansRuntime() {
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

  const position =
    catalog.data?.positions.find((item) => item.positionId.toString() === selectedPositionId) ??
    catalog.data?.positions.find((item) => item.collateral.length > 0);
  const positionCollateral =
    position?.collateral.find((item) => item.basket.basketId.toString() === selectedBasketId) ??
    position?.collateral[0];
  const basket = positionCollateral?.basket;
  const shares = basket ? (parseAmountInput(sharesInput, basket.token.decimals) ?? 0n) : 0n;

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
      ? parseGrossAmounts(grossValues, selectedLoan, currentExtensionQuote)
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
  const action =
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
              ? "No tranche is currently beyond its recovery grace period."
              : "This wallet does not own an open loan.",
          executable: false,
        };

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

  const send = (to: Address, data: Hex, value?: bigint) => {
    if (!walletClient.data || !wallet) throw new Error("The wallet client is unavailable.");
    return walletClient.data.sendTransaction({
      account: wallet,
      chain: walletClient.data.chain,
      to,
      data,
      value,
    });
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
          throw new Error("The selected PositionNFT no longer has enough unlocked collateral.");
        }
        const quote = await loadBorrowQuote(
          publicClient,
          deploymentState.deployment,
          basket.basketId,
          shares
        );
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
          sendTransaction: ({ to, data: transactionData, value }) =>
            send(to, transactionData, value),
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
        const approvalIndex = currentRequirements.findIndex(
          (amount, index) => (freshLoan.assets[index]?.allowance ?? 0n) < amount
        );
        if (approvalIndex >= 0) {
          const loanAsset = freshLoan.assets[approvalIndex];
          const amount = currentRequirements[approvalIndex] ?? 0n;
          if (!loanAsset || loanAsset.walletBalance < amount) {
            throw new Error(`The wallet lacks required asset ${approvalIndex + 1}.`);
          }
          const data = encodeFunctionData({
            abi: basketTokenAbi,
            functionName: "approve",
            args: [deploymentState.deployment.contracts.diamond, amount],
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
            sendTransaction: ({ to, data: transactionData, value }) =>
              send(to, transactionData, value),
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
              if (allowance !== amount) {
                throw new Error("The confirmed token allowance is not the exact requested amount.");
              }
            },
          });
        } else if (mode === "repay") {
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
            sendTransaction: ({ to, data: transactionData, value }) =>
              send(to, transactionData, value),
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
            sendTransaction: ({ to, data: transactionData, value }) =>
              send(to, transactionData, value),
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
            sendTransaction: ({ to, data: transactionData, value }) =>
              send(to, transactionData, value),
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
                throw new Error("Recovered collateral did not leave the PositionNFT as expected.");
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

  if (
    deploymentState.status === "unavailable" ||
    !wallet ||
    !walletState.isTargetChain ||
    (catalog.isPending && !catalog.data) ||
    (catalog.isError && !catalog.data)
  ) {
    return <LoansPreview />;
  }

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

  const displayLoans = [
    ...(catalog.data?.ownedLoans ?? []),
    ...(catalog.data?.publicRecoverableLoans ?? []),
  ];

  return (
    <>
      <section className="remaining-hero" aria-labelledby="loans-title">
        <div>
          <p className="dapp-section-label">Event-discovered · state-reconciled</p>
          <h2 id="loans-title">Position-owned loans</h2>
          <p>
            Each borrow creates an independent principal vector, locked BasketToken collateral,
            maturity, and permissionless recovery schedule.
          </p>
        </div>
        <dl>
          <div>
            <dt>Owned open tranches</dt>
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
        <section className="remaining-list" aria-label="Current loan tranches">
          <div className="remaining-section-heading">
            <div>
              <p className="dapp-section-label">Onchain loan ledger</p>
              <h3>Independent obligations</h3>
            </div>
            <span>Block {catalog.data?.currentBlock.toString() ?? "—"}</span>
          </div>
          {catalog.isPending && wallet ? (
            <p className="dollar-loading">Reconciling current loans…</p>
          ) : displayLoans.length === 0 ? (
            <p className="activity-empty">No open loan events reconcile to current state.</p>
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
                    <p className="dapp-section-label">Permissionless recovery queue</p>
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
      <span className="loan-time">Matures {displayDate(loan.maturity)}</span>
      <small>Recovery strictly after {displayDate(loan.maturity + 3_600n)}</small>
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
  onPosition,
  onBasket,
  onShares,
}: {
  catalog: Awaited<ReturnType<typeof loadLoanCatalog>> | undefined;
  positionId: string;
  basketId: string;
  sharesInput: string;
  wallet: Address | null;
  chainId: number;
  quote: BorrowQuote | undefined;
  onPosition: (value: string) => void;
  onBasket: (value: string) => void;
  onShares: (value: string) => void;
}) {
  const position = catalog?.positions.find((item) => item.positionId.toString() === positionId);
  const collateral =
    position?.collateral.find((item) => item.basket.basketId.toString() === basketId) ??
    position?.collateral[0];
  return (
    <>
      <div className="remaining-form-grid">
        <label className="basket-field">
          <span>PositionNFT</span>
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
          <span>Principal receiver</span>
          {wallet ? (
            <AddressDisplay address={wallet} chainId={chainId} label="Current wallet" />
          ) : (
            <small>Connect a wallet</small>
          )}
        </div>
      </div>
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
  return (
    <>
      <div className="loan-detail-meta">
        <AddressDisplay
          address={loan.positionOwner}
          chainId={chainId}
          label={`PositionNFT #${loan.positionId.toString()} owner`}
        />
        <p>
          Matures {displayDate(loan.maturity)} · Recovery strictly after{" "}
          {displayDate(loan.maturity + 3_600n)}
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
