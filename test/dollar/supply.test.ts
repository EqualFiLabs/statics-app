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
    expect(deriveSupplyStep(100n, partial, true).step).toBe("stake");
    expect(deriveSupplyStep(40n, partial, true).step).toBe("opt-in");
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
  // withdrawLeg cannot see opted-in principal, so taking it back out of the
  // book has to happen first or the withdrawal reverts.
  it("opts out before withdrawing when the shares are still supplied", () => {
    const supplied = state({ optedIn: 100n, stakedAvailable: 0n });
    expect(deriveWithdrawStep(100n, supplied).step).toBe("opt-out");
  });

  it("withdraws directly when the principal is no longer supplied", () => {
    const idle = state({ optedIn: 0n, stakedAvailable: 100n });
    expect(deriveWithdrawStep(100n, idle).step).toBe("withdraw");
  });

  it("only opts out of the shortfall, leaving the rest earning", () => {
    const mixed = state({ optedIn: 60n, stakedAvailable: 40n });
    expect(deriveWithdrawStep(40n, mixed).step).toBe("withdraw");
    expect(deriveWithdrawStep(100n, mixed).step).toBe("opt-out");
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
