import { describe, expect, it } from "vitest";

import {
  deriveDollarActionAvailability,
  dollarQuoteQueryKey,
  type DeriveDollarActionInput,
  type DollarActionSnapshot,
} from "@/lib/dollar/action-state";

const amount = 10n;
const healthySnapshot: DollarActionSnapshot = {
  profileKind: 0,
  profileMode: 1,
  seniorOutstanding: 100n,
  debtCeiling: 1_000n,
  seriesStatus: 1,
  oracleAvailable: true,
  healthy: true,
  globalHealthPhase: 0,
  pausedOperations: 0n,
  nativeBalance: 100n,
  wethBalance: 100n,
  dollarBalance: 100n,
  riskBalance: 100n,
  wethAllowance: amount,
  dollarAllowance: amount,
  riskApproved: true,
};

function derive(overrides: Partial<DeriveDollarActionInput> = {}) {
  return deriveDollarActionAvailability({
    mode: "deposit",
    asset: "ETH",
    amount,
    snapshot: healthySnapshot,
    quoteState: "ready",
    quotedDollarAmount: amount,
    ...overrides,
  });
}

describe("Dollar action availability", () => {
  it("keeps bigint quote identity serializable by the query cache", () => {
    const key = dollarQuoteQueryKey({
      chainId: 31_337,
      mode: "deposit",
      amount: 2n,
      seriesId: 7n,
    });

    expect(JSON.stringify(key)).toBe('["dollar-quote",31337,"deposit","2","7"]');
  });

  it("keeps input and preview freshness ahead of approvals or execution", () => {
    expect(derive({ amount: 0n })).toMatchObject({
      kind: "needs-input",
      label: "Enter ETH amount",
    });
    expect(derive({ quoteState: "refreshing" })).toMatchObject({
      kind: "refreshing",
      executable: false,
    });
    expect(
      derive({ quoteState: "error", quoteError: "The active series must transition." })
    ).toMatchObject({
      kind: "blocked",
      reason: "The active series must transition.",
    });
  });

  it.each([
    [{ profileKind: 1 }, "not a volatile"],
    [{ profileMode: 2 }, "not active"],
    [{ pausedOperations: 1n }, "paused"],
    [{ oracleAvailable: false }, "oracle"],
    [{ healthy: false }, "impaired"],
    [{ seriesStatus: 2 }, "Risk series"],
    [{ nativeBalance: amount }, "network fee"],
  ] as const)("blocks an ineligible deposit snapshot %o", (snapshot, reason) => {
    expect(
      derive({ snapshot: { ...healthySnapshot, ...snapshot } }).reason?.toLowerCase()
    ).toContain(reason.toLowerCase());
  });

  it("blocks WETH balance and debt-ceiling violations before authorization", () => {
    expect(
      derive({
        asset: "WETH",
        snapshot: { ...healthySnapshot, wethBalance: amount - 1n, wethAllowance: 0n },
      })
    ).toMatchObject({ kind: "blocked", reason: expect.stringContaining("enough WETH") });

    expect(
      derive({
        quotedDollarAmount: 901n,
        snapshot: { ...healthySnapshot, wethAllowance: 0n },
      })
    ).toMatchObject({ kind: "blocked", reason: expect.stringContaining("debt ceiling") });
  });

  it("presents exact WETH approval and then the deposit as separate next actions", () => {
    expect(
      derive({
        asset: "WETH",
        snapshot: { ...healthySnapshot, wethAllowance: 0n },
      })
    ).toMatchObject({ kind: "approve-weth", label: "Approve exact WETH", executable: true });
    expect(derive({ asset: "WETH" })).toMatchObject({
      kind: "execute",
      label: "Deposit WETH",
    });
  });

  it("uses recombination-specific recovery and balance rules", () => {
    const recombine = (snapshot: Partial<DollarActionSnapshot> = {}) =>
      derive({
        mode: "recombine",
        asset: "WETH",
        snapshot: { ...healthySnapshot, ...snapshot },
        quotedDollarAmount: undefined,
      });

    expect(recombine({ profileMode: 2, healthy: false, seriesStatus: 3 })).toMatchObject({
      kind: "execute",
      label: "Recombine to WETH",
    });
    expect(recombine({ globalHealthPhase: 2 })).toMatchObject({
      kind: "blocked",
      reason: expect.stringContaining("protocol health"),
    });
    expect(recombine({ dollarBalance: amount - 1n })).toMatchObject({
      kind: "blocked",
      reason: expect.stringContaining("enough Dollar"),
    });
    expect(recombine({ riskBalance: amount - 1n })).toMatchObject({
      kind: "blocked",
      reason: expect.stringContaining("Risk shares"),
    });
    expect(recombine({ seriesStatus: 5 })).toMatchObject({
      kind: "blocked",
      reason: expect.stringContaining("no longer"),
    });
  });

  it("sequences Dollar and broad Risk operator approvals", () => {
    expect(
      derive({
        mode: "recombine",
        asset: "ETH",
        snapshot: { ...healthySnapshot, dollarAllowance: 0n, riskApproved: false },
      })
    ).toMatchObject({ kind: "approve-dollar" });
    expect(
      derive({
        mode: "recombine",
        asset: "ETH",
        snapshot: { ...healthySnapshot, riskApproved: false },
      })
    ).toMatchObject({ kind: "approve-risk" });
  });
});
