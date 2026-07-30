import {
  BaseError,
  ContractFunctionRevertedError,
  decodeErrorResult,
  getAddress,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";

import {
  BasketStatus,
  LOAN_RECOVERY_GRACE_PERIOD,
  basketTokenAbi,
  staticsAbi,
  staticsBasketErrorAbi,
  staticsCollateralErrorAbi,
  staticsLendingErrorAbi,
  staticsPositionErrorAbi,
  staticsTokenErrorAbi,
  type LoanSnapshot,
} from "@statics-protocol/sdk";

import { loadTokenMetadata, type BasketRecord, type TokenMetadata } from "@/lib/baskets/baskets";
import type { DollarDeployment } from "@/lib/dollar/deployment";
import { describeTransportFailure } from "@/lib/protocol/errors";
import {
  loadPositionCatalog,
  unlockedCollateral,
  type PositionCatalog,
  type PositionCollateral,
  type PositionRecord,
} from "@/lib/positions/positions";

export type LoanTimeline = "active" | "grace" | "recoverable";
export type LoanMode = "borrow" | "repay" | "extend" | "recover";
export type LoanQuoteState = "idle" | "refreshing" | "ready" | "error";

export type LoanAsset = Readonly<{
  token: TokenMetadata;
  principal: bigint;
  walletBalance: bigint;
  allowance: bigint;
}>;

export type LoanRecord = Readonly<{
  loanId: bigint;
  positionId: bigint;
  positionOwner: Address;
  basket: BasketRecord;
  collateralShares: bigint;
  feeShares: bigint;
  maturity: bigint;
  assets: readonly LoanAsset[];
  walletOwned: boolean;
  timeline: LoanTimeline;
}>;

export type LoanCatalog = Readonly<{
  ownedLoans: readonly LoanRecord[];
  publicRecoverableLoans: readonly LoanRecord[];
  positions: readonly PositionRecord[];
  baskets: readonly BasketRecord[];
  currentBlock: bigint;
  currentTimestamp: bigint;
  warnings: readonly string[];
}>;

export type BorrowQuote = Readonly<{
  basketId: bigint;
  sharesIn: bigint;
  feeShares: bigint;
  collateralShares: bigint;
  /** Shares burned on repayment. */
  debtShares: bigint;
  /** Creator-configured recovery penalty, charged only if the loan expires. */
  penaltyShares: bigint;
  assets: readonly Address[];
  principals: readonly bigint[];
}>;

export type ExtensionQuote = Readonly<{
  loanId: bigint;
  assets: readonly Address[];
  requiredFees: readonly bigint[];
}>;

export type LoanActionAvailability = Readonly<{
  kind: "needs-input" | "blocked" | "refreshing" | "approve" | "execute";
  label: string;
  reason: string | null;
  approvalIndex?: number;
  executable: boolean;
}>;

export function isCurrentBorrowQuote(
  quote: BorrowQuote | undefined,
  basketId: bigint | undefined,
  sharesIn: bigint
): quote is BorrowQuote {
  return Boolean(quote && quote.basketId === basketId && quote.sharesIn === sharesIn);
}

export function isCurrentExtensionQuote(
  quote: ExtensionQuote | undefined,
  loanId: bigint | undefined
): quote is ExtensionQuote {
  return Boolean(quote && quote.loanId === loanId);
}

export function loanTimeline(maturity: bigint, currentTimestamp: bigint): LoanTimeline {
  if (currentTimestamp <= maturity) return "active";
  if (currentTimestamp <= maturity + LOAN_RECOVERY_GRACE_PERIOD) return "grace";
  return "recoverable";
}

function compareDescending(left: bigint, right: bigint): number {
  return left === right ? 0 : left > right ? -1 : 1;
}

function normalizeLoan(
  snapshot: Omit<LoanSnapshot, "maturity"> & { maturity: number | bigint }
): LoanSnapshot {
  return {
    positionId: snapshot.positionId,
    basketId: snapshot.basketId,
    collateralShares: snapshot.collateralShares,
    feeShares: snapshot.feeShares,
    debtShares: snapshot.debtShares,
    penaltyShares: snapshot.penaltyShares,
    maturity: BigInt(snapshot.maturity),
    assets: snapshot.assets.map((asset) => getAddress(asset)),
    principals: snapshot.principals,
  };
}

async function loadLoanRecord(
  publicClient: PublicClient,
  deployment: DollarDeployment,
  wallet: Address,
  loanId: bigint,
  positionCatalog: PositionCatalog,
  currentTimestamp: bigint
): Promise<LoanRecord | null> {
  const raw = await publicClient
    .readContract({
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "loan",
      args: [loanId],
    })
    .catch((error) => {
      if (isLoanNotFoundError(error)) return null;
      throw error;
    });
  if (!raw) return null;

  const snapshot = normalizeLoan(raw);
  const basket = positionCatalog.baskets.find((item) => item.basketId === snapshot.basketId);
  if (!basket) {
    throw new Error(
      `Loan #${loanId.toString()} references unavailable basket #${snapshot.basketId.toString()}.`
    );
  }
  if (snapshot.assets.length !== snapshot.principals.length) {
    throw new Error(`Loan #${loanId.toString()} returned an invalid principal vector.`);
  }

  const [positionOwner, assets] = await Promise.all([
    publicClient.readContract({
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      functionName: "ownerOf",
      args: [snapshot.positionId],
    }),
    Promise.all(
      snapshot.assets.map(async (address, index): Promise<LoanAsset> => {
        const known = basket.constituents.find((item) => item.token.address === address);
        const [token, walletBalance, allowance] = await Promise.all([
          known ? Promise.resolve(known.token) : loadTokenMetadata(publicClient, address),
          publicClient.readContract({
            address,
            abi: basketTokenAbi,
            functionName: "balanceOf",
            args: [wallet],
          }),
          publicClient.readContract({
            address,
            abi: basketTokenAbi,
            functionName: "allowance",
            args: [wallet, deployment.contracts.diamond],
          }),
        ]);
        return {
          token,
          principal: snapshot.principals[index] ?? 0n,
          walletBalance,
          allowance,
        };
      })
    ),
  ]);
  const normalizedOwner = getAddress(positionOwner);
  const walletOwned =
    normalizedOwner === wallet &&
    positionCatalog.positions.some((position) => position.positionId === snapshot.positionId);

  return {
    loanId,
    positionId: snapshot.positionId,
    positionOwner: normalizedOwner,
    basket,
    collateralShares: snapshot.collateralShares,
    feeShares: snapshot.feeShares,
    maturity: snapshot.maturity,
    assets,
    walletOwned,
    timeline: loanTimeline(snapshot.maturity, currentTimestamp),
  };
}

export async function loadLoanCatalog(
  publicClient: PublicClient,
  deployment: DollarDeployment,
  wallet: Address
): Promise<LoanCatalog> {
  const [positionCatalog, originated, repaid, recovered, latestBlock] = await Promise.all([
    loadPositionCatalog(publicClient, deployment, wallet),
    publicClient.getContractEvents({
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      eventName: "LoanOriginated",
      fromBlock: deployment.deploymentStartBlock,
      toBlock: "latest",
      strict: true,
    }),
    publicClient.getContractEvents({
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      eventName: "LoanRepaid",
      fromBlock: deployment.deploymentStartBlock,
      toBlock: "latest",
      strict: true,
    }),
    publicClient.getContractEvents({
      address: deployment.contracts.diamond,
      abi: staticsAbi,
      eventName: "LoanRecovered",
      fromBlock: deployment.deploymentStartBlock,
      toBlock: "latest",
      strict: true,
    }),
    publicClient.getBlock({ blockTag: "latest" }),
  ]);

  const closed = new Set([...repaid, ...recovered].map((event) => event.args.loanId.toString()));
  const activeIds = [
    ...new Set(
      originated
        .map((event) => event.args.loanId.toString())
        .filter((loanId) => !closed.has(loanId))
    ),
  ].map(BigInt);
  const records = await Promise.all(
    activeIds.map((loanId) =>
      loadLoanRecord(
        publicClient,
        deployment,
        wallet,
        loanId,
        positionCatalog,
        latestBlock.timestamp
      )
    )
  );
  const warnings: string[] = [];
  const loans = records.filter((loan): loan is LoanRecord => loan !== null);
  if (loans.length !== activeIds.length) {
    warnings.push(
      "Loan event history included a closed or unavailable tranche; current onchain state is shown."
    );
  }

  return {
    ownedLoans: loans
      .filter((loan) => loan.walletOwned)
      .sort((left, right) => compareDescending(left.loanId, right.loanId)),
    publicRecoverableLoans: loans
      .filter((loan) => !loan.walletOwned && loan.timeline === "recoverable")
      .sort((left, right) => compareDescending(left.loanId, right.loanId)),
    positions: positionCatalog.positions,
    baskets: positionCatalog.baskets,
    currentBlock: latestBlock.number,
    currentTimestamp: latestBlock.timestamp,
    warnings,
  };
}

export async function loadBorrowQuote(
  publicClient: PublicClient,
  deployment: DollarDeployment,
  basketId: bigint,
  sharesIn: bigint
): Promise<BorrowQuote> {
  const result = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "quoteBorrow",
    args: [basketId, sharesIn],
  });
  // quoteBorrow returns a named struct as of protocol 39156bc, which also
  // added the debt and recovery-penalty shares.
  if (result.assets.length !== result.principals.length || result.principals.some((a) => a <= 0n)) {
    throw new Error("The current borrow quote returned an invalid principal vector.");
  }
  return {
    basketId,
    sharesIn,
    feeShares: result.feeShares,
    collateralShares: result.collateralShares,
    debtShares: result.debtShares,
    penaltyShares: result.penaltyShares,
    assets: result.assets.map((asset) => getAddress(asset)),
    principals: result.principals,
  };
}

