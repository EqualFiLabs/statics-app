import { describe, expect, it } from "vitest";

import {
  parseIndexedPositions,
  parseIndexedPublicPools,
  parsePhaseOneCandles,
} from "@/lib/indexer/phase-one";

const address = (byte: string) => `0x${byte.repeat(40)}`;
const hash = (byte: string) => `0x${byte.repeat(64)}`;

describe("Phase 1 indexed read models", () => {
  it("parses deployment-scoped public PoolKeys without losing bigint precision", () => {
    const result = parseIndexedPublicPools(
      {
        deploymentId: "phase-one",
        indexedAtBlock: "9007199254740993",
        items: [
          {
            poolId: hash("1"),
            creator: address("1"),
            poolKey: {
              currency0: address("2"),
              currency1: address("3"),
              fee: 3_000,
              tickSpacing: 60,
              hooks: address("4"),
            },
            initialSqrtPriceX96: "79228162514264337593543950336",
            initialTick: 0,
            inputFeeBps: 5,
            outputFeeBps: 5,
            feeRateOverridden: false,
            quarantined: false,
            rewardRestrictions: { token0: false, token1: true },
            decommissioned: false,
            polActivated: true,
            createdAtBlock: "100",
            updatedAtBlock: "101",
          },
        ],
      },
      "phase-one"
    );
    expect(result.indexedAtBlock).toBe(9_007_199_254_740_993n);
    expect(result.items[0]?.initialSqrtPriceX96).toBe(2n ** 96n);
    expect(result.items[0]?.poolKey.tickSpacing).toBe(60);
    expect(result.items[0]?.rewardRestrictions.token1).toBe(true);
  });

  it("parses deployment-scoped MarketTape candles", () => {
    const result = parsePhaseOneCandles(
      {
        deploymentId: "phase-one",
        poolId: hash("1"),
        indexedAtBlock: "101",
        resolution: 5,
        items: [
          {
            timestamp: "60",
            openSqrtPriceX96: "10",
            highSqrtPriceX96: "12",
            lowSqrtPriceX96: "9",
            closeSqrtPriceX96: "11",
            volume0: "100",
            volume1: "200",
            zeroForOneCount: 1,
            oneForZeroCount: 2,
            swapCount: 3,
            firstBlock: "99",
            lastBlock: "101",
          },
        ],
      },
      "phase-one"
    );
    expect(result.poolId).toBe(hash("1"));
    expect(result.items[0]?.volume1).toBe(200n);
    expect(result.items[0]?.swapCount).toBe(3);
  });

  it("rejects cross-deployment and malformed position responses", () => {
    expect(() =>
      parseIndexedPositions({ deploymentId: "other", indexedAtBlock: "1", items: [] }, "phase-one")
    ).toThrow("different deployment");
    expect(() =>
      parseIndexedPositions(
        {
          deploymentId: "phase-one",
          indexedAtBlock: "1",
          items: [
            {
              positionId: "1",
              owner: "bad",
              stakedBalance: "0",
              activeLegCount: "0",
              unresolvedObligationCount: "0",
              updatedAtBlock: "1",
            },
          ],
        },
        "phase-one"
      )
    ).toThrow("position owner");
  });
});
