import { describe, expect, it } from "vitest";

import {
  advancePublicLiquidityWorkflow,
  createPublicLiquidityWorkflow,
  loadPublicLiquidityWorkflow,
  parsePublicLiquidityWorkflow,
  publicLiquidityWorkflowStorageKey,
  savePublicLiquidityWorkflow,
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

  it("persists and validates resumable workflow state", () => {
    const workflow = createPublicLiquidityWorkflow({
      deploymentId: "phase-one",
      chainId: 4663,
      wallet: "0x1111111111111111111111111111111111111111",
      poolId: hash("1"),
      intentId: "intent-1",
      now: 10,
    });
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    savePublicLiquidityWorkflow(storage, workflow);
    expect(loadPublicLiquidityWorkflow(storage, workflow)).toEqual(workflow);
    expect(() => parsePublicLiquidityWorkflow('{"version":2}')).toThrow("invalid");
  });
});