export async function loadExtensionQuote(
  publicClient: PublicClient,
  deployment: DollarDeployment,
  loanId: bigint
): Promise<ExtensionQuote> {
  const [assets, requiredFees] = await publicClient.readContract({
    address: deployment.contracts.diamond,
    abi: staticsAbi,
    functionName: "quoteExtension",
    args: [loanId],
  });
  if (assets.length !== requiredFees.length) {
    throw new Error("The current extension quote returned an invalid fee vector.");
  }
  return { loanId, assets: assets.map((asset) => getAddress(asset)), requiredFees };
}

export function validateExtensionGrossAmounts(
  grossAmounts: readonly bigint[],
  requiredFees: readonly bigint[]
): string | null {
  if (grossAmounts.length !== requiredFees.length) {
    return "Enter one gross extension amount for every required asset.";
  }
  const belowRequired = grossAmounts.findIndex(
    (gross, index) => gross < (requiredFees[index] ?? 0n)
  );
  if (belowRequired >= 0) {
    return `Gross extension amount ${belowRequired + 1} is below the current required fee.`;
  }
  return null;
}

export function hasExtensionExcess(
  grossAmounts: readonly bigint[],
  requiredFees: readonly bigint[]
): boolean {
  return grossAmounts.some((gross, index) => gross > (requiredFees[index] ?? 0n));
}

