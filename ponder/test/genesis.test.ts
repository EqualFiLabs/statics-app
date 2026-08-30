import { describe, expect, it } from "vitest";

import {
  genesisTransferMutation,
  genesisWeightChangedMutation,
  nextAvailableGenesisId,
  type GenesisNftMutation,
  type GenesisNftRow,
} from "../src/genesis";
import { activeGenesisCreditMutation } from "../src/genesis-credit";

function applyGenesisMutation(
  current: GenesisNftRow | undefined,
  mutation: GenesisNftMutation
): GenesisNftRow | undefined {
  if (mutation.type === "delete") return undefined;
  return current ? { ...current, ...mutation.update } : mutation.row;
}

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

describe("Genesis NFT event ordering", () => {
  const deploymentId = "robinhood-genesis";
  const vault = "0x8AAAF9a22f439589987B8f1e69d79ca4f648C297" as const;
  const buyer = "0x1111111111111111111111111111111111111111" as const;

  it("materializes weight before a vault-to-owner Transfer and preserves it", () => {
    const blockNumber = 50_132_467n;
    let row = applyGenesisMutation(
      undefined,
      genesisWeightChangedMutation({
        deploymentId,
        genesisId: 29n,
        vault,
        newWeight: 10_000n,
        blockNumber,
      })
    );

    expect(row).toMatchObject({
      key: `${deploymentId}:29`,
      owner: vault,
      registered: true,
      effectiveWeight: 10_000n,
    });

    row = applyGenesisMutation(
      row,
      genesisTransferMutation({
        deploymentId,
        genesisId: 29n,
        to: buyer,
        vault,
        blockNumber,
      })
    );

    expect(row).toEqual({
      key: `${deploymentId}:29`,
      deploymentId,
      id: 29n,
      owner: buyer,
      tier: 0,
      multiplierBps: 10_000,
      linkedPositionId: 0n,
      registered: true,
      effectiveWeight: 10_000n,
      updatedAtBlock: blockNumber,
    });
  });

  it("removes circulating state when Genesis returns to the vault", () => {
    const row = genesisWeightChangedMutation({
      deploymentId,
      genesisId: 29n,
      vault,
      newWeight: 10_000n,
      blockNumber: 50_132_467n,
    }).row;

    expect(
      applyGenesisMutation(
        row,
        genesisTransferMutation({
          deploymentId,
          genesisId: 29n,
          to: vault,
          vault,
          blockNumber: 50_132_468n,
        })
      )
    ).toBeUndefined();
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
