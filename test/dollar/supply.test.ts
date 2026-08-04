import fs from "node:fs";

import { describe, expect, it, vi } from "vitest";

import {
  deriveSupplyStep,
  deriveWithdrawStep,
  emptyDollarSupplyState,
  hasClaimableProceeds,
  loadDollarSupplyState,
  preferredSupplyPosition,
  type DollarSupplyState,
} from "@/lib/dollar/supply";

const state = (overrides: Partial<DollarSupplyState> = {}): DollarSupplyState => ({
  ...emptyDollarSupplyState,
  positionId: 6n,
  riskApprovedForPeriphery: true,
  ...overrides,
});

describe("Risk supply Position selection", () => {
  it("keeps an existing series leg, otherwise defaults to the newest owned Position", () => {
    expect(preferredSupplyPosition(9n, [8n, 7n], "7")).toBe(9n);
    expect(preferredSupplyPosition(null, [8n, 7n], null)).toBe(8n);
  });

  it("opens a new Position only when explicitly selected or none exists", () => {
    expect(preferredSupplyPosition(null, [8n], "new")).toBeNull();
    expect(preferredSupplyPosition(null, [], null)).toBeNull();
  });

  it("finds series liquidity beyond the newest 25 Positions", async () => {
    const wallet = "0x1111111111111111111111111111111111111111" as const;
    const diamond = "0x2222222222222222222222222222222222222222" as const;
    const periphery = "0x3333333333333333333333333333333333333333" as const;
    const risk = "0x4444444444444444444444444444444444444444" as const;
    const readContract = vi.fn(
      async ({ functionName, args }: { functionName: string; args?: readonly unknown[] }) => {
        if (functionName === "balanceOf") return 10n;
        if (functionName === "isApprovedForAll") return true;
        if (functionName === "positionCreationFee") return 1n;
        if (functionName === "ownerOf") return wallet;
        if (functionName === "riskLiquidity") {
          return {
            exists: args?.[0] === 5n,
            effectiveShares: 9n,
            claimableCollateral: 0n,
            claimableStaticsDollar: 0n,
            claimableStatics: 0n,
          };
        }
        throw new Error(`Unexpected read: ${functionName}`);
      }
    );
    const publicClient = {
      readContract,
      getContractEvents: vi
        .fn()
        .mockResolvedValue(
          Array.from({ length: 30 }, (_, index) => ({ args: { tokenId: BigInt(index + 1) } }))
        ),
    } as never;

    const loaded = await loadDollarSupplyState(
      publicClient,
      diamond,
      periphery,
      risk,
      wallet,
      2n,
      1n
    );

    expect(loaded.positionId).toBe(5n);
    expect(loaded.ownedPositionIds).toHaveLength(30);
    expect(
      readContract.mock.calls.filter(([request]) => request.functionName === "riskLiquidity")
    ).toHaveLength(26);
  });
});

describe("supplying Risk Shares as redemption liquidity", () => {
  it("refreshes supply state after another Dollar action changes the wallet balance", () => {
    const dollarPage = fs.readFileSync("components/dollar/DollarPage.tsx", "utf8");

    expect(dollarPage).toContain("snapshot.refetch(),");
    expect(dollarPage).toContain("? [supplyState.refetch()]");
  });

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