export function deriveLoanActionAvailability(input: {
  mode: LoanMode;
  amount?: bigint;
  quoteState: LoanQuoteState;
  timeline?: LoanTimeline;
  walletOwned?: boolean;
  basketStatus?: number;
  availableCollateral?: bigint;
  requirements?: readonly bigint[];
  balances?: readonly bigint[];
  allowances?: readonly bigint[];
  extensionGrossError?: string | null;
}): LoanActionAvailability {
  if (input.mode === "borrow") {
    if (!input.amount || input.amount <= 0n) {
      return {
        kind: "needs-input",
        label: "Enter basket shares",
        reason: null,
        executable: false,
      };
    }
    if (input.basketStatus !== BasketStatus.Active) {
      return {
        kind: "blocked",
        label: "Borrow unavailable",
        reason: "Only active baskets can originate a loan.",
        executable: false,
      };
    }
    if (input.availableCollateral === undefined || input.amount > input.availableCollateral) {
      return {
        kind: "blocked",
        label: "Borrow unavailable",
        reason: "This position does not contain enough unlocked basket collateral.",
        executable: false,
      };
    }
  } else if (!input.walletOwned && input.mode !== "recover") {
    return {
      kind: "blocked",
      label: `${input.mode === "extend" ? "Extension" : "Repayment"} unavailable`,
      reason: "This wallet does not own the loan's PositionNFT.",
      executable: false,
    };
  }

  if (input.mode === "extend" && input.timeline !== "active") {
    return {
      kind: "blocked",
      label: "Extension unavailable",
      reason: "A loan can only be extended on or before its maturity.",
      executable: false,
    };
  }
  if (input.mode === "recover" && input.timeline !== "recoverable") {
    return {
      kind: "blocked",
      label: "Recovery unavailable",
      reason: "Recovery opens strictly after maturity and the one-hour grace period.",
      executable: false,
    };
  }
  if (input.extensionGrossError) {
    return {
      kind: "blocked",
      label: "Review gross amounts",
      reason: input.extensionGrossError,
      executable: false,
    };
  }
  if (input.quoteState === "error") {
    return {
      kind: "blocked",
      label: "Current quote unavailable",
      reason: "Refresh the current onchain quote before continuing.",
      executable: false,
    };
  }
  if (input.quoteState !== "ready") {
    return {
      kind: "refreshing",
      label: input.quoteState === "idle" ? "Load current quote" : "Refreshing quote…",
      reason: "Wait for current onchain state.",
      executable: false,
    };
  }

  if (input.requirements) {
    for (let index = 0; index < input.requirements.length; index += 1) {
      const required = input.requirements[index] ?? 0n;
      if ((input.balances?.[index] ?? 0n) < required) {
        return {
          kind: "blocked",
          label: `${input.mode === "extend" ? "Extension" : "Repayment"} unavailable`,
          reason: `This wallet lacks required asset ${index + 1}.`,
          executable: false,
        };
      }
      if ((input.allowances?.[index] ?? 0n) < required) {
        return {
          kind: "approve",
          label: `Approve asset ${index + 1}`,
          reason: null,
          approvalIndex: index,
          executable: true,
        };
      }
    }
  }

  const label =
    input.mode === "borrow"
      ? "Borrow principal vector"
      : input.mode === "repay"
        ? "Repay loan"
        : input.mode === "extend"
          ? "Extend loan"
          : "Recover loan";
  return { kind: "execute", label, reason: null, executable: true };
}

