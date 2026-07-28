"use client";

import { encodeFunctionData, type Address, type Hex, type PublicClient } from "viem";

import {
  staticsAbi,
  staticsDollarPeripheryAbi,
  staticsDollarRiskTokenAbi,
} from "@statics-protocol/sdk";

/**
 * Supplying Risk Shares as redemption liquidity.
 *
 * Staking is supplying -- there is no second step. A staked share is
 * immediately consumable by a Dollar holder redeeming through the pairing
 * vault, and nothing accrues for merely sitting there: proceeds exist only
 * where a fill actually consumed the shares.
 *
 * That leaves three actions rather than the five the earlier opt-in model
 * needed:
 *
 *   stake    put shares in, they become consumable at once
 *   unstake  take unconsumed shares back out
 *   claim    collect proceeds from shares that were consumed
 *
 * Claiming is separate because `unstakeRiskShares` settles the accounting but
 * does not transfer proceeds -- a supplier can withdraw everything and still
 * have collateral, Dollar and STATICS waiting.
 *
 * The position is an implementation detail of the path rather than something a
 * supplier chose, so an existing one is reused and a new position is created
 * only when there is none.
 */

export type DollarSupplyState = Readonly<{
  /** Position already holding risk liquidity for this series, when one exists. */
  positionId: bigint | null;
  /** Supplied shares still unconsumed, and therefore still withdrawable. */
  effectiveShares: bigint;
  /** Proceeds from shares a redemption already consumed. */
  claimableCollateral: bigint;
  claimableStaticsDollar: bigint;
  claimableStatics: bigint;
  /** Risk Shares still sitting in the wallet. */
  walletShares: bigint;
  /** ERC-1155 operator approval for the periphery, required before staking. */
  riskApprovedForPeriphery: boolean;
}>;

export type DollarSupplyStep =
  "needs-input" | "approve-risk-periphery" | "stake" | "unstake" | "blocked";

export const emptyDollarSupplyState: DollarSupplyState = {
  positionId: null,
  effectiveShares: 0n,
  claimableCollateral: 0n,
  claimableStaticsDollar: 0n,
  claimableStatics: 0n,
  walletShares: 0n,
  riskApprovedForPeriphery: false,
};

export function hasClaimableProceeds(state: DollarSupplyState): boolean {
  return (
    state.claimableCollateral > 0n ||
    state.claimableStaticsDollar > 0n ||
    state.claimableStatics > 0n
  );
}

/**
 * Finds the position already carrying risk liquidity for this series.
 *
 * There is no reverse index from series to position, so candidates come from
 * Transfer logs the way the position catalog finds them, and each is asked
 * directly. Newest first, because a supplier's most recent position is the
 * likeliest holder, and the scan stops at the first match.
 */
export async function loadDollarSupplyState(
  publicClient: PublicClient,
  diamond: Address,
  periphery: Address,
  risk: Address,
  wallet: Address,
  seriesId: bigint,
  fromBlock: bigint
): Promise<DollarSupplyState> {
  const [walletShares, riskApprovedForPeriphery, transferLogs] = await Promise.all([
    publicClient
      .readContract({
        address: risk,
        abi: staticsDollarRiskTokenAbi,
        functionName: "balanceOf",
        args: [wallet, seriesId],
      })
      .catch(() => 0n),
    publicClient
      .readContract({
        address: risk,
        abi: staticsDollarRiskTokenAbi,
        functionName: "isApprovedForAll",
        args: [wallet, periphery],
      })
      .catch(() => false),
    publicClient
      .getContractEvents({
        address: diamond,
        abi: staticsAbi,
        eventName: "Transfer",
        args: { to: wallet },
        fromBlock,
        toBlock: "latest",
        strict: true,
      })
      .catch(() => []),
  ]);

  const candidates = [...new Set(transferLogs.map((log) => log.args.tokenId.toString()))]
    .map(BigInt)
    .sort((left, right) => (left === right ? 0 : left > right ? -1 : 1))
    .slice(0, 25);

  for (const positionId of candidates) {
    // A Transfer to this wallet does not mean it still holds the position.
    const owner = await publicClient
      .readContract({
        address: diamond,
        abi: staticsAbi,
        functionName: "ownerOf",
        args: [positionId],
      })
      .catch(() => null);
    if (!owner || owner.toLowerCase() !== wallet.toLowerCase()) continue;

    const liquidity = await publicClient
      .readContract({
        address: periphery,
        abi: staticsDollarPeripheryAbi,
        functionName: "riskLiquidity",
        args: [positionId, seriesId],
      })
      .catch(() => null);
    if (!liquidity?.exists) continue;

    return {
      positionId,
      effectiveShares: liquidity.effectiveShares,
      claimableCollateral: liquidity.claimableCollateral,
      claimableStaticsDollar: liquidity.claimableStaticsDollar,
      claimableStatics: liquidity.claimableStatics,
      walletShares,
      riskApprovedForPeriphery,
    };
  }

  return { ...emptyDollarSupplyState, walletShares, riskApprovedForPeriphery };
}

