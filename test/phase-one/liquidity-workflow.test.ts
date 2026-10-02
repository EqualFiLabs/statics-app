import { describe, expect, it } from "vitest";

import {
  advancePublicLiquidityWorkflow,
  createPublicLiquidityWorkflow,
  publicLiquidityWorkflowStorageKey,
} from "@/lib/phase-one/liquidity-workflow";

const hash = (digit: string) => `0x${digit.repeat(64)}` as const;

describe("Phase 1 liquidity workflow persistence", () => {
  it("keeps PositionNFT creation and liquidity provision as separate resumable confirmations", () => {
    const created = createPublicLiquidityWorkflow({
      deploymentId: "phase-one",
      chainId: 4_663,
      wallet: "0xABC",
      poolId: hash("1"),
      intentId: "intent-1",
      now: 1,
    });
    const positionPending = advancePublicLiquidityWorkflow(
      created,
      { status: "position-confirming", transactionHash: hash("2") },
      2
    );
    const liquidityReady = advancePublicLiquidityWorkflow(
      positionPending,
      { status: "liquidity-ready", positionId: 9n },
      3
    );
    const liquidityPending = advancePublicLiquidityWorkflow(
      liquidityReady,
      { status: "liquidity-confirming", transactionHash: hash("3") },
      4
    );
    expect(
      advancePublicLiquidityWorkflow(liquidityPending, { status: "complete" }, 5)
    ).toMatchObject({
      status: "complete",
      positionId: "9",
      positionTransactionHash: hash("2"),
      liquidityTransactionHash: hash("3"),
    });
    expect(publicLiquidityWorkflowStorageKey(created)).toContain("phase-one:4663:0xabc:intent-1");
  });

  it("rejects collapsed or out-of-order workflow transitions", () => {
    const created = createPublicLiquidityWorkflow({
      deploymentId: "phase-one",
      chainId: 4_663,
      wallet: "0xABC",
      poolId: hash("1"),
      intentId: "intent-1",
    });
    expect(() => advancePublicLiquidityWorkflow(created, { status: "complete" })).toThrow(
      "Invalid liquidity workflow transition"
    );
  });
});