export function findPositionCollateral(
  position: PositionRecord | undefined,
  basketId: bigint
): PositionCollateral | undefined {
  return position?.collateral.find((item) => item.basket.basketId === basketId);
}

export function borrowableCollateral(
  position: PositionRecord | undefined,
  basketId: bigint
): bigint {
  const collateral = findPositionCollateral(position, basketId);
  return collateral ? unlockedCollateral(collateral) : 0n;
}

const loanErrorMessages: Readonly<Record<string, string>> = {
  BasketNotFound: "This loan's basket no longer exists.",
  LoanNotFound: "This loan no longer exists.",
  InvalidReceiver: "The principal receiver is invalid.",
  InvalidShares: "Enter a valid BasketToken share amount.",
  ZeroPrincipal: "The requested borrow would produce a zero principal.",
  ActionPaused: "Lending is currently paused.",
  InsufficientVaultBalance: "The basket vault cannot fund this principal vector.",
  LoanExpired: "This loan has matured and can no longer be extended.",
  LoanNotRecoverable: "The recovery grace period has not ended.",
  MaturityOverflow: "This loan cannot be extended beyond the protocol time limit.",
  InsufficientTransferReceived: "A transferred asset arrived below the required amount.",
  InvalidExtensionInputLength: "The extension must provide one amount per principal asset.",
  NotPositionOwnerOrApproved: "This wallet does not own or control the PositionNFT.",
  PositionSharesLocked: "The requested BasketToken collateral is not unlocked.",
  InsufficientPositionShares: "The PositionNFT does not contain enough basket collateral.",
  ERC20InsufficientBalance: "The wallet does not have enough of the required token.",
  ERC20InsufficientAllowance: "Approve the exact required token amount before continuing.",
};

function findHexData(error: unknown): Hex | null {
  if (!(error instanceof BaseError)) return null;
  const revert = error.walk(
    (candidate) => candidate instanceof ContractFunctionRevertedError
  ) as ContractFunctionRevertedError | null;
  return revert?.raw ?? null;
}

export function isLoanNotFoundError(error: unknown): boolean {
  const data = findHexData(error);
  if (data) {
    try {
      return decodeErrorResult({ abi: staticsLendingErrorAbi, data }).errorName === "LoanNotFound";
    } catch {
      return false;
    }
  }
  return error instanceof Error && error.message.includes("LoanNotFound");
}

export function describeLoanError(error: unknown): string {
  const data = findHexData(error);
  if (data) {
    for (const abi of [
      staticsLendingErrorAbi,
      staticsPositionErrorAbi,
      staticsCollateralErrorAbi,
      staticsTokenErrorAbi,
      staticsBasketErrorAbi,
    ]) {
      try {
        const decoded = decodeErrorResult({ abi, data });
        const message =
          loanErrorMessages[decoded.errorName] ?? "The protocol rejected this loan action.";
        return `${message} (${decoded.errorName})`;
      } catch {
        // Continue through the authoritative protocol error surfaces.
      }
    }
  }
  const message = error instanceof Error ? error.message : "The wallet request failed.";
  const transportFailure = describeTransportFailure(message);
  if (transportFailure) return transportFailure;
  const known = Object.entries(loanErrorMessages).find(([name]) => message.includes(name));
  if (known) return `${known[1]} (${known[0]})`;
  if (/rejected|denied|4001/i.test(message)) return "The wallet request was rejected.";
  return message;
}
