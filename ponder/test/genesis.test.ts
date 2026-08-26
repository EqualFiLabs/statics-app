import { describe, expect, it } from "vitest";

import { nextAvailableGenesisId } from "../src/genesis";
import { activeGenesisCreditMutation } from "../src/genesis-credit";

describe("nextAvailableGenesisId", () => {
  it("returns the first token still owned by the vault", () => {
    expect(nextAvailableGenesisId([1n, 2n, 4n])).toBe(3n);
  });

  it("returns the first token when no circulating NFT rows exist", () => {
    expect(nextAvailableGenesisId([])).toBe(1n);
  });

  it("returns null only when every Genesis NFT is circulating", () => {
    const circulating = Array.from({ length: 5_555 }, (_, index) => BigInt(index + 1));
    expect(nextAvailableGenesisId(circulating)).toBeNull();
  });
});

describe("activeGenesisCreditMutation", () => {
  const deploymentId = "robinhood-genesis";
  const owner = "0x0000000000000000000000000000000000000001" as const;

  it("materializes open and extension transitions", () => {
    expect(
      activeGenesisCreditMutation({
        type: "opened",
        deploymentId,
        genesisId: 42n,
        owner,
        principal: 100n,
        maturity: 1_000n,
        recoverableAt: 1_100n,
        blockNumber: 7n,
      })
    ).toEqual({
      type: "insert",
      row: {
        key: `${deploymentId}:42`,
        deploymentId,
        genesisId: 42n,
        owner,
        principal: 100n,
        maturity: 1_000n,
        recoverableAt: 1_100n,
        updatedAtBlock: 7n,
      },
    });
    expect(
      activeGenesisCreditMutation({
        type: "extended",
        deploymentId,
        genesisId: 42n,
        maturity: 2_000n,
        recoverableAt: 2_100n,
        blockNumber: 8n,
      })
    ).toEqual({
      type: "update",
      key: `${deploymentId}:42`,
      values: { maturity: 2_000n, recoverableAt: 2_100n, updatedAtBlock: 8n },
    });
  });

  it.each(["repaid", "recovered"] as const)("deletes a %s credit", (type) => {
    expect(activeGenesisCreditMutation({ type, deploymentId, genesisId: 42n })).toEqual({
      type: "delete",
      key: `${deploymentId}:42`,
    });
  });
});
