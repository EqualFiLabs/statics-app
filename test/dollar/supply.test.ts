import { describe, expect, it } from "vitest";

import {
  deriveSupplyStep,
  deriveWithdrawStep,
  emptyDollarSupplyState,
  type DollarSupplyState,
} from "@/lib/dollar/supply";

const state = (overrides: Partial<DollarSupplyState> = {}): DollarSupplyState => ({
  ...emptyDollarSupplyState,
  positionId: 6n,
  riskApprovedForPeriphery: true,
  ...overrides,
});

describe("supplying Risk shares as redemption liquidity", () => {
  it("asks for approval before it can pull shares into a position", () => {
    const next = deriveSupplyStep(
      100n,
      state({ walletShares: 100n, riskApprovedForPeriphery: false }),
      true
    );
    expect(next.step).toBe("approve-risk-periphery");
  });

  // Staking alone does nothing for a redeemer, so the second call is the one
  // that actually fills the book.
  it("stakes first, then supplies", () => {
    const holding = state({ walletShares: 100n });
    expect(deriveSupplyStep(100n, holding, true).step).toBe("stake");
    // After the stake confirms the principal is in the leg, not the wallet.
    const staked = state({ walletShares: 0n, stakedAvailable: 100n });
    expect(deriveSupplyStep(100n, staked, true).step).toBe("opt-in");
  });

  // Principal already staked is reused rather than pulling more from the
  // wallet, so a top-up only needs the shortfall.
  it("reuses principal already sitting in the leg", () => {
    const partial = state({ walletShares: 60n, stakedAvailable: 40n });
    // Only the 60 shortfall is pulled from the wallet, not the full 100.
    expect(deriveSupplyStep(100n, partial, true)).toMatchObject({ step: "stake", moves: 60n });
    expect(deriveSupplyStep(40n, partial, true)).toMatchObject({ step: "opt-in", moves: 40n });
  });

  it("refuses more than the wallet and leg hold together", () => {
    const next = deriveSupplyStep(100n, state({ walletShares: 10n, stakedAvailable: 10n }), true);
    expect(next.step).toBe("blocked");
    expect(next.reason).toMatch(/not have enough risk shares/i);
  });

  it("blocks while the series is inactive", () => {
    expect(deriveSupplyStep(100n, state({ walletShares: 100n }), false).step).toBe("blocked");
  });

  it("needs an amount before anything else", () => {
    expect(deriveSupplyStep(0n, state({ walletShares: 100n }), true).step).toBe("needs-input");
  });
});

describe("withdrawing supplied Risk shares", () => {
  // optOut ends in safeTransferFrom(this -> receiver), so it IS the withdrawal
  // when nothing is idle in the leg -- not a first hop feeding a second.
  it("opts out directly to the wallet when nothing is idle in the leg", () => {
    const supplied = state({ optedIn: 100n, stakedAvailable: 0n });
    const next = deriveWithdrawStep(100n, supplied);
    expect(next.step).toBe("opt-out");
    expect(next.moves).toBe(100n);
  });

  it("withdraws directly when the principal is no longer supplied", () => {
    const idle = state({ optedIn: 0n, stakedAvailable: 100n });
    expect(deriveWithdrawStep(100n, idle).step).toBe("withdraw");
  });

  // Idle principal earns nothing, so it goes first and the book keeps working
  // for as long as possible.
  it("drains the idle leg before touching the book", () => {
    const mixed = state({ optedIn: 60n, stakedAvailable: 40n });
    expect(deriveWithdrawStep(40n, mixed)).toMatchObject({ step: "withdraw", moves: 40n });
    // Asking for 100 moves the 40 idle first; the 60 still supplied follows.
    expect(deriveWithdrawStep(100n, mixed)).toMatchObject({ step: "withdraw", moves: 40n });
    const afterLegDrained = state({ optedIn: 60n, stakedAvailable: 0n });
    expect(deriveWithdrawStep(60n, afterLegDrained)).toMatchObject({ step: "opt-out", moves: 60n });
  });

  // The bug this replaces: withdrawLeg was called with the full amount after an
  // opt-out that had already delivered part of it, reverting InsufficientPrincipal.
  it("never asks a step to move more than its source holds", () => {
    const mixed = state({ optedIn: 60n, stakedAvailable: 40n });
    const next = deriveWithdrawStep(100n, mixed);
    expect(next.moves).toBeLessThanOrEqual(mixed.stakedAvailable);
  });

  it("refuses more than was supplied", () => {
    const next = deriveWithdrawStep(500n, state({ optedIn: 60n, stakedAvailable: 40n }));
    expect(next.step).toBe("blocked");
    expect(next.reason).toMatch(/more than you have supplied/i);
  });

  it("explains itself when this wallet never supplied anything", () => {
    const next = deriveWithdrawStep(100n, { ...emptyDollarSupplyState, positionId: null });
    expect(next.step).toBe("blocked");
    expect(next.reason).toMatch(/has not supplied/i);
  });
});
