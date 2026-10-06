import { describe, expect, it } from "vitest";
import { getAddress } from "viem";

import type { DollarDeployment } from "@/lib/dollar/deployment";
import { buildProtocolGenesisBatch } from "@/lib/genesis/protocol-batch-planner";

const diamond = getAddress("0x1111111111111111111111111111111111111111");
const token = getAddress("0x2222222222222222222222222222222222222222");
const reward = getAddress("0x3333333333333333333333333333333333333333");
const deployment = { contracts: { diamond }, genesis: { token } } as DollarDeployment;

describe("protocol Operator batch planner", () => {
  it("checkpoints rewards before activation and revokes its temporary approval", () => {
    const plan = buildProtocolGenesisBatch({
      deployment,
      action: "activate",
      operators: [
        { id: 1n, tier: 0, linkedPositionId: 0n, targetTier: 2 },
        { id: 2n, tier: 1, linkedPositionId: 5n, targetTier: 2 },
      ],
      costs: [10n, 20n, 30n, 40n],
      balance: 50n,
      allowance: 0n,
      rewardAssetsToCheckpoint: [reward],
    });
    expect(plan.tokenAmount).toBe(50n);
    expect(plan.batch.labels).toEqual([
      "checkpoint 1 reward assets",
      "approve exact STATICS amount",
      "activate Operator #1",
      "activate Operator #2",
      "revoke temporary STATICS approval",
    ]);
  });

  it("rejects linking two Operators to the same Position", () => {
    expect(() =>
      buildProtocolGenesisBatch({
        deployment,
        action: "link",
        operators: [
          { id: 1n, tier: 1, linkedPositionId: 0n, positionId: 7n },
          { id: 2n, tier: 1, linkedPositionId: 0n, positionId: 7n },
        ],
      })
    ).toThrow("different Position");
  });
});