/**
 * The next transaction for supplying `amount` of Risk Shares.
 *
 * `moves` is what the step should actually send. It is separate from the amount
 * typed because an approval step moves nothing.
 */
export function deriveSupplyStep(
  amount: bigint,
  state: DollarSupplyState,
  seriesActive: boolean
): { step: DollarSupplyStep; label: string; reason: string | null; moves: bigint } {
  if (amount <= 0n) {
    return { step: "needs-input", label: "Enter Risk share amount", reason: null, moves: 0n };
  }
  if (!seriesActive) {
    return {
      step: "blocked",
      label: "Supply unavailable",
      reason: "The Risk series is not currently active.",
      moves: 0n,
    };
  }
  if (state.walletShares < amount) {
    return {
      step: "blocked",
      label: "Supply unavailable",
      reason: "This wallet does not have enough Risk shares for this series.",
      moves: 0n,
    };
  }
  if (!state.riskApprovedForPeriphery) {
    return {
      step: "approve-risk-periphery",
      label: "Approve Risk shares",
      reason: null,
      moves: 0n,
    };
  }
  return { step: "stake", label: "Supply Risk shares", reason: null, moves: amount };
}

/**
 * The next transaction for taking `amount` of unconsumed shares back.
 *
 * Only unconsumed shares can be withdrawn. Anything a redemption already
 * consumed has become proceeds, which are collected by claiming instead --
 * worth saying in the blocked reason, because "you have 100 supplied but can
 * only withdraw 40" is otherwise baffling.
 */
export function deriveWithdrawStep(
  amount: bigint,
  state: DollarSupplyState
): { step: DollarSupplyStep; label: string; reason: string | null; moves: bigint } {
  if (amount <= 0n) {
    return { step: "needs-input", label: "Enter Risk share amount", reason: null, moves: 0n };
  }
  if (state.positionId === null) {
    return {
      step: "blocked",
      label: "Nothing supplied",
      reason: "This wallet has not supplied Risk shares to this series.",
      moves: 0n,
    };
  }
  if (amount > state.effectiveShares) {
    return {
      step: "blocked",
      label: "Withdraw unavailable",
      reason: hasClaimableProceeds(state)
        ? "That is more than you have unconsumed. Shares already redeemed against become proceeds, which are claimed rather than withdrawn."
        : "That is more than you have supplied to this series.",
      moves: 0n,
    };
  }
  return { step: "unstake", label: "Withdraw Risk shares", reason: null, moves: amount };
}

export function supplyActionAvailability(
  mode: "supply" | "unsupply",
  amount: bigint,
  state: DollarSupplyState,
  seriesActive: boolean
): {
  kind: DollarSupplyStep;
  label: string;
  reason: string | null;
  executable: boolean;
  moves: bigint;
} {
  const next =
    mode === "supply"
      ? deriveSupplyStep(amount, state, seriesActive)
      : deriveWithdrawStep(amount, state);
  return {
    kind: next.step,
    label: next.label,
    reason: next.reason,
    moves: next.moves,
    executable: next.step !== "needs-input" && next.step !== "blocked",
  };
}

export function buildApproveRiskForPeripheryCall(periphery: Address): Hex {
  return encodeFunctionData({
    abi: staticsDollarRiskTokenAbi,
    functionName: "setApprovalForAll",
    args: [periphery, true],
  });
}

export function buildStakeRiskCall(
  positionId: bigint | null,
  seriesId: bigint,
  amount: bigint,
  receiver: Address
): Hex {
  return positionId === null
    ? encodeFunctionData({
        abi: staticsDollarPeripheryAbi,
        functionName: "createAndStakeRiskShares",
        args: [seriesId, amount, receiver],
      })
    : encodeFunctionData({
        abi: staticsDollarPeripheryAbi,
        functionName: "stakeRiskShares",
        args: [positionId, seriesId, amount],
      });
}

export function buildUnstakeRiskCall(
  positionId: bigint,
  seriesId: bigint,
  amount: bigint,
  receiver: Address
): Hex {
  return encodeFunctionData({
    abi: staticsDollarPeripheryAbi,
    functionName: "unstakeRiskShares",
    args: [positionId, seriesId, amount, receiver],
  });
}

export function buildClaimRiskProceedsCall(
  positionId: bigint,
  seriesId: bigint,
  receiver: Address
): Hex {
  return encodeFunctionData({
    abi: staticsDollarPeripheryAbi,
    functionName: "claimRiskProceeds",
    args: [positionId, seriesId, receiver],
  });
}
