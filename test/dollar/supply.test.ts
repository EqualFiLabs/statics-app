import { describe, expect, it } from "vitest";

import {
  deriveSupplyStep,
  deriveWithdrawStep,
  emptyDollarSupplyState,
  hasClaimableProceeds,
  type DollarSupplyState,
} from "@/lib/dollar/supply";

const state = (overrides: Partial<DollarSupplyState> = {}): DollarSupplyState => ({
  ...emptyDollarSupplyState,
  positionId: 6n,
  riskApprovedForPeriphery: true,
  ...overrides,
});

describe("supplying Risk Shares as redemption liquidity", () => {
  it("asks for approval before it can pull shares in", () => {
    const next = deriveSupplyStep(
      100n,
      state({ walletShares: 100n, riskApprovedForPeriphery: false }),
      true
    );
    expect(next.step).toBe("approve-risk-periphery");
    expect(next.moves).toBe(0n);
  });

  // Staking is supplying. The earlier model needed a second opt-in call before
  // a redeemer could touch the shares; this one does not.
  it("supplies in a single step once approved", () => {
    const next = deriveSupplyStep(100n, state({ walletShares: 100n }), true);
    expect(next).toMatchObject({ step: "stake", moves: 100n });
  });

  it("refuses more than the wallet holds", () => {
    const next = deriveSupplyStep(100n, state({ walletShares: 10n }), true);
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

describe("withdrawing supplied Risk Shares", () => {
  it("withdraws unconsumed shares in one step", () => {
    const next = deriveWithdrawStep(100n, state({ effectiveShares: 100n }));
    expect(next).toMatchObject({ step: "unstake", moves: 100n });
  });

  // Consumed shares are gone -- they became proceeds. Someone who supplied 100
  // and had 60 redeemed against can only withdraw 40, which is bewildering
  // unless the reason says where the rest went.
  it("explains that consumed shares are claimed rather than withdrawn", () => {
    const partlyConsumed = state({ effectiveShares: 40n, claimableCollateral: 5n });
    const next = deriveWithdrawStep(100n, partlyConsumed);
    expect(next.step).toBe("blocked");
    expect(next.reason).toMatch(/claimed rather than withdrawn/i);
    expect(deriveWithdrawStep(40n, partlyConsumed)).toMatchObject({ step: "unstake", moves: 40n });
  });

  it("gives the plain reason when nothing has been consumed", () => {
    const next = deriveWithdrawStep(100n, state({ effectiveShares: 40n }));
    expect(next.step).toBe("blocked");
    expect(next.reason).toMatch(/more than you have supplied/i);
  });

  it("explains itself when this wallet never supplied anything", () => {
    const next = deriveWithdrawStep(100n, { ...emptyDollarSupplyState, positionId: null });
    expect(next.step).toBe("blocked");
    expect(next.reason).toMatch(/has not supplied/i);
  });
});

describe("claimable proceeds", () => {
  // Three assets now, and any one of them means there is something to collect.
  it("detects proceeds in any of the three assets", () => {
    expect(hasClaimableProceeds(state())).toBe(false);
    expect(hasClaimableProceeds(state({ claimableCollateral: 1n }))).toBe(true);
    expect(hasClaimableProceeds(state({ claimableStaticsDollar: 1n }))).toBe(true);
    expect(hasClaimableProceeds(state({ claimableStatics: 1n }))).toBe(true);
  });

  // unstakeRiskShares settles but does not transfer, so a supplier can be fully
  // withdrawn and still owed proceeds. The claim must survive that.
  it("survives a full withdrawal", () => {
    const withdrawn = state({ effectiveShares: 0n, claimableCollateral: 12n });
    expect(hasClaimableProceeds(withdrawn)).toBe(true);
  });
});
