"use client";

import { encodeFunctionData, type Address, type Hex, type PublicClient } from "viem";

import {
  staticsAbi,
  staticsDollarPeripheryAbi,
  staticsDollarRiskTokenAbi,
} from "@statics-protocol/sdk";

/**
 * Supplying Risk shares as redemption liquidity, and taking them back.
 *
 * A Dollar holder can only exit alone because somebody else made their Risk
 * shares available. That takes two hops, and neither is obvious from holding
 * the shares:
 *
 *   shares in wallet -> staked into a position leg -> opted in to the series book
 *
 * Staking alone does nothing for redeemers; opting in is what fills the book
 * that PairingVaultFacet draws on. Withdrawing reverses the same two hops,
 * because `withdrawLeg` can only see principal that is not opted in.
 *
 * The position is an implementation detail of that path rather than something
 * a supplier chose, so this finds an existing leg to reuse and only creates a
 * position when there is none.
 */

export type DollarSupplyState = Readonly<{
  /** Position already holding a leg for this series, when one exists. */
  positionId: bigint | null;
  /** Principal in the leg that is not opted in -- what `optIn` can draw from. */
  stakedAvailable: bigint;
  /** Principal currently opted in and redeemable by Dollar holders. */
  optedIn: bigint;
  /** Risk shares still sitting in the wallet. */
  walletShares: bigint;
  /** ERC-1155 operator approval for the periphery, required before staking. */
  riskApprovedForPeriphery: boolean;
}>;

export type DollarSupplyStep =
  | "needs-input"
  | "approve-risk-periphery"
  | "stake"
  | "opt-in"
  | "opt-out"
  | "withdraw"
  | "blocked";

export const emptyDollarSupplyState: DollarSupplyState = {
  positionId: null,
  stakedAvailable: 0n,
  optedIn: 0n,
  walletShares: 0n,
  riskApprovedForPeriphery: false,
};

/**
 * Finds the position already carrying a leg for this series.
 *
 * There is no reverse index from series to position, so candidates come from
 * Transfer logs the way the position catalog finds them, and each is asked
 * directly. The scan stops at the first match because any leg on this series
 * serves equally well.
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
    // Newest first: a leg is far more likely on a recently received position.
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

    const leg = await publicClient
      .readContract({
        address: periphery,
        abi: staticsDollarPeripheryAbi,
        functionName: "leg",
        args: [positionId, seriesId],
      })
      .catch(() => null);
    if (!leg?.exists) continue;

    const optedIn = await publicClient
      .readContract({
        address: periphery,
        abi: staticsDollarPeripheryAbi,
        functionName: "optInBalanceOf",
        args: [positionId, seriesId],
      })
      .catch(() => 0n);

    return {
      positionId,
      // optIn and withdrawLeg both draw from pending + eligible. Opted-in
      // principal has already left both, so it is not double counted here.
      stakedAvailable: leg.pendingPrincipal + leg.eligiblePrincipal,
      optedIn,
      walletShares,
      riskApprovedForPeriphery,
    };
  }

  return { ...emptyDollarSupplyState, walletShares, riskApprovedForPeriphery };
}

/**
 * The next transaction for supplying `amount` of Risk shares.
 *
 * Staking and opting in are separate calls, so this returns one step at a time
 * and is re-derived after each confirmation -- the same shape the rest of the
 * Dollar page uses for approvals.
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
  if (state.stakedAvailable >= amount) {
    return { step: "opt-in", label: "Supply Risk shares", reason: null, moves: amount };
  }

  const toStake = amount - state.stakedAvailable;
  if (state.walletShares < toStake) {
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
  return { step: "stake", label: "Stake Risk shares", reason: null, moves: toStake };
}

/**
 * The next transaction for returning `amount` of Risk shares to the wallet.
 *
 * Both sources deliver straight to the wallet -- `optOut` ends in
 * `safeTransferFrom(address(this), receiver, ...)` just as `withdrawLeg` does,
 * so it is not a first hop that feeds a second. They are two independent
 * withdrawals that happen to need doing in sequence when one alone is short.
 *
 * The idle leg is drained first: principal sitting there is not earning opt-in
 * rewards, so taking it before touching the book leaves as much supplied as
 * possible for as long as possible.
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
  if (amount > state.stakedAvailable + state.optedIn) {
    return {
      step: "blocked",
      label: "Withdraw unavailable",
      reason: "This is more than you have supplied to this series.",
      moves: 0n,
    };
  }
  const fromLeg = amount < state.stakedAvailable ? amount : state.stakedAvailable;
  if (fromLeg > 0n) {
    return { step: "withdraw", label: "Withdraw Risk shares", reason: null, moves: fromLeg };
  }
  return { step: "opt-out", label: "Stop supplying", reason: null, moves: amount };
}

/**
 * The supply steps in the shape the Dollar page's single action button uses,
 * so supplying reads as one more mode rather than a second control scheme.
 * `moves` is the amount to send -- it is not always the amount typed, because a
 * step may only be able to move part of it.
 */
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
        functionName: "createAndStake",
        args: [seriesId, amount, receiver],
      })
    : encodeFunctionData({
        abi: staticsDollarPeripheryAbi,
        functionName: "stake",
        args: [positionId, seriesId, amount],
      });
}

export function buildOptInCall(positionId: bigint, seriesId: bigint, amount: bigint): Hex {
  return encodeFunctionData({
    abi: staticsDollarPeripheryAbi,
    functionName: "optIn",
    args: [positionId, seriesId, amount],
  });
}

export function buildOptOutCall(
  positionId: bigint,
  seriesId: bigint,
  amount: bigint,
  receiver: Address
): Hex {
  return encodeFunctionData({
    abi: staticsDollarPeripheryAbi,
    functionName: "optOut",
    args: [positionId, seriesId, amount, receiver],
  });
}

export function buildWithdrawLegCall(
  positionId: bigint,
  seriesId: bigint,
  amount: bigint,
  receiver: Address
): Hex {
  return encodeFunctionData({
    abi: staticsDollarPeripheryAbi,
    functionName: "withdrawLeg",
    args: [positionId, seriesId, amount, receiver],
  });
}
